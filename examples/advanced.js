var fs = require('fs');
var exec = require('child_process').exec;
var Robot = require('..');

var token = process.env.SLACK_TOKEN;
var robot = new Robot(token);

// do not listen anything in #general
robot.ignore('#general');

// responding using reaction
robot.listen('i am smart', function (req, res) {
  return res.react(':joy:').send();
});

// partial regex listener, access using req.params
robot.listen('get me :anything([a-z]+)', function (req, res) {
  return res.text('sorry, I can\'t get you ' + req.params.anything);
});

// pure regex listener, access using req.matches
// asynchronous task using res.async()
robot.listen(/deploy [a-z]+ to [a-z]+/, function (req, res) {
  var branch = req.matches[0];
  var env = req.matches[1];

  // run send to send response synchronously before running async task
  res.text('executing script').send();

  return res.async(function (send) {
    exec('echo "-b ' + branch + ' -e ' + env + '"', function (err, stdout, stderr) {
      if (err) {
        return send(err);
      }

      res.attachment('done', {
        title: 'Deployment log',
        fallback: 'deployment success',
        text: stdout,
        color: 'success'
      });
      send();
    });
  });
});

// sending multiple response type in the same time
robot.set('concurrency', 5);
robot.listen('multiple response', function (req, res) {
  res.text('Just a text');

  var filename = 'advanced.js';
  res.upload(filename, fs.createReadStream(filename));

  res.attachment('here it is', {
    title: 'Sample attachment',
    text: 'optional text inside attachment',
    color: 'warning',
    fallback: 'text on notif screen',
    fields: [
      {
        title: 'Priority',
        value: 'Medium',
        short: false
      }
    ]
  });

  res.reaction(':joy:');

  res.text('race condition');

  return res.send();
});

// listen to event when no listener matches
robot.on('no_listener_match', function (msg) {
  console.log('unhandled', msg);
});

// listen to event when message is ignored
robot.on('ignored_channel', function (msg) {
  console.log('ignored', msg);
});

// listen to event when an error occurs
robot.on('error', function (err) {
  console.error(err);
});

robot.start();
