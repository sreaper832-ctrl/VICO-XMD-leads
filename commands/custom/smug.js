'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'smug',
  aliases: [],
  category: 'smug',
  emoji: '😏',
  verb: 'is smug at',
  selfVerb: 'looks smug',
});
