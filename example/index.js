/* eslint prefer-template: 0 */
/* eslint no-console: 0 */
const fs = require('fs');

// in real app require('slack-robot') instead
const Robot = require('..');

const { EVENTS } = Robot;

const token = process.env.SLACK_TOKEN;
const robot = new Robot(token);

// enable help command
robot.set('help_generator', true);

// ignore all message in this channel
robot.ignore('#bot-playground');

// listen to text message
robot.listen('text', (req, res) => {
    const username = req.user.name;

    if (req.channel.type === 'dm') {
        res.text('string with @' + username + ', #general, and @everyone');
        return res.send();
    }
    return res.text('string @' + username + ' #bot-playground').send();
});

// all url protocol will be stripped
robot.listen('staging05.example.com', (req, res) => {
    res.text('www-staging05.example.com');
    return res.text('remove http(s) protocol from url').send();
});

// send text with attachment
robot.listen('attachment', (req, res) => {
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

robot.listen('attach', (req, res) => {
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
robot.listen('reaction', (req, res) => {
    return res.reaction(':joy:').send();
});

// upload a file using Readable Stream
// simple string will also works
// eslint-disable-next-line no-useless-escape
robot.listen('upload :filename([a-zA-Z\-\.]+)', (req, res) => {
    const { filename } = req.params;

    if (filename === 'this-script') {
        return res.upload(filename, fs.createReadStream('example/index.js')).send();
    }

    return res.upload(filename, fs.createReadStream('example/' + filename)).send();
});

// respond to reaction
robot.when('reaction_added', '+1', (req, res) => {
    return res.text(`thank you @${req.user.name}`).send();
});

// run async function after receiving message
robot.listen('async', (req, res) => {
    return res.async((done) => {
        setTimeout(() => {
            res.text('receive after 5 sec');
            done();
        }, 5000);
    }).send();
});

// return a Promise
robot.listen('promise', (req, res) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve('5 seconds promise');
        }, 5000);
    }).then(text => {
        res.text(text);
        return res.send();
    });
});

// listen with acl
robot.listen('acl', (req, res) => {
    res.text('responded').send();
    // only respond in channel/group if mentioned
}).acl(robot.acls.dynamicMention);

// send multiple message as once
robot.set('concurrency', 10);
robot.listen('concurrency', (req, res) => {
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
robot.listen(/pure regex ([a-z]+)/gi, (req, res) => {
    // also uses 10 concurrency
    res.text('much regex');
    res.text('so ' + req.matches[0]);
    res.text('such purity');
    res.text('wow bot');
    return res.send();
});

// manually trigger error
robot.listen('exception', (/* req, res */) => {
    throw new Error('manual trigger');
});

robot.listen('multiple target', (req, res) => {
    return res.text('multi', '#channel', '@user').send();
});

robot.listen('mpim', (req, res) => {
    return res.text('mpim', ['@user1', '@user2']);
});

// manually send message
robot.to('@username', (res) => {
    return res.text('hello').send();
});

robot.on(EVENTS.OWN_MESSAGE, (/* message */) => {
    // everytime bot send message, it will also receive
    // its own message, listen to this event if you want
    // to do something after receiving its own message
});

robot.on(EVENTS.MESSAGE_NO_SENDER, (message) => {
    console.log('no_sender', message);
});

robot.on(EVENTS.IGNORED_CHANNEL, (message) => {
    console.log('ignored_channel', message);
});

robot.on(EVENTS.NO_LISTENER_MATCH, (/* message */) => {
    console.log('no_listener_match');
});

robot.on(EVENTS.RESPONSE_FAILED, (err) => {
    console.log('response_failed', err.stack);
});

robot.on(EVENTS.ERROR, (err) => {
    console.log('error', err.stack);
});

robot.on(EVENTS.REQUEST_HANDLED, (message) => {
    // after response sent
    console.log('handled', message.value);
});

robot.start();
