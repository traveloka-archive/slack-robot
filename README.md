# @vkonst/slack-robot
[![Build Status](https://travis-ci.org/vkonst/slack-robot.svg)](https://travis-ci.org/vkonst/slack-robot) [![codecov.io](https://codecov.io/github/vkonst/slack-robot/coverage.svg?branch=master)](https://codecov.io/github/vkonst/slack-robot?branch=master) [![Package Version](https://img.shields.io/npm/v/@vkonst/slack-robot.svg)](https://www.npmjs.com/package/@vkonst/slack-robot)
> Simple robot for your slack integration

> _fork from traveloka/slack-robot with updated packages and minor fixes_

`slack-robot` initially built to respond message from user with an action, then replying
with a response. While hubot will do the job, it's too generic (no slack specific response like reaction, snippet, attachment, or listening to slack specific event). Using hubot also mean learning hubot specific command, using the right adapter, using the right slack-client, and patching them with slack specific event

While modularity is good, we're not sure about using multiple module with exponentially
larger bug possibility (and also broader learning material). Because we are using it in critical application, we need to make sure that the API surface is as little as possible, with near perfect test coverage. With that in mind, we built slack-robot by wrapping "official" slack-client into much easier to consume request-response handling library.

## Features

- Simple request response handler
- Normalize Slack API idiosyncrasy, for example:
  - listening to reaction_added event using Slack RTM will trigger event handler regardless the message and channel (even the channel the bot not joined)
  - uploading binary file is not possible (yet)
- Send response (or payload) without having to listen to event (external trigger)
- Access Control List (ACL) for each listener (only respond to message when fulfill specific criteria)
- Extensible via plug-ins (for example [storing state](https://github.com/pveyes/slack-robot-state))
- [Complete control](#handling-the-unexpected) over what happen to your request and response

## Installation
```sh
$ npm install slack-robot --save
```

## Usage example
```js
var SlackRobot = require('slack-robot');
var robot = new SlackRobot(process.env.SLACK_TOKEN);

// will post 'world' text as bot when receiving 'hello' message
// in channel, group, or direct message
robot.listen('hello', function (req, res) {
  return res.text('world').send();
});

// ignore message from '#general' channel, even if it matches the listener
robot.ignore('#general');

// start listening
robot.start();
```

## Parameterized message

You can also listen to dynamic message by using parameterized message (usually called named-regexp), by using `:name(REGEXP)` syntaxes. All parameters will be available via `req.params`

```js
// send 'get sheep from 2010' to your bot
robot.listen('get :animal([a-z\-]+) from :year([0-9]{4})', function (req, res) {
  console.log(req.params)
  // { animal: 'sheep', year: 2010 }
});
```

## Pure regular expression (regexp) listener

Aside from named regexp (which uses a partial regexp match), you can use pure regexp inside your listener. The difference is, instead of getting an object in `req.params`, you get Array of regexp matches in `req.matches`

```js
// send 'get sheep from 2010' to your bot
robot.listen(/get ([a-z]+) from ([0-9]{4})/, function (req, res) {
  // you don't have anything in named-param
  console.log(req.params)
  // {}

  // you use req.matches instead
  console.log(req.matches);
  // ['sheep', '2010']
})
```

## Request & response life cycle

In `slack-robot`, receiving and sending message is handled via `Request` and `Response` object. Every time your bot receive a chat, you get `Request` object with typedef below

```
type Request = {
  message: {
    type: string
    value: {}
  },
  from: {
    id: string,
    name: string
  },
  to: {
    id: string,
    type: string, (channel, group, or dm)
    ?name: string // missing if direct message
  }
  params: {},
  matches: []
}
```

For example when you `@anonymous` send the bot `@hola` message `get sheep from 2010 @hola` in `#general` channel

```js
robot.listen('get :animal([a-z\-]+) from :year([0-9]{4})', function (req, res) {
  console.log(req);
  // message: {
  //   type: 'text'
  //   value: {
  //     text: 'get sheep from 2010'
  //     mentioned: true
  //   }
  // },
  // from: {
  //   id: 'your_random_id',
  //   name: 'anonymous'
  // },
  // to: {
  //   id: 'random_channel_id',
  //   name: 'general',
  //   type: 'channel'
  // },
  // params: {
  //   animal: 'sheep',
  //   year: '2010',
  // },
  // matches: []
});
```

To respond a message, use `res` object. You can respond multiple times as you want

```js
robot.listen('yo', function (req, res) {
  /**
   * Send text
   *
   * @param {string} text
   */
  res.text('what\'s up?');

  /**
   * Send attachment
   *
   * @param {string} text in attachment
   * @param {Array<Object>|Object}
   * @see https://api.slack.com/docs/attachments
   */
  res.attachment(text, attachment);

  /**
   * Send file
   *
   * @param {string} filename
   * @param {string|ReadStream} content
   * @see https://nodejs.org/api/fs.html
   */
  res.upload('snippet.txt', fs.createReadStream('snippet.txt'));

  /**
   * Add reaction to the message
   *
   * @param {string} reaction emoji
   */
  res.reaction(':+1:');

  /**
   * Always end your handler by returning res.send
   */
  return res.send();
});
```

Until you call `res.send()`, your message will not be sent. By calling
`res.send()`, it will queue all your response and send them in series. To change this behavior,
change `concurrency` property from robot:

```js
// send 3 response in parallel (this will affect all listener)
// keep in mind that enabling concurrency means the order of the
// message is not guaranteed
robot.set('concurrency', 3);
```

## Custom response target

To respond in another channel/im, simply pass the last argument to `.text()`,
`.attachment()` or `.upload()`, with channel name `#general`, group name `private-group`,
or user name `@anon`, or use an array of string to send multiple target:

```js
robot.listen('yo', function (req, res) {
  res.attachment('here', attachment, '#general');
  res.upload('document.doc', file, '@anon');
  res.text('done!', ['#general', '@anon']);

  // end your request
  return res.send();
});
```

**NOTE: You cannot use custom response target when adding reaction**

## Asynchronous response

Sometimes you want to do some asynchronous task before sending back response, you can
use `res.async()` which accept a callback that receive `send` function as argument.
To end your asynchronous task call `send()` without any argument. If your asynchronous
task failed, call `send()` with an error object:

```js
robot.listen('deploy', function (req, res) {
  res.text('executing scripts..');

  return res.async(function (done) {
    childProcess.exec('~/scripts/deploy --to production', function (err, stdout, stderr) {
      if (err) {
        // return to stop code for reaching res.text
        return done(err);
      }

      // use res.text like usual
      res.text('done, printing stdout:');
      res.text(stdout);
      done();
    });
  // call .send() to send all previous response declared in asynchronous task
  }).send();
})
```

**NOTE: Calling `res.send()` after `res.async()` doesn't send all the response,
because `res.send()` is synchronous. Make sure you call `res.async().send()`
to send the response**

If you already use Promise, you can return your Promise chain instead of using
`res.async`

```js
// es2015 code style
robot.listen('deploy', (req, res) => {
  return deployer().then(output => {
    res.text('done, printing output:');
    res.text(output);
    return res.send();
  })
});
```

## External trigger

You can also send message without having to listen to any message. This is particularly
useful when combined with another service that run asynchronously (for example error
reporting). Use `robot.to()` to get the response object
you usually use when responding message

```js
var ws = require('websocket');

ws.on('message', function (msg) {
  // robot.to() is asynchronous by nature because we need to make sure
  // the bot is connected before you able to send the message
  // hence the use of the callback to get the response object
  robot.to('@anon', function (res) {
    res.text('Hi anon, you got a message');
    res.text(msg);
    return res.send();
  });
});
```

**NOTE: .reaction() and .async() cannot be used here**

## Handling the unexpected

slack-robot will emit event if something happened. Below is the list of events
you can listen to:

- `message_no_sender`, when you receive a message without user information
- `own_message`, when you receive a message from bot itself
- `ignored_channel`, when you receive a message in channel that you ignore via `robot.ignore`
- `no_listener_match`, when you receive a message without matching listener
- `response_failed`, when failed sending a **single** response
- `request_handled`, when a request has been handled
- `error`, general error, usually if your listener callback has uncaught exception

To listen specific event, use `robot.on(message, callback)`. Most event will receive
message object, except `response_failed` and `error` event which receive error object
instead, `request_handled` which receive request object, and `message_no_sender` which receive original message object from slack API

```js
robot.on('error', function (err) {
  // print to stderr, or sent to error reporting service
  console.error(err);
});
```

## Help command generator

When you have many listener, you sometimes forget all your listeners. You can see it
by enabling help generator which will sent you all your listeners. Enable it using `robot.set('help_generator', true)` (it's disabled by default). It will add another listener that will listen to all text message containing "help". So if you send message
to the bot "show help" or "help", it will send you the command list.

## License

MIT
