'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'run',
  aliases: [],
  category: 'run',
  emoji: '🏃',
  verb: 'runs away from',
  selfVerb: 'starts running',
});
