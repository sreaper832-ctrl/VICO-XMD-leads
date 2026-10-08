'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'spin',
  aliases: [],
  category: 'spin',
  emoji: '🌀',
  verb: 'spins with',
  selfVerb: 'starts spinning',
});
