'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'shoot',
  aliases: [],
  category: 'shoot',
  emoji: '🔫',
  verb: 'pretends to shoot',
  selfVerb: 'points dramatically',
});
