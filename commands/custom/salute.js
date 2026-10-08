'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'salute',
  aliases: [],
  category: 'salute',
  emoji: '🫡',
  verb: 'salutes',
  selfVerb: 'salutes proudly',
});
