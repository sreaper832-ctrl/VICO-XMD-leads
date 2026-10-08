'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'yeet',
  aliases: [],
  category: 'yeet',
  emoji: '🚀',
  verb: 'yeets',
  selfVerb: 'is yeeting stuff',
});
