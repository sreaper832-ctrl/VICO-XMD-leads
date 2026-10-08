'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'highfive',
  aliases: ["hifive"],
  category: 'highfive',
  emoji: '🙌',
  verb: 'high-fives',
  selfVerb: 'wants a high-five',
});
