export default function dynamicMentionAcl(req, res, next) {
  if (req.channel.type === 'dm') {
    // no need to mention in
    return next();
  }

  // besides dm, you need to mention bot
  if (req.message.value.mentioned) {
    next();
  }
}
