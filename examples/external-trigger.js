// in real app require('slack-robot') instead
var Robot = require('..');

var token = process.env.SLACK_TOKEN;
var robot = new Robot(token);

setTimeout(function () {
  robot.to('@johndoe', function (res) {
    res.text('hi john').send();
  });
}, 1000);

robot.start();
