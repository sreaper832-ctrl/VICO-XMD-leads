'use strict';

const { loadCommands, listCommands } = require('../../lib/commandLoader');

module.exports = {
  name: 'reloadcommands',
  aliases: ['reloadcmds'],
  description: 'Reload modular command files.',
  async execute({ reply, isCreator }) {
    if (!isCreator) return reply('🔒 *Owner only.*');
    loadCommands(true);
    await reply(`✅ *COMMANDS RELOADED*\n\nLoaded: *${listCommands().length}* modular command(s).`);
  }
};
