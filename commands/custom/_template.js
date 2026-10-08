'use strict';

// Copy this file to commands/custom/yourcommand.js and edit it.
// No changes to core/case.js are required.
module.exports = {
  name: 'yourcommand',
  aliases: [],
  description: 'What this command does.',
  async execute({ sock, message, jid, args, text, prefix, reply, isGroup, isCreator, isAdmins, isBotAdmins }) {
    await reply(`Hello from ${prefix}yourcommand!\nArguments: ${args.join(' ') || 'none'}`);
  }
};
