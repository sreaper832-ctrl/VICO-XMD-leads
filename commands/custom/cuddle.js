'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'cuddle',
  aliases: [],
  category: 'cuddle',
  emoji: '🥰',
  verb: 'cuddles',
  selfVerb: 'wants to cuddle',
});
