'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'shrug',
  aliases: [],
  category: 'shrug',
  emoji: '🤷',
  verb: 'shrugs at',
  selfVerb: 'shrugs',
});
