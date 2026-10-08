'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'carry',
  aliases: [],
  category: 'carry',
  emoji: '🫂',
  verb: 'carries',
  selfVerb: 'wants to be carried',
});
