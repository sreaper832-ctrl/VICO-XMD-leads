'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'blush',
  aliases: [],
  category: 'blush',
  emoji: '😳',
  verb: 'blushes at',
  selfVerb: 'is blushing',
});
