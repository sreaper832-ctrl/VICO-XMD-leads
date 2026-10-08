'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'peck',
  aliases: [],
  category: 'peck',
  emoji: '😘',
  verb: 'pecks',
  selfVerb: 'blows a tiny kiss',
});
