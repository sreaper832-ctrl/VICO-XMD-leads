'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'clap',
  aliases: [],
  category: 'clap',
  emoji: '👏',
  verb: 'claps for',
  selfVerb: 'starts clapping',
});
