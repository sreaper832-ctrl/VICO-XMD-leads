'use strict';

/**
 * .lyrics <song or artist - title>
 * Uses ZUKO /v1/lyrics
 *
 * Env: ZUKO_API_BASE, ZUKO_API_KEY
 */

const axios = require('axios');

const ZUKO_BASE = (
  process.env.ZUKO_API_BASE ||
  'https://web-production-78afd6.up.railway.app'
).replace(/\/$/, '');
const ZUKO_KEY = process.env.ZUKO_API_KEY || 'zuko_Vi-Oo2fpkgAYuU8vnY-8JbnTsNNn-k5O';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function headers() {
  const h = { 'User-Agent': UA, Accept: 'application/json' };
  if (ZUKO_KEY) {
    h.Authorization = `Bearer ${ZUKO_KEY}`;
    h['x-api-key'] = ZUKO_KEY;
  }
  return h;
}

function chunkText(text, max = 3500) {
  const s = String(text || '');
  if (s.length <= max) return [s];
  const parts = [];
  let i = 0;
  while (i < s.length) {
    parts.push(s.slice(i, i + max));
    i += max;
  }
  return parts;
}

module.exports = {
  name: 'lyrics',
  aliases: ['lyric', 'ly', 'lirik'],
  category: 'SEARCH',
  description: '📜 Get song lyrics',
  premium: false,

  async execute(sock, msg, jid, args) {
    const q = args.join(' ').trim();
    if (!q) {
      return sock.sendMessage(
        jid,
        {
          text: '📜 *Usage:* `.lyrics <song>`\n\nExample: `.lyrics faded alan walker`\n`.lyrics Alan Walker - Faded`',
        },
        { quoted: msg }
      );
    }

    await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }).catch(() => {});

    try {
      const res = await axios.get(`${ZUKO_BASE}/v1/lyrics`, {
        params: { q },
        headers: headers(),
        timeout: 30000,
        validateStatus: () => true,
      });

      const body = res.data;
      if (res.status === 404 || body?.status === false) {
        throw new Error(body?.error || 'Lyrics not found.');
      }
      if (res.status >= 400) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }

      const r = body?.result || body;
      const head = `📜 *${r.title || q}*\n👤 ${r.artist || 'Unknown'}${
        r.album ? `\n💿 ${r.album}` : ''
      }\n📡 ${r.source || 'vico'}\n\n`;

      if (r.instrumental && !r.lyrics) {
        await sock.sendMessage(jid, { text: head + '_Instrumental — no lyrics._' }, { quoted: msg });
      } else {
        const chunks = chunkText(r.lyrics || '');
        for (let i = 0; i < chunks.length; i++) {
          const text = i === 0 ? head + chunks[i] : chunks[i];
          await sock.sendMessage(jid, { text }, { quoted: msg });
        }
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error('[lyrics]', err.message);
      await sock.sendMessage(
        jid,
        { text: `❌ *Lyrics failed*\n${err.message || err}` },
        { quoted: msg }
      );
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
    }
  },
};
