'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'stare',
  aliases: [],
  category: 'stare',
  emoji: '👀',
  verb: 'stares at',
  selfVerb: 'is staring off',
});
