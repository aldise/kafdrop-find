# kafdrop-find

[![Licence](https://img.shields.io/github/license/aldise/kafdrop-find)](https://github.com/aldise/kafdrop-find/blob/main/LICENSE)
[![LGTM Grade](https://img.shields.io/lgtm/grade/javascript/github/aldise/kafdrop-find)](https://lgtm.com/projects/g/aldise/kafdrop-find/context:javascript)

[NedeJS](https://nodejs.org) script for very basic text lookup in [Kafdrop – Kafka Web UI](https://github.com/obsidiandynamics/kafdrop) messages.

It may be helpful if the only access to Kafka messages are via Kafdrop.
It takes a lot of pain to lookup for needed keyword manually in the browser.
So, this script does the clicking for You by using [Puppeteer (Headless Chrome Node.js API)](https://github.com/puppeteer/puppeteer)
and looks for specified text in the message.

## Usage

Install dependencies and run the script:

    npm install
    npm start -- <text-to-search> [<options>]

Launch the script directly:

    node kafdrop-find.js <text-to-search> [<options>]

To display all available options launch the script without parameters or use option `--help`.

### Options

| Option        | Short name | Description                                                                                                                                                                               | Default value                                                                                                    | Type    |
|---------------|------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|---------|
| debug         | d          | Debug or verbose mode. Displays debug info and shows browser window while working.                                                                                                        | `false`                                                                                                          | boolean |
| partition     | p          | Partition to look into.                                                                                                                                                                   | `0`                                                                                                              | number  |
| allPartitions | a          | Specifies partition count in topic to look into all of them. If specified, option "partition" is ignored.                                                                                 | <N/A>                                                                                                            | number  |
| maxCount      | c          | Max record count to dig. By default from the end of partition or offset if specified. Ignored if both offsets ar set.                                                                     | `1000`                                                                                                           | number  |
| startOffset   | s          | Offset where to start search. Note that search is performed backwards so startOffset must be greater than endOffset and can not exceed current offset. Used with option "partition" only. | Offset for the last message in queue                                                                             | number  |
| endOffset     | e          | Offset where to stop the search. Note that search is performed backwards so endOffset must be less than startOffset, but can not be less than 0. Used with option "partition" only.       | Offset for first message in queue, but not less than 0 or Offset for the last message minus value in `maxCount`. | number  |
| kafkaUrl      | u          | Kafka server URL to to use. Default is test environment.                                                                                                                                  | `http://my-cool-kafdrop-server.com`                                                                              | string  |
| topic         | t          | Kafka topic where to search in.                                                                                                                                                           | `my-cool-kafka-topic`                                                                                            | string  |
| format        | f          | Message format. "AVRO" for avro message decoding.                                                                                                                                         | `DEFAULT`                                                                                                        | string  |


### Default parameters

You can override default parameters in script directly to avoid passing them all the time.

### Example

To lookup for text "my-message-text" in topic "my-cool-kafka-topic" partitions "0", "1", "2" and "3" on Kafdrop server "my-cool-kafdrop-server.com"
starting from the last message in each partition limiting to 1000 messages in each partition:

    node kafdrop-find.js my-message-text -a 4 -u http://my-cool-kafdrop-server.com -t my-cool-kafka-topic

Result will be the list of partition number and offset followed by direct URL to KafDrop and found data. For example if topic messages are JSONs:

    ----- 1:51 http://my-cool-kafdrop-server.com/topic/my-cool-kafka-topic/messages?partition=1&offset=51&count=1&keyFormat=DEFAULT&format=DEFAULT
    {"id":"24c92229-b4f8-48c1-9f94-2c981eeb98ca","created":"2021-08-24T07:02:01.697384692","someAttribute":"my-message-text"}

**Note** that as search term may be passed any part of the message. Like, this example will match the result above too (double quotes are escaped with extra double quotes):

    node kafdrop-find.js """someAttribute"":""my-message-text""}" -a 4 -u http://my-cool-kafdrop-server.com -t my-cool-kafka-topic

