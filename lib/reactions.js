'use strict';

const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const execFileAsync = promisify(execFile);

// Primary API: NekosBest. Fallback: waifu.pics.
// Both are public SFW reaction APIs; NekosBest documents the reaction
// categories and requires a descriptive User-Agent.
const API_SOURCES = [
  {
    name: 'nekos.best',
    url: (category) => `https://nekos.best/api/v2/${encodeURIComponent(category)}`,
    parse: (data) => data?.results?.[0]?.url,
    headers: { 'User-Agent': 'ZUKO-XMD-V2 (https://t.me/lordzuko3)' },
  },
  {
    name: 'waifu.pics',
    url: (category) => `https://api.waifu.pics/sfw/${encodeURIComponent(category)}`,
    parse: (data) => data?.url,
    headers: { 'User-Agent': 'ZUKO-XMD-V2/2.0' },
  },
];

const cache = new Map();
const CACHE_TTL = 30_000;

async function fetchReactionUrl(category) {
  const key = String(category).toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.url;

  let lastError;
  for (const source of API_SOURCES) {
    try {
      const response = await axios.get(source.url(key), {
        headers: { Accept: 'application/json', ...source.headers },
        timeout: 12_000,
        validateStatus: (s) => s >= 200 && s < 300,
      });
      const url = source.parse(response.data);
      if (!url || !/^https?:\/\//i.test(url)) throw new Error(`No media URL from ${source.name}`);
      cache.set(key, { url, time: Date.now() });
      return url;
    } catch (error) {
      lastError = error;
      console.error(`[REACTION:${key}] ${source.name}: ${error.message}`);
    }
  }

  throw lastError || new Error('All reaction APIs failed');
}

async function downloadMedia(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 25_000,
    maxContentLength: 15 * 1024 * 1024,
    maxBodyLength: 15 * 1024 * 1024,
    headers: { 'User-Agent': 'ZUKO-XMD-V2/2.0', Accept: '*/*' },
    validateStatus: (s) => s >= 200 && s < 300,
  });
  const contentType = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
  return { buffer: Buffer.from(response.data), contentType };
}

async function gifToMp4(buffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zuko-react-'));
  const input = path.join(dir, 'input.gif');
  const output = path.join(dir, 'output.mp4');
  try {
    fs.writeFileSync(input, buffer);
    await execFileAsync(ffmpegPath, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', input,
      '-movflags', 'faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-an', output,
    ], { timeout: 30_000 });
    return fs.readFileSync(output);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

async function fetchReactionMedia(category) {
  const url = await fetchReactionUrl(category);
  const media = await downloadMedia(url);
  const looksGif = media.contentType === 'image/gif' || /\.gif(?:$|\?)/i.test(url);
  const looksVideo = media.contentType.startsWith('video/') || /\.(mp4|webm|mov)(?:$|\?)/i.test(url);

  if (looksGif) {
    try {
      const mp4 = await gifToMp4(media.buffer);
      return { type: 'video', buffer: mp4, mimetype: 'video/mp4', url };
    } catch (error) {
      console.error(`[REACTION:${category}] GIF conversion failed: ${error.message}`);
      // WhatsApp can still accept the original GIF as an image on some clients.
      return { type: 'image', buffer: media.buffer, mimetype: 'image/gif', url };
    }
  }

  if (looksVideo) {
    return { type: 'video', buffer: media.buffer, mimetype: media.contentType || 'video/mp4', url };
  }

  return { type: 'image', buffer: media.buffer, mimetype: media.contentType || 'image/jpeg', url };
}

// Backwards-compatible helper used elsewhere in the bot.
async function fetchReactionGif(category) {
  const url = await fetchReactionUrl(category);
  return { url };
}

function tagFor(jid) {
  return '@' + String(jid).split('@')[0];
}

function resolveTarget(msg, args) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = ctx.mentionedJid || msg.message?.conversation?.contextInfo?.mentionedJid || [];
  const quotedParticipant = ctx.participant;

  if (mentioned.length > 0) return { jid: mentioned[0], mention: true };
  if (quotedParticipant) return { jid: quotedParticipant, mention: true };
  if (args.length > 0) return { jid: null, mention: false, name: args.join(' ') };
  return null;
}

function makeReactionCommand({ name, aliases = [], category, emoji, verb, selfVerb }) {
  return {
    name,
    aliases,
    category: 'FUN',
    description: `Send a ${name} reaction GIF`,
    async execute(sock, msg, jid, args) {
      const sender = msg.key.participant || msg.key.remoteJid;
      const target = resolveTarget(msg, args);

      let caption;
      let mentions = [sender].filter(Boolean);
      if (target?.jid) {
        caption = `${emoji} *${tagFor(sender)}* ${verb} *${tagFor(target.jid)}*!`;
        mentions.push(target.jid);
      } else if (target?.name) {
        caption = `${emoji} *${tagFor(sender)}* ${verb} *${target.name}*!`;
      } else {
        caption = `${emoji} *${tagFor(sender)}* ${selfVerb || verb}!`;
      }

      try {
        const media = await fetchReactionMedia(category);
        const payload = media.type === 'video'
          ? { video: media.buffer, mimetype: media.mimetype, gifPlayback: true, caption, mentions }
          : { image: media.buffer, mimetype: media.mimetype, caption, mentions };
        return await sock.sendMessage(jid, payload, { quoted: msg });
      } catch (error) {
        console.error(`[${name}] reaction failed:`, error);
        // Never leave the command completely silent when a public API is down.
        return sock.sendMessage(jid, {
          text: `${emoji} *${tagFor(sender)}* ${target?.jid ? `${verb} *${tagFor(target.jid)}*!` : (selfVerb || verb + '!')}\n\n_⚠️ Reaction GIF service is temporarily unavailable._`,
          mentions,
        }, { quoted: msg });
      }
    },
  };
}

module.exports = { makeReactionCommand, fetchReactionGif, fetchReactionMedia, resolveTarget, tagFor };
