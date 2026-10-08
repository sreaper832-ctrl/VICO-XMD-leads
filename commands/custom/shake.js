'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'shake',
  aliases: [],
  category: 'shake',
  emoji: '🫨',
  verb: 'shakes',
  selfVerb: 'starts shaking',
});
