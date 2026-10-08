'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'hug',
  aliases: [],
  category: 'hug',
  emoji: '🤗',
  verb: 'hugs',
  selfVerb: 'wants a hug',
});
