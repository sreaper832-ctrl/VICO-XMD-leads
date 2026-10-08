// commands/ssweb.js
'use strict';

const axios = require('axios');

const API = 'https://apis.davidcyril.name.ng/ssweb';

function normaliseUrl(input) {
  let value = String(input || '').trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

module.exports = {
  name: 'ssweb',
  aliases: ['screenshot', 'webshot', 'capture'],
  category: 'TOOLS',
  description: '📸 Take a screenshot of any website',
  premium: false,

  async execute(sock, msg, jid, args = []) {
    const targetUrl = normaliseUrl(args.join(' '));

    if (!targetUrl) {
      return sock.sendMessage(jid, {
        text: '📸 *Website Screenshot*\n\n📌 Usage: .ssweb <URL>\n\n📝 Examples:\n.ssweb google.com\n.ssweb https://github.com'
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { react: { text: '📸', key: msg.key } }).catch(() => {});
    await sock.sendMessage(jid, { text: `⏳ Capturing ${targetUrl}...` }, { quoted: msg });

    try {
      const response = await axios.get(API, {
        params: { url: targetUrl },
        responseType: 'arraybuffer',
        timeout: 45000,
        maxContentLength: 20 * 1024 * 1024,
        validateStatus: () => true,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const buffer = Buffer.from(response.data);
      const contentType = String(response.headers['content-type'] || '').toLowerCase();

      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
      const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8;

      if (response.status !== 200 || !contentType.startsWith('image/') || (!isPng && !isJpg)) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(buffer.toString('utf8'));
          errMsg = parsed?.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const sizeKB = (buffer.length / 1024).toFixed(1);

      await sock.sendMessage(jid, {
        image: buffer,
        mimetype: isPng ? 'image/png' : 'image/jpeg',
        caption: `📸 *Website Screenshot*\n\n🔗 ${targetUrl}\n📦 ${sizeKB} KB`
      }, { quoted: msg });

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
    } catch (error) {
      console.error('[ssweb]', error.message);
      await sock.sendMessage(jid, {
        text: `❌ Screenshot failed\n\n${error.message}`
      }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
    }
  },
};