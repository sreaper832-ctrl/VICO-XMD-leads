'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'bleh',
  aliases: [],
  category: 'bleh',
  emoji: '😝',
  verb: 'blehs at',
  selfVerb: 'sticks out their tongue',
});
