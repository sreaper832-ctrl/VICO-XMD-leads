'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'handshake',
  aliases: [],
  category: 'handshake',
  emoji: '🤝',
  verb: 'shakes hands with',
  selfVerb: 'offers a handshake',
});
