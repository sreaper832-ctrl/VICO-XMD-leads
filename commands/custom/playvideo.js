'use strict';

/**
 * .playvideo — ZUKO /v1/ytmp4 first, Save-Tube direct fallback
 * Downloads FULL file and validates MP4 before sending (fixes corrupt/132KB files)
 */

const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yts = require('yt-search');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ZUKO_BASE = (
  process.env.ZUKO_API_BASE ||
  'https://web-production-78afd6.up.railway.app'
).replace(/\/$/, '');
const ZUKO_KEY = process.env.ZUKO_API_KEY || 'zuko_Vi-Oo2fpkgAYuU8vnY-8JbnTsNNn-k5O';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const AES_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

function cleanFileName(name) {
  return (
    String(name || 'video')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'video'
  );
}

function isYoutubeUrl(value) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(
    String(value || '').trim()
  );
}

function isMp4(buf) {
  return buf && buf.length > 12 && buf.slice(4, 8).toString('ascii') === 'ftyp';
}

function apiHeaders() {
  const h = { 'User-Agent': UA, Accept: 'application/json' };
  if (ZUKO_KEY) {
    h.Authorization = `Bearer ${ZUKO_KEY}`;
    h['x-api-key'] = ZUKO_KEY;
  }
  return h;
}

function stRequest(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const payload = body ? JSON.stringify(body) : null;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
          Origin: 'https://save-tube.com',
          Referer: 'https://save-tube.com/',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
        },
        timeout: 25000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          let data = Buffer.concat(chunks).toString('utf8');
          try {
            data = JSON.parse(data);
          } catch (_) {}
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Save-Tube timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function decrypt(b64) {
  const raw = Buffer.from(String(b64), 'base64');
  const iv = raw.subarray(0, 16);
  const data = raw.subarray(16);
  const d = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
}

async function savetubeResolve(youtubeUrl) {
  const cdnRes = await stRequest('GET', 'https://media.savetube.vip/api/random-cdn');
  const cdn = String(cdnRes.data.cdn).replace(/^https?:\/\//, '');
  const infoRes = await stRequest('POST', `https://${cdn}/v2/info`, { url: youtubeUrl });
  const info =
    typeof infoRes.data.data === 'string' ? decrypt(infoRes.data.data) : infoRes.data.data;
  for (const q of ['360', '240', '720', '144']) {
    try {
      const dl = await stRequest('POST', `https://${cdn}/download`, {
        downloadType: 'video',
        quality: q,
        key: info.key,
      });
      const url = dl.data?.data?.downloadUrl;
      if (url && /savetube/i.test(url)) {
        return { title: info.title, download_url: url, quality: q };
      }
    } catch (_) {}
  }
  throw new Error('Save-Tube: no video URL');
}

async function downloadFull(fileUrl) {
  const res = await axios.get(fileUrl, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxContentLength: 80 * 1024 * 1024,
    maxBodyLength: 80 * 1024 * 1024,
    headers: {
      'User-Agent': UA,
      Referer: 'https://save-tube.com/',
      Origin: 'https://save-tube.com',
      Accept: '*/*',
    },
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const buf = Buffer.from(res.data);
  if (!isMp4(buf)) {
    throw new Error(`Not a valid MP4 (${buf.length} bytes, magic=${buf.slice(4, 8).toString()})`);
  }
  if (buf.length < 100000) {
    throw new Error(`Video too small (${buf.length} bytes) — incomplete download`);
  }
  return buf;
}

async function resolveViaZuko(videoUrl) {
  const res = await axios.get(`${ZUKO_BASE}/v1/ytmp4`, {
    params: { url: videoUrl, quality: '360' },
    headers: apiHeaders(),
    timeout: 60000,
    validateStatus: () => true,
  });
  if (res.status >= 500) throw new Error(`VICO HTTP ${res.status}`);
  const body = res.data;
  if (!body || body.status === false) throw new Error(body?.error || 'VICO failed');
  const result = body.result || body.data || body;
  const url = result.download_url || result.url;
  if (!url) throw new Error('No download_url');
  if (!/savetube/i.test(url)) throw new Error('Non-CDN URL from ZUKO');
  return { title: result.title, download_url: url, quality: result.quality || '360' };
}

module.exports = {
  name: 'playvideo',
  aliases: ['ytv', 'ytvideo', 'playvid', 'video'],
  category: 'DOWNLOAD',
  description: '🎬 YouTube video via VICO / Save-Tube',
  premium: false,

  async execute(sock, msg, jid, args) {
    const query = args.join(' ').trim();
    if (!query) {
      return sock.sendMessage(
        jid,
        { text: '🎬 *Usage:* `.playvideo <name or YouTube URL>`' },
        { quoted: msg }
      );
    }

    await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }).catch(() => {});

    let tmpFile = null;
    try {
      let video;
      if (isYoutubeUrl(query)) {
        video = {
          url: query.startsWith('http') ? query : `https://${query}`,
          title: 'YouTube Video',
          thumbnail: '',
          timestamp: '',
        };
      } else {
        const search = await yts(query);
        video = search?.videos?.[0];
        if (!video?.url) throw new Error('No YouTube results found.');
      }

      const title = video.title || query;
      const caption =
        `🎬 *${title}*\n` +
        (video.timestamp ? `⏱️ ${video.timestamp}\n` : '') +
        `⏳ Downloading full MP4…`;

      if (video.thumbnail) {
        await sock.sendMessage(
          jid,
          { image: { url: video.thumbnail }, caption },
          { quoted: msg }
        );
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      }

      let meta;
      try {
        meta = await resolveViaZuko(video.url);
      } catch (e) {
        console.warn('[playvideo] vico fail:', e.message);
        meta = await savetubeResolve(video.url);
      }

      const buf = await downloadFull(meta.download_url);
      tmpFile = path.join(os.tmpdir(), `zuko-vid-${Date.now()}.mp4`);
      fs.writeFileSync(tmpFile, buf);

      const sizeMB = (buf.length / (1024 * 1024)).toFixed(1);
      await sock.sendMessage(
        jid,
        {
          video: buf,
          mimetype: 'video/mp4',
          caption: `✅ *${meta.title || title}*\n📦 ${sizeMB} MB · ${meta.quality}p\nVICO API`,
          fileName: `${cleanFileName(meta.title || title)}.mp4`,
        },
        { quoted: msg }
      );
      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } }).catch(() => {});
    } catch (error) {
      console.error('[playvideo]', error.message);
      await sock.sendMessage(
        jid,
        { text: `❌ *Playvideo failed*\n${error.message || error}` },
        { quoted: msg }
      );
      await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } }).catch(() => {});
    } finally {
      if (tmpFile) {
        try {
          fs.unlinkSync(tmpFile);
        } catch (_) {}
      }
    }
  },
};
