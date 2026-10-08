'use strict';

const { listCommands } = require('../../lib/commandLoader');

module.exports = {
  name: 'commands',
  aliases: ['customcommands'],
  description: 'List modular commands installed in commands/custom.',
  async execute({ reply, prefix }) {
    const names = listCommands();
    if (!names.length) return reply('📦 *CUSTOM COMMANDS*\n\nNo modular commands installed.\n\nAdd one to commands/custom/.');
    await reply(`📦 *CUSTOM COMMANDS*\n\n${names.map(n => `• ${prefix}${n}`).join('\n')}\n\n💡 Add commands in commands/custom/ without editing core/case.js.`);
  }
};
