'use strict';

module.exports = {
  name: 'setprefix',
  aliases: ['prefix'],
  description: 'Change the bot command prefix or disable it with null.',
  async execute({ sock, message, args, reply, isCreator, botNumber }) {
    if (!isCreator) {
      return reply('❌ Only the bot owner can change the prefix.');
    }

    const { getSetting, setSetting } = require('../../config/setting/Settings.js');
    const key = botNumber || sock?.user?.id || 'bot';
    const current = getSetting(key, 'prefix', '.');
    const value = String(args?.[0] ?? '').trim();

    if (!value) {
      const shown = current === null ? 'NULL (disabled)' : `"${current}"`;
      return reply(`⚙️ *PREFIX SETTINGS*\n\nCurrent prefix: *${shown}*\n\nUsage:\n• ${current === null ? '' : current}setprefix <symbol>\n• ${current === null ? '' : current}setprefix null\n\nExample: setprefix !`);
    }

    if (/^(null|none|off|disable|disabled)$/i.test(value)) {
      setSetting(key, 'prefix', null);
      return reply('✅ *Prefix disabled.*\n\nCommands can now be used without a prefix.\nTo enable one again, use `setprefix .` (or another symbol).');
    }

    if (/\s/.test(value) || value.length > 3) {
      return reply('❌ Prefix must be 1–3 non-space characters, or use `setprefix null` to disable it.');
    }

    setSetting(key, 'prefix', value);
    return reply(`✅ *Prefix updated.*\n\nNew prefix: *${value}*\nExample: ${value}menu`);
  }
};
