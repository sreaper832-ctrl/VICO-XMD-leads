'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'confused',
  aliases: [],
  category: 'confused',
  emoji: '😵\u200d💫',
  verb: 'is confused by',
  selfVerb: 'is confused',
});
