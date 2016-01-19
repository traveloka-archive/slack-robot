const FILENAME = 'command-list.txt';
const COMMAND_DESCRIPTION = 'Show this message';

/**
 * @param {Array<Listener>} listeners
 * @return {string}
 */
function generateHelp(listeners) {
  let helpText = '';

  listeners.forEach(listener => {
    const listenerType = listener.value instanceof RegExp ? `${listener.type} (regex)` : listener.type;
    const listenerValue = listener.type === 'reaction_added' ? listener.value.toString().replace('\\', '') : listener.value.toString();
    helpText += `type: ${listenerType}\n`;
    helpText += `command: ${listenerValue}\n`;
    helpText += `description: ${listener.description === '' ? '-' : listener.description}\n\n`;
  });

  return helpText.trim();
}

let helpListener;

export default function helpGenerator(opts) {
  return function plugin(robot) {
    if (opts.enable) {
      helpListener = robot.listen(/help/, (req, res) => {
        const helpText = generateHelp(robot.getAllListeners());
        return res.upload(FILENAME, helpText).send();
      })
      .desc(COMMAND_DESCRIPTION)
      .acl(robot.acls.dynamicMention);
    } else if (helpListener) {
      robot.removeListener(helpListener.id);
    }
  };
}
