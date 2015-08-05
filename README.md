# slack-robot [![Build Status](https://travis-ci.org/pveyes/slack-robot.svg)](https://travis-ci.org/pveyes/slack-robot)
> Simple robot for your slack integration

## Installation
```sh
$ npm install slack-robot --save
```

## Usage
```js
import Robot from 'slack-robot';

// below is default options, you can change it one by one
var robotOpts = {
  ignoreMessageInGeneral: true, // prevent bot to respond anything in #general channel
  mentionToRespond: true,       // prevent bot to respond if not mentioned
  removeBotMention: true        // remove bot mention in message text (your matcher should include bot name)
};

var slackOpts = {
  token: process.env.YOUR_TOKEN
  autoReconnect: true,
  autoMark: true
};

var robot = new Robot(robotOpts, slackOpts);
```

To add a listener simply call `robot.listen()` and it will return an instance of `NeuronListener`.

## NeuronListener API

- Add description for current command (will be used when creating help command)

  `.desc(description : string) : NeuronListener`

- Add ACL for current command

  `.acl(aclCallback : function) : NeuronListener`

- Add handler for current command

  `.handler(actionHandler : BaseAction)`

## Simple message listener

Pass a string as an argument to `robot.listen` to respond to specific message.

```js
robot.listen('hello').handler(someAction);
```

`someAction` handler will be executed if robot received **'hello'** message from anywhere robot is subscribed to (channel, group, or DM)

## Parameterized message

You can also listen to message with specific parameter with regexes

```js
robot.listen('get :animal([a-z\-]+) from :year([0-9]{4})');
// will matches 'get sheep from 2010'
// also matches 'get running-goat from 1999'
```

**Note**: Even though slack-robot support regex in parameterized message, using unnamed regex to match message is not supported.

## Message handler (Action)

To respond to a message you must create message handler / action. Action is an instance of a class extending BaseAction class with `.execute()` method that returns a `Promise`.

```js
import BaseAction from 'slack-robot/action/BaseAction';

export default class CustomAction extends BaseAction {
  constructor(robot) {
    super(robot);
  }

  execute() {
    return Promise((resolve, reject) => { ... })
  }
}

// attach to listener
var customAction = new CustomAction(robot);
robot.listen('something').handler(customAction);
```

## Payload

Inside `execute()` method, you can access payload object using `this.messagePayload` that contains:
- **message** (message instance from slack)
  - **text** (formatted text)
- **user** (user instance from slack)
  - **name** (username that send you message)
- **channel** (channel instance from slack)
  - **name** (channel in which the message is sent)
- **param** (parameter from message if any, as key-value pair)

Example:
```js
robot.listen('My name is :name([a-zA-Z]+). I am :age([0-9]+) years old');

execute() {
  console.log(this.messagePayload);
}
// {
//   message: {
//     text: 'My name is Administrator. I am 18 years old'
//   },
//   user: {
//     name: '@admin'
//   },
//   channel: {
//     name: 'general'
//   },
//   param: {
//     name: 'Administrator',
//     age: '18'
//   }
// }
```

## Automatic help generator

slack-robot comes with built-in help generator based on information you specify when attaching listener. Help message will be sent to you via direct message by the bot (even if you ask for them in channel/group). **Make sure you also write description for your command (if not, it will be hidden from help message)**

```js
robot.listen('push :branch([a-Z/\-]+) to :env(production|staging)')
.desc('Deploy specific branch to production or staging servers')
.handler(deploy);
```

To see help message, simply say `help` or `show help`. Help message then will be sent to you via DM

Example:
> Deploy specific branch to production or staging servers

> Command: **push :branch to :env**


## BaseAction API

- Reply to message (either from channel, group, or DM):

  `.reply(response : SlackResponseObject) : Promise`

- Syntactic sugar to reply only text:

  `.replyText(message : string) : Promise`

- Reply via direct message **(even if the message is sent on channel/group)**:

  `.replyDM(response : SlackResponseObject) : Promise`

- Syntactic sugar to reply text via DM

  `.replyTextDM(message : string) : Promise`

- Send message to specific channel:

  `.sendTo(channelName : string, response : SlackResponseObject) : Promise`

- Syntactic sugar to send only text to specific channel:

  `.sendTextTo(channelName : string, message : string) : Promise`

- Format the username so that slack will recognize as mention. **Leading @ character is optional.**:

  `.mentionUser(userName : string) : string`

- Format channel name so that slack will recognize as mention. **Leading # character is optional.**:

  `.mentionChannel(channelName : string) : string`

## ACL

slack-robot comes with simple access control list (ACL) management. It accept a callback that returns a boolean.
Message handler (Action) will be executed only if this callback return `true`.

This callback will be executed with two arguments: `messagePayload`, and `action`. `messagePayload` is the same as payload you can use in handler. `action` is an instance of BaseAction that you can use to easily respond to ACL.

```js
robot.listen('push to production')
.acl(function(messagePayload, action) {
  if (messagePayload.channel.name !== 'release-channel') {
    action.replyText(`Please send this command in ${this.mentionChannel('release-channel')}`)
    return false;
  }

  return true;
})
.handler(releaseToProduction);
```

**Note:** Returning `false` in ACL callback doesn't make robot respond anything to user, it just ignore the command. Make sure you use `action` object to respond before returning `false` to notify the user that his command will be ignored because of ACL.

## Brain

slack-robot also have simple immutable in-memory key-value store using [imstore](https://github.com/pveyes/imstore). To access it simply call imstore API via `robot.brain`.

Example:
```js
robot.brain.set('info', {running: false});
console.log(robot.brain.get('info')) // {running: false}
```

## License

MIT
