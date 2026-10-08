'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'tickle',
  aliases: [],
  category: 'tickle',
  emoji: '🤭',
  verb: 'tickles',
  selfVerb: 'wiggles their fingers',
});
