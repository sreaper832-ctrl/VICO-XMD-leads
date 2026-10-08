'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'baka',
  aliases: [],
  category: 'baka',
  emoji: '💢',
  verb: 'calls',
  selfVerb: 'is being a baka',
});
