'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'bite',
  aliases: [],
  category: 'bite',
  emoji: '😬',
  verb: 'bites',
  selfVerb: 'bites the air',
});
