// commands/aio.js
'use strict';

const axios = require('axios');

const PREXZY = 'https://prexzyapis.com/download';
const DAVIDCYRIL = 'https://apis.davidcyril.name.ng/download';
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// ─── PLATFORM DETECTION ──────────────────────────────────
function detectPlatform(url) {
  if (/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(url)) return 'tiktok';
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/facebook\.com|fb\.watch/i.test(url)) return 'facebook';
  if (/snapchat\.com|snap\.chat/i.test(url)) return 'snapchat';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/twitter\.com|x\.com/i.test(url)) return 'twitter';
  return null;
}

// ─── SHORT-LINK RESOLVER ─────────────────────────────────
async function resolveShortUrl(url) {
  // TikTok short links
  if (/(vt|vm)\.tiktok\.com/i.test(url)) {
    try {
      const res = await axios.get(url, {
        maxRedirects: 0,
        timeout: 10000,
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      return res.headers?.location || url;
    } catch (e) {
      return e.response?.headers?.location || url;
    }
  }
  // Snapchat /t/ links — follow redirect to canonical Snap URL
  if (/snapchat\.com\/t\//i.test(url)) {
    try {
      const res = await axios.get(url, {
        maxRedirects: 0,
        timeout: 10000,
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      return res.headers?.location || url;
    } catch (e) {
      return e.response?.headers?.location || url;
    }
  }
  return url;
}

// ─── PREXZY FETCH ────────────────────────────────────────
async function fetchPrexzy(platform, url) {
  // Dedicated endpoints where they exist.
  // Snapchat and YouTube go through aiov2 (all-in-one).
  const route = {
    tiktok: 'tiktok',
    instagram: 'instagram',
    facebook: 'facebook',
    snapchat: 'aiov2',
    youtube: 'aiov2',
  }[platform];

  if (!route) return null;

  const { data } = await axios.get(`${PREXZY}/${route}`, {
    params: { url },
    timeout: 45000,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });

  if (!data?.status) {
    const err = new Error(data?.error || data?.msg || data?.message || 'API failed');
    err.apiCode = data?.msg;
    err.apiStatus = data?.statusCode;
    throw err;
  }

  const payload = data.data || data.media || data.result;
  if (!payload || (data.msg && /PRIVATE|UNAVAILABLE|NOT_FOUND/i.test(data.msg))) {
    const err = new Error(data?.msg || 'No media returned');
    err.apiCode = data?.msg;
    throw err;
  }

  return payload;
}

// ─── NORMALIZE ───────────────────────────────────────────
function normalizeResult(raw, platform) {
  const out = {
    title: 'Media',
    thumbnail: '',
    author: '',
    duration: '',
    video: null,
    audio: null,
    image: null,
  };

  if (!raw) return out;

  // ── TikTok ──
  if (platform === 'tiktok') {
    out.video = raw.hdplay || raw.play || raw.wmplay || null;
    out.audio = raw.music || raw.music_info?.play || null;
    out.title = raw.title || raw.content_desc?.[0] || 'TikTok Video';
    out.thumbnail = raw.cover || raw.origin_cover || '';
    out.author = raw.author?.unique_id || raw.author?.nickname || '';
    out.duration = raw.duration ? `${raw.duration}s` : '';
    return out;
  }

  // ── Instagram ──
  if (platform === 'instagram') {
    const list = Array.isArray(raw) ? raw : (raw.media || []);
    const videos = list.filter((m) => /video/i.test(m.type || ''));
    const images = list.filter((m) => /image|photo/i.test(m.type || ''));
    const bestVideo = videos.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    if (bestVideo) out.video = bestVideo.url;
    if (images[0]) out.image = images[0].url;
    out.title = 'Instagram Media';
    return out;
  }

  // ── Facebook ──
  if (platform === 'facebook') {
    out.video = raw.hd || raw.sd || null;
    out.title = raw.title || 'Facebook Video';
    out.thumbnail = raw.thumbnail || '';
    return out;
  }

  // ── Snapchat ──
  if (platform === 'snapchat') {
    out.video = raw.video || raw.url || raw.download_url || raw.without_water_mark_mp4 || raw.play || null;
    out.image = raw.image || null;
    out.title = raw.title || raw.desc || 'Snapchat Video';
    out.thumbnail = raw.thumbnail || raw.cover || raw.thumb || '';
    out.author = raw.author || raw.username || '';
    return out;
  }

  return out;
}

// ─── DAVID CYRIL FALLBACK ────────────────────────────────
async function fetchFallback(platform, url) {
  const route = {
    youtube: 'yt',
    twitter: 'aiov3',
    snapchat: 'aiov3',
  }[platform];

  if (!route) return null;

  const { data } = await axios.get(`${DAVIDCYRIL}/${route}`, {
    params: { url },
    timeout: 60000,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });

  if (!data?.success || !data?.result) {
    throw new Error(data?.message || data?.error || 'Fallback failed');
  }

  const r = data.result;
  return {
    video: r.download_url || r.url || r.hd || null,
    title: r.title || 'Media',
    thumbnail: r.thumbnail || '',
    author: '',
    duration: '',
    audio: null,
    image: null,
  };
}

// ─── STREAM HELPER ───────────────────────────────────────
async function openStream(url, referer) {
  try {
    const res = await axios.get(url, {
      responseType: 'stream',
      timeout: 120000,
      maxContentLength: 200 * 1024 * 1024,
      maxBodyLength: 200 * 1024 * 1024,
      headers: {
        'User-Agent': UA,
        Referer: referer || 'https://www.tiktok.com/',
        Accept: '*/*',
        Range: 'bytes=0-',
      },
      validateStatus: (s) => s < 400,
    });

    const contentType = String(res.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('text/html')) {
      res.data.destroy();
      return { error: 'Source returned HTML instead of media' };
    }

    return { stream: res.data, contentType };
  } catch (error) {
    if (error.response?.status === 403) return { error: '403 — link expired' };
    if (error.response?.status === 429) return { error: '429 — rate limited' };
    return { error: error.message };
  }
}

// ─── COMMAND ─────────────────────────────────────────────
module.exports = {
  name: 'aio',
  aliases: ['alldl', 'download'],
  category: 'DOWNLOAD',
  description: 'Universal downloader — TikTok, Instagram, Facebook, Snapchat, YouTube',
  premium: false,

  async execute(sock, msg, jid, args) {
    let url = args?.[0];

    if (!url) {
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quotedText =
        ctx?.quotedMessage?.conversation ||
        ctx?.quotedMessage?.extendedTextMessage?.text;
      if (quotedText) {
        const m = quotedText.match(/https?:\/\/[^\s]+/);
        if (m) url = m[0];
      }
    }

    if (!url) {
      return sock.sendMessage(jid, {
        text:
          '⬇️ *Universal Downloader*\n\n' +
          '📌 Usage: .aio <URL>\n' +
          'Or reply to a link with .aio\n\n' +
          '✅ TikTok, Instagram, Facebook, Snapchat, YouTube'
      }, { quoted: msg });
    }

    if (!/^https?:\/\//i.test(url)) {
      return sock.sendMessage(jid, {
        text: '❌ Invalid URL. Must start with http:// or https://'
      }, { quoted: msg });
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return sock.sendMessage(jid, {
        text: '❌ Unsupported platform. Try TikTok, Instagram, Facebook, Snapchat, or YouTube.'
      }, { quoted: msg });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } }).catch(() => {});
    await sock.sendMessage(jid, {
      text: `⬇️ Downloading from *${platform}*...`
    }, { quoted: msg }).catch(() => {});

    try {
      const fullUrl = await resolveShortUrl(url);

      let media = null;

      // Try Prexzy first
      try {
        const raw = await fetchPrexzy(platform, fullUrl);
        if (raw) media = normalizeResult(raw, platform);
      } catch (e) {
        console.warn(`[aio] Prexzy ${platform} failed:`, e.message);
      }

      // Fallback to David Cyril
      if (!media || (!media.video && !media.image && !media.audio)) {
        try {
          media = await fetchFallback(platform, fullUrl);
        } catch (e) {
          console.warn(`[aio] Fallback ${platform} failed:`, e.message);
        }
      }

      if (!media || (!media.video && !media.image && !media.audio)) {
        throw new Error('no usable media');
      }

      // Send thumbnail + caption
      if (media.thumbnail && /^https?:\/\//.test(media.thumbnail)) {
        try {
          await sock.sendMessage(jid, {
            image: { url: media.thumbnail },
            caption:
              `📥 *${String(media.title).slice(0, 100)}*\n` +
              (media.author ? `👤 @${media.author}\n` : '') +
              (media.duration ? `⏱️ ${media.duration}\n` : '') +
              `🌐 ${platform}\n\n_Sending media..._`
          }, { quoted: msg });
        } catch (e) {
          console.warn('[aio] thumbnail failed:', e.message);
        }
      }

      const referer = {
        tiktok: 'https://www.tiktok.com/',
        instagram: 'https://www.instagram.com/',
        facebook: 'https://www.facebook.com/',
        snapchat: 'https://www.snapchat.com/',
        youtube: 'https://www.youtube.com/',
        twitter: 'https://twitter.com/',
      }[platform] || 'https://www.tiktok.com/';

      // Send video
      if (media.video) {
        const x = await openStream(media.video, referer);
        if (x.error) throw new Error(x.error);

        await sock.sendMessage(jid, {
          video: { stream: x.stream },
          mimetype: 'video/mp4',
          caption: `🎬 *${String(media.title).slice(0, 80)}*\n📡 ${platform}`
        }, { quoted: msg });
      }
      // Send image
      else if (media.image) {
        await sock.sendMessage(jid, {
          image: { url: media.image },
          caption: `📸 *${String(media.title).slice(0, 80)}*\n📡 ${platform}`
        }, { quoted: msg });
      }

      // Send audio for TikTok if no video
      if (media.audio && !media.video) {
        try {
          const audioRes = await axios.get(media.audio, {
            responseType: 'arraybuffer',
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024,
            headers: { 'User-Agent': UA, Referer: referer },
          });
          await sock.sendMessage(jid, {
            audio: Buffer.from(audioRes.data),
            mimetype: 'audio/mpeg',
            fileName: `${String(media.title).slice(0, 40)}.mp3`,
            ptt: false
          }, { quoted: msg });
        } catch (e) {
          console.warn('[aio] audio send failed:', e.message);
        }
      }

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error('[aio]', error.message, '| apiCode:', error.apiCode);

      let userMessage = '❌ *Could not download this video*';

      if (error.apiCode === 'PRIVATE_URL' || /PRIVATE/i.test(error.message)) {
        userMessage =
          '❌ *This post is private*\n\n' +
          'The API can only reach public content. ' +
          'Private posts, friends-only videos, and locked stories cannot be downloaded.';
      } else if (error.message.includes('no usable media')) {
        userMessage =
          '❌ *This media can\'t be downloaded*\n\n' +
          'Usually means:\n' +
          '• The post is private or was deleted\n' +
          '• It\'s a photo slideshow, not a video\n' +
          '• Region-locked content\n' +
          '• Snapchat stories expire after 24h\n\n' +
          '💡 Try a different link.';
      } else if (error.message.includes('403')) {
        userMessage = '❌ *Link expired*\n\nTry again in a moment.';
      } else if (error.message.includes('429')) {
        userMessage = '❌ *Rate limited*\n\nWait a minute and try again.';
      } else if (error.message.includes('ECONNABORTED') || /timeout/i.test(error.message)) {
        userMessage = '❌ *Request timed out*\n\nTry a different link.';
      } else if (error.message.includes('Source returned HTML')) {
        userMessage = '❌ *Bad download source*\n\nThe API gave us a link that isn\'t real media. Try a different post.';
      }

      await sock.sendMessage(jid, { text: userMessage }, { quoted: msg });
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
    }
  },
};