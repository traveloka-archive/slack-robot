// in real app require('slack-robot') instead
/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
/* eslint prefer-template: 0 */
var fs = require('fs');
var Promise = require('bluebird');
var Robot = require('..');

var token = process.env.SLACK_TOKEN;
var robot = new Robot(token);

// enable help command
robot.set('help_generator', true);

// ignore all message in this channel
robot.ignore('#bot-playground');

// listen to text message
robot.listen('text', function (req, res) {
  var username = req.user.name;
  return res.text('string with @' + username + ', #general, and @everyone').send();
});

// all url protocol will be stripped
robot.listen('staging05.example.com', function (req, res) {
  res.text('www-staging05.example.com');
  return res.text('remove http(s) protocol from url').send();
});

// send text with attachment
robot.listen('attachment', function (req, res) {
  const attachment = {
    fallback: 'envelope',
    title: 'Mailbox',
    text: 'You got a new mailbox',
    color: 'warning',
    fields: [
      {
        title: 'Priority',
        value: 'Medium',
        short: false
      }
    ]
  };
  return res.attachment('envelope', attachment).send();
});

robot.listen('attach', function (req, res) {
  const attachment = {
    fallback: 'attachment received',
    title: 'No-text attachment',
    text: 'You got an attachment without text',
    color: 'good',
    fields: [
      {
        title: 'Priority',
        value: 'High',
        short: false
      }
    ]
  };
  return res.attachment(attachment).send();
});

// respond using reaction
robot.listen('reaction', function (req, res) {
  return res.reaction(':joy:').send();
});

// upload a file using Readable Stream
// simple string will also works
robot.listen('upload :filename([a-zA-Z\-\.]+)', function (req, res) {
  var filename = req.params.filename;

  if (filename === 'this-script') {
    return res.upload(filename, fs.createReadStream('example/index.js')).send();
  }

  return res.upload(filename, fs.createReadStream('example/' + filename)).send();
});

// respond to reaction
robot.when('reaction_added', '+1', function (req, res) {
  return res.text(`thank you @${req.user.name}`).send();
});

// run async function after receiving message
robot.listen('async', function (req, res) {
  return res.async(function (done) {
    setTimeout(function () {
      res.text('receive after 5 sec');
      done();
    }, 5000);
  }).send();
});

// return a Promise
robot.listen('promise', function (req, res) {
  return new Promise(resolve => {
    setTimeout(function () {
      resolve('5 seconds promise');
    }, 5000);
  }).then(text => {
    res.text(text);
    return res.send();
  });
});

// send multiple message as once
robot.set('concurrency', 10);
robot.listen('concurrency', function (req, res) {
  res.text('1');
  res.text('2');
  res.text('3');
  res.text('4');
  res.text('5');
  res.text('6');
  res.text('7');
  res.text('8');
  res.text('9');
  res.text('10');
  return res.send();
});

// listen using pure regex
robot.listen(/pure regex ([a-z]+)/gi, function (req, res) {
  // also uses 10 concurrency
  res.text('much regex');
  res.text('so ' + req.matches[0]);
  res.text('such purity');
  res.text('wow bot');
  return res.send();
});

// manually trigger error
robot.listen('exception', function (req, res) {
  throw new Error('manual trigger');
});

// manually send message
robot.to('@username', function (res) {
  return res.text('hello').send();
});

robot.on('own_message', function (message) {
  // everytime bot send message, it will also receive
  // its own message, listen to this event if you want
  // to do something after receiving its own message
});

robot.on('message_no_sender', function (message) {
  console.log('no_sender', message);
});

robot.on('ignored_channel', function (message) {
  console.log('ignored_channel', message);
});

robot.on('no_listener_match', function (message) {
  console.log('no_listener_match');
});

robot.on('response_failed', function (err) {
  console.log('response_failed', err.stack);
});

robot.on('error', function (err) {
  console.log('error', err.stack);
});

robot.on('message_handled', function (message) {
  // after response sent
  console.log('handled', message.value);
});

robot.start();
