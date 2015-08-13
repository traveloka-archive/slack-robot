# slack-robot [![Build Status](https://travis-ci.org/traveloka/slack-robot.svg)](https://travis-ci.org/traveloka/slack-robot) [![Coverage Status](https://coveralls.io/repos/traveloka/slack-robot/badge.svg?branch=master&service=github)](https://coveralls.io/github/traveloka/slack-robot?branch=master) [![Package Version](http://img.shields.io/npm/v/slack-robot.svg)](https://www.npmjs.com/package/slack-robot)
> Simple robot for your slack integration

## Installation
```sh
$ npm install slack-robot --save
```

## Usage
```js
var SlackRobot = require('slack-robot');
var robot = new SlackRobot(process.env.YOUR_SLACK_TOKEN);
```

## Advanced options

- Modify slack options

```js
var SlackRobot = require('slack-robot');

var slackOpts = {
  token: process.env.YOUR_TOKEN // required
  autoReconnect: false,         // defaults to true
  autoMark: true                // defaults to true
};
var robot = new SlackRobot(slackOpts);
```

- Modify robot options

```js
// below is default options, you can change it one by one
var robotOpts = {
  ignoreMessageInGeneral: true, // prevent bot to respond anything in #general channel
  mentionToRespond: true,       // prevent bot to respond if not mentioned
  skipDMMention: true,          // no need to mention bot in direct message (ignore mentionToRespond opt in DM)
};

var robot = new Slack(process.env.YOUR_SLACK_TOKEN, robotOpts);
```


To add a listener simply call `robot.listen()` and it will return an instance of `Listener`.

```js
class Listener {
  desc(description: string): listener

  acl(aclCallback: Function(req: Request, res: Response)): listener

  handler(actionHandler: Function(req: Request, res: Response)
}
```

## Simple message listener

Pass a string as an argument to `robot.listen` to respond to specific message.

```js
robot.listen('hello').handler(function(req, res) {
  // your handler here
});
```

The `.handler` will be executed if robot received **'hello'** message from anywhere robot is subscribed to (channel, group, or DM)

## Parameterized message

You can also listen to message with specific parameter with named-regex

```js
// match 'get sheep from 2010'
robot.listen('get :animal([a-z\-]+) from :year([0-9]{4})').handler(function(req, res) {
  // you can get named-param inside Request instance
  console.log(req.param);
  // {animal: 'sheep', year: '2010'}  
});
```

## Pure-regex Listener

Aside from named regex (which uses a partial regex match), you can use pure regex inside your listener. The difference is, instead of getting named-param inside `Request` instance, you get Array of regex matches

```js
// match get sheep from 2010
robot.listen(/get ([a-z]+) from ([0-9]{4})/).handler(function(req, res) {
  // you don't have anything in named-param
  console.log(req.param)
  // {}

  // instead you can use req.matches
  console.log(req.matches);
  // ['sheep', '2010']
})
```

Another difference is when generating help text, you will get *ugly* regex inside your command information `/get ([a-z]+) from ([0-9]{4})` instead of properly named command information (e.g: `get :animal from :year`).

## Request & Response Lifecycle

In `slack-robot`, receiving and sending message is handled via `Request` and `Response` object inside handler (or ACL). Everytime your bot receive a chat, you get `Request` object with typedef below

```
type Request = {
  message: {
    text: string,
    isDirect: boolean,
    withMention: boolean
  },
  user: {
    id: string,
    name: string
  },
  channel: {
    id: string,
    name: string
  }  
}
```

To respond to message, you use `Response` object with class signature below:

```js
class Response {
  // respond message to user in currently active source (channel/group/DM)
  send(res: Slack.Response): Promise

  // syntactic sugar to send text only response (uses .sendDM internally)
  sendText(text: string): Promise

  // send message via user's direct message (even if he/she write it on channel/group)
  sendDM(res: Slack.Response): Promise

  // syntactic sugar to send text only response (uses .sendDM internally)
  sendTextDM(text: string): Promise

  // send specific response to specific target (channel/group/DM)
  sendTo(target: string, res: Slack.Response): Promise

  // syntactic sugar to send text only response (uses .sendTo internally)
  sendTextTo(target: string, text: string): Promise

  // append "@user:" in front of your text (uses .sendText internally)
  reply(text: string): Promise
}
```

### Example

```js
// Listen to "hello", and send "@user: hi!"
robot.listen('hello').handler(function(req, res) {
  return res.reply('hi!');
});

// listen to "release status" and send attachment (see slack docs for more information)
robot.listen('release status').handler(function(req, res) {
  return res.send({
    attachments: [
      {
        title: 'Attachments is cool',
        text: 'colors and autoformatting!',
        color: '#fa3720'
      }
    ]
  })
})
```

## Automatic help generator

`slack-robot` comes with built-in help generator based on information you specify when attaching listener. Help message will be sent to you via direct message by the bot (even if you ask for them in channel/group). **Make sure you also write description for your command (if not, it will be hidden from help message)**

```js
robot.listen('push :branch([a-Z/\-]+) to :env(production|staging)')
.desc('Deploy specific branch to production or staging servers')
.handler(deploy);
```

To see help message, simply say `help` or `show help`. Help message then will be sent to you via DM

Example:
> Deploy specific branch to production or staging servers

> Command: **push :branch to :env**

## ACL

`slack-robot` comes with simple access control list (ACL) management. It accept a callback that returns a boolean. Action handler will be executed only if this callback return `true`. ACL callback has exact same signature with Action handler, so you can use `Request` and `Response` object.

```js
robot.listen('push to production').acl(function(req, res) {
  if (req.channel.name !== 'release-channel') {
    res.reply(`please send this command in ${this.mentionChannel('release-channel')}`)
    return false;
  }

  return true;
})
.handler(releaseToProduction);
```

**Note:** Returning `false` in ACL callback doesn't make robot respond anything to user, it just ignore the command. Make sure you use `Response` object to respond before returning `false` to notify the user that his command will be ignored because of ACL.

## Brain

slack-robot also have simple immutable in-memory key-value store using [imstore](https://github.com/pveyes/imstore). To access it simply call imstore API via `robot.brain`.

Example:
```js
robot.brain.set('info', {running: false});
console.log(robot.brain.get('info')) // {running: false}
```

## License

MIT
