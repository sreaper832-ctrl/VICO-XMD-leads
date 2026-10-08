'use strict';

/**
 * .play — YouTube → audio via ZUKO /v1/ytmp3
 * Sends as MUSIC file (audio/mp4), NOT voice note / PTT
 *
 * Env: ZUKO_API_BASE, ZUKO_API_KEY
 */

const axios = require('axios');
const yts = require('yt-search');

const ZUKO_BASE = (
  process.env.ZUKO_API_BASE ||
  process.env.YTDLP_API_BASE ||
  'https://web-production-78afd6.up.railway.app'
).replace(/\/$/, '');

const ZUKO_KEY = process.env.ZUKO_API_KEY || process.env.YTDLP_API_KEY || '';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function cleanFileName(name) {
  return (
    String(name || 'audio')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'audio'
  );
}

function isYoutubeUrl(value) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(
    String(value || '').trim()
  );
}

function apiHeaders() {
  const h = { 'User-Agent': UA, Accept: 'application/json' };
  if (ZUKO_KEY) {
    h.Authorization = `Bearer ${ZUKO_KEY}`;
    h['x-api-key'] = ZUKO_KEY;
  }
  return h;
}

async function zukoYtmp3(videoUrl) {
  if (!ZUKO_BASE) throw new Error('VICO_API_BASE is not configured.');

  const res = await axios.get(`${ZUKO_BASE}/v1/ytmp3`, {
    params: { url: videoUrl },
    headers: apiHeaders(),
    timeout: 120000,
    validateStatus: () => true,
  });

  const body = res.data;
  if (res.status === 401 || res.status === 403) {
    throw new Error('VICO API auth failed. Check VICO_API_KEY.');
  }
  if (res.status >= 400 || body?.status === false) {
    throw new Error(body?.error || body?.message || `VICO ytmp3 HTTP ${res.status}`);
  }

  const result = body?.result || body?.data || body;
  const downloadUrl =
    result?.download_url || result?.url || result?.link || body?.download_url;

  if (!downloadUrl) throw new Error('ZUKO ytmp3 returned no download_url.');

  return {
    title: result?.title || body?.title || 'audio',
    download_url: downloadUrl,
  };
}

/** Fetch bytes — try direct URL, then ZUKO stream proxy */
async function fetchAudioBuffer(videoUrl, fileUrl) {
  const tryUrls = [fileUrl];

  for (const u of tryUrls) {
    try {
      const r = await axios.get(u, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxRedirects: 5,
        headers: {
          'User-Agent': UA,
          Accept: '*/*',
          Referer: 'https://save-tube.com/',
          Origin: 'https://save-tube.com',
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const buf = Buffer.from(r.data);
      if (buf.length >= 5000) return buf;
    } catch (_) {}
  }

  // Fallback: ZUKO proxies the file (?stream=1)
  const streamRes = await axios.get(`${ZUKO_BASE}/v1/ytmp3`, {
    params: { url: videoUrl, stream: '1' },
    headers: { ...apiHeaders(), Accept: '*/*' },
    responseType: 'arraybuffer',
    timeout: 180000,
    validateStatus: () => true,
  });
  if (streamRes.status >= 400) {
    throw new Error(`Audio download failed (HTTP ${streamRes.status}).`);
  }
  const buf = Buffer.from(streamRes.data);
  if (buf.length < 5000) throw new Error('Downloaded audio is empty or corrupted.');
  return buf;
}

module.exports = {
  name: 'play',
  aliases: ['song', 'music', 'p'],
  category: 'DOWNLOAD',
  description: '🎵 YouTube audio as music file (not voice note)',
  premium: false,

  async execute(sock, msg, jid, args) {
    const query = args.join(' ').trim();

    if (!query) {
      return sock.sendMessage(
        jid,
        {
          text: '🎵 *Usage:* `.play <song name or YouTube URL>`\n\nExample: `.play faded`',
        },
        { quoted: msg }
      );
    }

    await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }).catch(() => {});

    try {
      let video;

      if (isYoutubeUrl(query)) {
        video = {
          url: query.startsWith('http') ? query : `https://${query}`,
          title: 'YouTube Audio',
          thumbnail: '',
          timestamp: '',
          views: 0,
        };
      } else {
        const search = await yts(query);
        video = search?.videos?.[0];
        if (!video?.url) throw new Error('No YouTube results found for that song.');
      }

      const title = video.title || query;
      const thumbnail = video.thumbnail || '';
      const videoUrl = video.url;

      const caption =
        `🎵 *${title}*\n` +
        (video.timestamp ? `⏱️ ${video.timestamp}` : '') +
        (video.views ? `  •  👁️ ${Number(video.views).toLocaleString()}` : '') +
        `\n\n⏳ *Downloading via VICO…*`;

      if (thumbnail) {
        await sock.sendMessage(jid, { image: { url: thumbnail }, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      }

      const meta = await zukoYtmp3(videoUrl);
      const audioBuffer = await fetchAudioBuffer(videoUrl, meta.download_url);
      const fileName = `${cleanFileName(meta.title || title)}.mp3`;

      // MUSIC file — not WhatsApp voice note (PTT)
      // audio/mp4 + ptt:false = playable music track in chat
      await sock.sendMessage(
        jid,
        {
          audio: audioBuffer,
          mimetype: 'audio/mp4',
          fileName,
          ptt: false,
        },
        { quoted: msg }
      );

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
    } catch (error) {
      console.error('[play]', error.message);
      await sock.sendMessage(
        jid,
        { text: `❌ *Play failed*\n${error.message || error}` },
        { quoted: msg }
      );
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
    }
  },
};
