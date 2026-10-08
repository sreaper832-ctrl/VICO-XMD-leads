'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'yawn',
  aliases: [],
  category: 'yawn',
  emoji: '🥱',
  verb: 'yawns at',
  selfVerb: 'lets out a yawn',
});
