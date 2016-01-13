export function stripEmoji(emoji) {
  return emoji.replace(/:?([^:]+):?/, '$1');
}

export function getFileExtension(filename) {
  return filename.replace(/.*\.([a-z0-9]+)$/, '$1');
}
