/* eslint no-console:0 */

const Robot = require('..');

const { EVENTS } = Robot;

const token = process.env.SLACK_TOKEN;
if (!token) {
    console.error('Please provide Slack Token via env param SLACK_TOKEN. Exiting...');
    process.exit(0);
}

const robot = new Robot(token);
const rtmClient = robot._rtm; // eslint-disable-line no-underscore-dangle

// disable help command
robot.set('help_generator', false);

rtmClient.on('authenticated', (data) => {
    console.log('*** rtmConnect response received: ', data);
    console.log('*** Connected and authenticated. Congrats!');
    process.exit(0);
});

robot.on(EVENTS.ERROR, (err) => {
    console.log('error', err.stack);
    process.exit(1);
});

robot.start();
