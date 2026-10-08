'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'pout',
  aliases: [],
  category: 'pout',
  emoji: '😤',
  verb: 'pouts at',
  selfVerb: 'is pouting',
});
