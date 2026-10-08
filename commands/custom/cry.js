'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'cry',
  aliases: [],
  category: 'cry',
  emoji: '😭',
  verb: 'cries because of',
  selfVerb: 'is crying',
});
