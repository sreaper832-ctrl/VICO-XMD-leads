'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'pat',
  aliases: [],
  category: 'pat',
  emoji: '🖐️',
  verb: 'pats',
  selfVerb: 'pats themselves',
});
