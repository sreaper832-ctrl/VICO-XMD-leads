'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'poke',
  aliases: [],
  category: 'poke',
  emoji: '👉',
  verb: 'pokes',
  selfVerb: 'pokes the air',
});
