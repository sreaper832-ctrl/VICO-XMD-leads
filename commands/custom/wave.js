'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'wave',
  aliases: [],
  category: 'wave',
  emoji: '👋',
  verb: 'waves at',
  selfVerb: 'waves hello',
});
