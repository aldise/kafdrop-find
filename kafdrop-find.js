const puppeteer = require('puppeteer');

const log = {
    info: (msg) => {
        if (argv.debug) {
            console.log(msg);
        }
    },
    result: (msg) => {
        console.log(msg);
    }
};

const argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('$0 <text-to-search> [<options>]',
        `Kafka topic searcher.
Looks for the string in message starting from the end of the topic offset.
Result will be "----- <partition>:<offset> <timestamp> <URL to pgae>" followed by data entity that matches the criteria.`,
        (yargs) => {
            yargs
                .option('debug', {
                    alias: 'd',
                    description: 'Debug or verbose mode. Displays debug info and shows browser window while working.',
                    default: false,
                    type: 'boolean'
                })
                .option('partition', {
                    alias: 'p',
                    description: 'Partition to look into.',
                    default: 0,
                    type: 'number'
                })
                .option('allPartitions', {
                    alias: 'a',
                    description: 'Specifies partition count in topic to look into all of them. If specified, option "partition" is ignored.',
                    type: 'number'
                })
                .option('maxCount', {
                    alias: 'c',
                    description: 'Max record count to dig. By default from the end of partition or offset if specified. Ignored if both offsets ar set.',
                    default: 1000,
                    type: 'number'
                })
                .option('startOffset', {
                    alias: 's',
                    description: 'Offset where to start search. Note that search is performed backwards so startOffset must be greater than endOffset and can not exceed current offset. Used with option "partition" only.',
                    type: 'number'
                })
                .option('endOffset', {
                    alias: 'e',
                    description: 'Offset where to stop the search. Note that search is performed backwards so endOffset must be less than startOffset, but can not be less than 0. Used with option "partition" only.',
                    type: 'number'
                })
                .option('kafkaUrl', {
                    alias: 'u',
                    description: 'Kafka server URL to to use. Default is test environment.',
                    default: 'http://my-cool-kafdrop-server.com',
                    type: 'string'
                })
                .option('topic', {
                    alias: 't',
                    description: 'Kafka topic where to search in.',
                    default: 'my-cool-kafka-topic',
                    type: 'string'
                })
                .option('format', {
                    alias: 'f',
                    description: 'Message format. "AVRO" for avro message decoding.',
                    default: 'DEFAULT',
                    type: 'string'
                })
        }).version(false)
    .alias('help', 'h')
    .wrap(null)
    .argv;

log.info(argv);

(async () => {
    let safeToCloseBrowser = true;
    const browser = await puppeteer.launch({headless: !argv.debug});
    try {

        const page = await browser.newPage(),
            waitForLoad = new Promise(resolve => page.on('load', () => resolve())),
            chunkSize = 100;
        await page.setDefaultNavigationTimeout(0);

        let currentPartition = argv.allPartitions ? 0 : argv.partition,
            lastPartition = argv.allPartitions ? argv.allPartitions - 1 : argv.partition;

        while (currentPartition <= lastPartition) {

            let kafkaUrl = argv.kafkaUrl + '/topic/' + argv.topic + '/messages?partition=' + currentPartition + '&offset=0&count=' + chunkSize + '&keyFormat=DEFAULT&format=' + argv.format;

            log.info('Base URL     : ' + kafkaUrl);
            log.info('Partition    : ' + currentPartition);
            log.info('Looking for  : ' + argv.textToSearch);
            let currentOffset = argv.startOffset;
            let firstOffset = 0;
            if (currentOffset === undefined) {
                await page.goto(kafkaUrl);
                await waitForLoad;
                currentOffset = await page.evaluate(() => {
                    return document.querySelector('#lastOffset').innerHTML;
                });
                firstOffset = await page.evaluate(() => {
                    return document.querySelector('#firstOffset').innerHTML;
                });
            }
            log.info('Start offset : ' + currentOffset);

            const endOffset = argv.endOffset ? argv.endOffset : Math.max(firstOffset, currentOffset - argv.maxCount);
            log.info('End offset   : ' + endOffset + '\n');

            while (currentOffset >= endOffset) {
                currentOffset = currentOffset - chunkSize;
                kafkaUrl = kafkaUrl.replace(/(offset=)[\d]+([^\d]*)/, '$1' + (currentOffset < 0 ? 0 : currentOffset) + '$2');
                await page.goto(kafkaUrl);
                await waitForLoad;
                const foundData = await Promise.all(
                    (await page.$x(".//pre[contains(text(),'" + argv.textToSearch + "')]"))
                        .map(finding => page.evaluate(elem => elem.textContent, finding))
                );
                if (foundData.length > 0) {
                    const foundDataOffsets = await Promise.all(
                        (await page.$x(".//pre[contains(text(),'" + argv.textToSearch + "')]/parent::div/parent::div/text()[count(preceding-sibling::span)=1]"))
                            .map(findingOffset => page.evaluate(elem => elem.textContent.match(/[\d]+/g)[0], findingOffset))
                    );
                    foundData.forEach((data, index) => {
                        const directUrl = kafkaUrl.replace(/(offset=)[\d]+([^\d]*)/, '$1' + foundDataOffsets[index] + '$2')
                            .replace(/(count=)[\d]+([^\d]*)/, '$11$2');
                        log.result('----- ' + currentPartition + ':' + foundDataOffsets[index] + ' ' + directUrl + '\n' + data + '\n');
                    });
                }
            }

            currentPartition++;
        }

    } catch (e) {
        console.error(e);
        safeToCloseBrowser = false;
    } finally {
        if (safeToCloseBrowser && !argv.debug) {
            await browser.close();
        }
    }
})();
