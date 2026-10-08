'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'slap',
  aliases: [],
  category: 'slap',
  emoji: '👋',
  verb: 'slaps',
  selfVerb: 'slaps the air',
});
