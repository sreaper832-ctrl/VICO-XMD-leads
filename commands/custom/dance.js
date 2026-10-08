'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'dance',
  aliases: [],
  category: 'dance',
  emoji: '💃',
  verb: 'dances with',
  selfVerb: 'starts dancing',
});
