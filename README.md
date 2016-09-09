[![Build Status](https://travis-ci.org/ibm-cloud-solutions/hubot-ibmcloud-service-status.svg?branch=master)](https://travis-ci.org/ibm-cloud-solutions/hubot-ibmcloud-service-status)
[![Coverage Status](https://coveralls.io/repos/github/ibm-cloud-solutions/hubot-ibmcloud-service-status/badge.svg?branch=master)](https://coveralls.io/github/ibm-cloud-solutions/hubot-ibmcloud-service-status?branch=master)
[![Dependency Status](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-service-status/badge)](https://dependencyci.com/github/ibm-cloud-solutions/hubot-ibmcloud-service-status)
[![npm](https://img.shields.io/npm/v/hubot-ibmcloud-service-status.svg?maxAge=2592000)](https://www.npmjs.com/package/hubot-ibmcloud-service-status)

# hubot-ibmcloud-service-status

Script package provides the current status of IBM Cloud services in different regions. It can provide information about specific service plans and provide monitoring capabilities to alert if services go down and come back up.

## Getting Started
  * [Usage](#usage)
  * [Commands](#commands)
  * [Hubot Adapter Setup](#hubot-adapter-setup)
  * [Cognitive Setup](#cognitive-setup)
  * [Development](#development)
  * [License](#license)
  * [Contribute](#contribute)

## Usage

If you are new to Hubot visit the [getting started](https://hubot.github.com/docs/) content to get a basic bot up and running.  Next, follow these steps for adding this external script into your hubot:

1. `cd` into your hubot directory
2. Install this package via `npm install hubot-ibmcloud-service-status --save`
3. Add `hubot-ibmcloud-service-status` to your `external-scripts.json`
4. Start up your bot & off to the races!


## Commands

- `hubot ibmcloud status help` - Show available ibmcloud status commands.
- `hubot ibmcloud status region [US South | United Kingdom | Sydney]` - Provide status for ibmcloud services in region.
- `hubot ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE]` - Provide status for ibmcloud service named [SERVICE] in region.
- `hubot ibmcloud status monitor [US South | United Kingdom | Sydney] [UP|DOWN|ANY|CLEAR][SERVICE]` - Monitor and send notifications when [SERVICE] in region goes [UP|DOWN].
- `hubot ibmcloud status space` - Provide status for ibmcloud services in the current space.
- `hubot ibmcloud status monitor space [ANY|CLEAR]` - Monitor and send notifications when any service in the current space goes [UP|DOWN].

## Hubot Adapter Setup

Hubot supports a variety of adapters to connect to popular chat clients.  For more feature rich experiences you can setup the following adapters:
- [Slack setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-service-status/blob/master/docs/adapters/slack.md)
- [Facebook Messenger setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-service-status/blob/master/docs/adapters/facebook.md)

## Cognitive Setup

This project supports natural language interactions using Watson and other Bluemix services.  For more information on enabling these features, refer to [Cognitive Setup](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-nlc/blob/master/docs/cognitiveSetup.md).


## Development

Please refer to the [CONTRIBUTING.md](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-service-status/blob/master/CONTRIBUTING.md) before starting any work.  Steps for running this script for development purposes:

### Configuration Setup

1. Create `config` folder in root of this project.
2. Create `env` in the `config` folder
3. If you are using Slack or Facebook see the Hubot Adapter setup section to find the contents to add to `env`.
4. In order to view content in chat clients you will need to add `hubot-ibmcloud-formatter` to your `external-scripts.json` file. Additionally, if you want to use `hubot-help` to make sure your command documentation is correct.  Create `external-scripts.json` in the root of this project, with the following contents:
```
[
	"hubot-help",
    "hubot-ibmcloud-formatter"
]
```
5. Lastly, run `npm install` to obtain all the dependent node modules.

### Running Hubot with Adapters

Hubot supports a variety of adapters to connect to popular chat clients.

If you just want to use:
 - Terminal: run `npm run start`
 - [Slack: link to setup instructions](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-service-status/blob/master/docs/adapters/slack.md)
 - [Facebook Messenger: link to setup instructions](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-service-status/blob/master/docs/adapters/facebook.md)

## License

See [LICENSE.txt](./LICENSE.txt) for license information.

## Contribute

Please check out our [Contribution Guidelines](https://github.com/ibm-cloud-solutions/hubot-ibmcloud-service-status/blob/master/CONTRIBUTING.md) for detailed information on how you can lend a hand.
