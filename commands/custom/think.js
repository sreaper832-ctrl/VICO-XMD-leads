'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'think',
  aliases: [],
  category: 'think',
  emoji: '🤔',
  verb: 'thinks about',
  selfVerb: 'is thinking',
});
