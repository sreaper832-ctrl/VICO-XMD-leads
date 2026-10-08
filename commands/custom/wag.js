'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'wag',
  aliases: [],
  category: 'wag',
  emoji: '🐾',
  verb: 'wags at',
  selfVerb: 'starts wagging',
});
