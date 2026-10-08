'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'angry',
  aliases: [],
  category: 'angry',
  emoji: '😠',
  verb: 'is angry at',
  selfVerb: 'is fuming',
});
