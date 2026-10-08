'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'bonk',
  aliases: [],
  category: 'bonk',
  emoji: '🔨',
  verb: 'bonks',
  selfVerb: 'bonks the air',
});
