'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'punch',
  aliases: [],
  category: 'punch',
  emoji: '👊',
  verb: 'punches',
  selfVerb: 'throws a punch',
});
