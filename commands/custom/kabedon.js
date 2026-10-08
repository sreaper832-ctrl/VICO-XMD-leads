'use strict';
const { makeReactionCommand } = require('../lib/reactions');

module.exports = makeReactionCommand({
  name: 'kabedon',
  aliases: [],
  category: 'kabedon',
  emoji: '🫣',
  verb: 'kabedons',
  selfVerb: 'strikes a pose',
});
