'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'smile',
  aliases: [],
  category: 'smile',
  emoji: '😊',
  verb: 'smiles at',
  selfVerb: 'is smiling',
});
