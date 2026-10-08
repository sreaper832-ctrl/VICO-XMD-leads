'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'happy',
  aliases: [],
  category: 'happy',
  emoji: '😄',
  verb: 'cheers for',
  selfVerb: 'is happy',
});
