// commands/darknaija.js
'use strict';

/**
 * DarkNaija command — search / latest / download
 * Site: https://darknaija.com/
 * Video host: https://srv-darknaija.com/wp-content/uploads/...
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE = 'https://darknaija.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const http = axios.create({
  timeout: 40000,
  headers: {
    'User-Agent': UA,
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Referer: BASE + '/',
  },
  maxRedirects: 5,
  validateStatus: (s) => s >= 200 && s < 400,
});

module.exports = {
  name: 'darknaija',
  aliases: ['dn', 'darkn', 'naijaporn', 'naijaleak'],
  category: 'ADULT',
  description: 'Search / latest / download from DarkNaija',

  async execute(sock, msg, jid, args) {
    if (!args.length) {
      return sock.sendMessage(
        jid,
        {
          text:
            '🔞 *DarkNaija*\n\n' +
            '• `.darknaija latest` — newest posts\n' +
            '• `.darknaija <search>` — search site\n' +
            '• `.darknaija <post-url>` — get video + send\n' +
            '• `.darknaija dl <post-url>` — download only\n\n' +
            'Example:\n`.darknaija lagos`\n`.darknaija https://darknaija.com/2026/09/20/.../`',
        },
        { quoted: msg }
      );
    }

    const sub = String(args[0]).toLowerCase();
    await sock.sendMessage(jid, { react: { text: '🔍', key: msg.key } }).catch(() => {});

    try {
      // Download by URL
      if (sub === 'dl' || sub === 'get' || /darknaija\.com\//i.test(args.join(' '))) {
        const urlArg = sub === 'dl' || sub === 'get' ? args.slice(1).join(' ') : args.join(' ');
        const url = extractPostUrl(urlArg);
        if (!url) {
          return sock.sendMessage(jid, { text: '⚠️ Need a darknaija.com post URL.' }, { quoted: msg });
        }
        return await sendDownload(sock, msg, jid, url);
      }

      // Latest
      if (['latest', 'new', 'home', 'recent'].includes(sub)) {
        const posts = await scrapeList(BASE + '/');
        return await sendSearchResults(sock, msg, jid, posts, 'Latest');
      }

      // Search
      const query = args.join(' ').trim();
      const posts = await scrapeList(`${BASE}/?s=${encodeURIComponent(query)}`);
      if (!posts.length) {
        // fallback: filter homepage
        const home = await scrapeList(BASE + '/');
        const q = query.toLowerCase();
        const filtered = home.filter((p) => p.title.toLowerCase().includes(q));
        if (!filtered.length) {
          return sock.sendMessage(jid, { text: '❌ No results.' }, { quoted: msg });
        }
        return await sendSearchResults(sock, msg, jid, filtered, query);
      }
      return await sendSearchResults(sock, msg, jid, posts, query);
    } catch (e) {
      console.error('[darknaija]', e);
      await sock.sendMessage(jid, { text: `❌ ${e.message || e}` }, { quoted: msg });
    }
  },
};

function extractPostUrl(text) {
  const m = String(text).match(/https?:\/\/(?:www\.)?darknaija\.com\/[^\s]+/i);
  return m ? m[0].replace(/[)>.,]+$/, '') : null;
}

async function scrapeList(url) {
  const { data } = await http.get(url);
  const $ = cheerio.load(data);
  const posts = [];

  $('.hentry').each((i, el) => {
    if (i >= 12) return false;
    const a = $(el).find('.entry-title a').first();
    const title = (a.attr('title') || a.text() || '').trim();
    const href = a.attr('href') || '';
    const img = $(el).find('img').first();
    const thumb = img.attr('data-src') || img.attr('src') || '';
    const cat = $(el).find('.entry-category').text().trim();
    if (title && href && href.includes('darknaija.com') && !href.includes('smartpop') && !href.includes('xxxjmp')) {
      posts.push({ title, link: href, thumbnail: thumb, category: cat });
    }
  });

  return posts;
}

async function scrapePost(url) {
  const { data } = await http.get(url);
  const $ = cheerio.load(data);
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1.entry-title').text().trim() ||
    $('title').text().replace(/\s*[–-]\s*DarkNaija.*$/i, '').trim();

  const thumb =
    $('meta[property="og:image"]').attr('content') ||
    $('video').attr('poster') ||
    '';

  // Primary: <video src="https://srv-darknaija.com/...mp4">
  let video =
    $('video').attr('src') ||
    $('video source').attr('src') ||
    null;

  if (!video) {
    const html = $.html();
    const m = html.match(/https?:\/\/srv-darknaija\.com\/[^"'\s]+\.mp4/i)
      || html.match(/https?:\/\/[^"'\s]*darknaija[^"'\s]+\.mp4/i)
      || html.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/i);
    if (m) video = m[0];
  }

  return { title, thumb, video, url };
}

async function sendSearchResults(sock, msg, jid, posts, label) {
  let caption = `🔞 *DarkNaija — ${label}*\n\n`;
  posts.slice(0, 10).forEach((p, i) => {
    caption += `*${i + 1}.* ${p.title}\n`;
    if (p.category) caption += `📁 ${p.category}\n`;
    caption += `🔗 ${p.link}\n\n`;
  });
  caption += `Download:\n\`.darknaija <link>\``;

  const first = posts[0];
  if (first?.thumbnail) {
    await sock.sendMessage(
      jid,
      { image: { url: first.thumbnail }, caption },
      { quoted: msg }
    );
  } else {
    await sock.sendMessage(jid, { text: caption }, { quoted: msg });
  }
}

async function sendDownload(sock, msg, jid, url) {
  await sock.sendMessage(jid, { react: { text: '📥', key: msg.key } }).catch(() => {});
  const post = await scrapePost(url);

  if (!post.video) {
    return sock.sendMessage(
      jid,
      {
        text:
          `❌ No direct MP4 found.\n📌 ${post.title}\n🔗 ${url}\n\n` +
          `_Open the link in a browser; some posts only embed external players._`,
      },
      { quoted: msg }
    );
  }

  const caption =
    `🔞 *DarkNaija*\n📌 ${post.title}\n🔗 ${url}\n\n✅ Sending video…`;

  try {
    if (post.thumb) {
      await sock.sendMessage(jid, { image: { url: post.thumb }, caption }, { quoted: msg });
    } else {
      await sock.sendMessage(jid, { text: caption }, { quoted: msg });
    }

    await sock.sendMessage(
      jid,
      {
        video: { url: post.video },
        caption: `🎬 ${post.title}`,
        mimetype: 'video/mp4',
      },
      { quoted: msg }
    );
  } catch (sendErr) {
    await sock.sendMessage(
      jid,
      {
        text:
          `⚠️ Upload failed (${sendErr.message || 'size/timeout'}).\n\n` +
          `📌 ${post.title}\n` +
          `💎 Direct MP4:\n${post.video}`,
      },
      { quoted: msg }
    );
  }
}
