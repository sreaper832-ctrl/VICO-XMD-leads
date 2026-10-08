'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'wink',
  aliases: [],
  category: 'wink',
  emoji: '😉',
  verb: 'winks at',
  selfVerb: 'winks',
});
