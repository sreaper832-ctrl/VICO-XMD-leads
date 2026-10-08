'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'kiss',
  aliases: [],
  category: 'kiss',
  emoji: '😘',
  verb: 'kisses',
  selfVerb: 'blows a kiss into the air',
});
