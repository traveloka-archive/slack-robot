// in real app require('slack-robot') instead
var Robot = require('..');

var token = process.env.SLACK_TOKEN;
var robot = new Robot(token);

robot.listen('hello', function (req, res) {
  return res.text('world').send();
});

robot.start();
