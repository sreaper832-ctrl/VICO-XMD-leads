'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'facepalm',
  aliases: [],
  category: 'facepalm',
  emoji: '🤦',
  verb: 'facepalms at',
  selfVerb: 'facepalms',
});
