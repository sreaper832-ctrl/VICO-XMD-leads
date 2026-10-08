// commands/getgpp.js
'use strict';

module.exports = {
  name: 'getgpp',
  aliases: ['gpp', 'grouppp', 'groupprofile'],
  category: 'GROUP-ADMIN',
  description: 'Get the group profile picture',

  async execute(sock, msg, jid, args) {
    // ─── CHECK IF GROUP ──────────────────────────────────────
    if (!jid.endsWith('@g.us')) {
      return sock.sendMessage(jid, { text: '⚠️ This command only works in groups.' });
    }

    await sock.sendMessage(jid, { react: { text: '📸', key: msg.key } }).catch(() => {});

    try {
      // ─── GET GROUP METADATA ──────────────────────────────────
      const meta = await sock.groupMetadata(jid);
      const groupName = meta.subject || 'Group';

      // ─── GET PROFILE PICTURE ──────────────────────────────
      let ppUrl;
      try {
        ppUrl = await sock.profilePictureUrl(jid, 'image');
      } catch (e) {
        ppUrl = null;
      }

      if (!ppUrl) {
        return sock.sendMessage(jid, {
          text: `📸 *${groupName}*\n\n❌ No profile picture found for this group.\n\nThe group may not have set a profile picture.`
        });
      }

      // ─── SEND PROFILE PICTURE ──────────────────────────────
      await sock.sendMessage(jid, {
        image: { url: ppUrl },
        caption: `📸 *Group Profile Picture*\n\n👥 ${groupName}\n🆔 ${jid}\n\n✅ Current group photo.`
      });

    } catch (error) {
      console.error('[getgpp]', error);
      await sock.sendMessage(jid, {
        text: `❌ Error: ${error.message || 'Could not fetch group profile picture.'}`
      });
    }
  }
};