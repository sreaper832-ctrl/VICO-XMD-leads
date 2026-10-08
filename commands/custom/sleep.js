'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'sleep',
  aliases: [],
  category: 'sleep',
  emoji: '😴',
  verb: 'sleeps beside',
  selfVerb: 'is going to sleep',
});
