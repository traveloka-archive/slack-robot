export function stripEmoji(emoji) {
  const noTagEmoji = emoji.replace(/:?([^:]+):?/, '$1');
  return noTagEmoji.replace(/:+skin-tone.*/, '');
}

export function getFileExtension(filename) {
  return filename.replace(/.*\.([a-z0-9]+)$/, '$1');
}
