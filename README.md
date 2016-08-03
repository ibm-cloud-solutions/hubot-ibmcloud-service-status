# hubot-ibmcloud-service-status

Script package provides the current status of IBM Cloud services in different regions. It can provide information about specific service plans and provide monitoring capabilities to alert if services go down and come back up.

## Getting Started
  * [Usage](#usage)
  * [Commands](#commands)
  * [Hubot Adapter Setup](#hubot-adapter-setup)
  * [Development](#development)
  * [License](#license)
  * [Contribute](#contribute)

## Usage <a id="usage"></a>

If you are new to Hubot visit the [getting started](https://hubot.github.com/docs/) content to get a basic bot up and running.  Next, follow these steps for adding this external script into your hubot:

1. `cd` into your hubot directory
2. Install this package via `npm install hubot-ibmcloud-service-status --save`
3. Add `hubot-ibmcloud-service-status` to your `external-scripts.json`
4. Start up your bot & off to the races!


## Commands <a id="commands"></a>

- `hubot ibmcloud status help` - Show available ibmcloud status commands.
- `hubot ibmcloud status region [US South | United Kingdom | Sydney]` - Provide status for ibmcloud services in region.
- `hubot ibmcloud status service [US South | United Kingdom | Sydney] [SERVICE]` - Provide status for ibmcloud service named [SERVICE] in region.
- `hubot ibmcloud status monitor [US South | United Kingdom | Sydney] [UP|DOWN][SERVICE]` - Monitor and send notifications when [SERVICE] in region goes [UP|DOWN].

## Hubot Adapter Setup <a id="hubot-adapter-setup"></a>

Hubot supports a variety of adapters to connect to popular chat clients.  For more feature rich experiences you can setup the following adapters:
- [Slack setup](./docs/adapters/slack.md)
- [Facebook Messenger setup](./docs/adapters/facebook.md)

## Development <a id="development"></a>

Please refer to the [CONTRIBUTING.md](./CONTRIBUTING.md) before starting any work.  Steps for running this script for development purposes:

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
 - [Slack: link to setup instructions](docs/adapters/slack.md)
 - [Facebook Messenger: link to setup instructions](docs/adapters/facebook.md)

## License <a id="license"></a>

See [LICENSE.txt](./LICENSE.txt) for license information.

## Contribute <a id="contribute"></a>

Please check out our [Contribution Guidelines](./CONTRIBUTING.md) for detailed information on how you can lend a hand.
