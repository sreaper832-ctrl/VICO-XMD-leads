// bot.js - ZUKO XMD — PULSE EDITION
// =============================================
// Trimmed build: only /pair, /delpair, /listpair confirm, /runtime, /ping.
// Redesigned UI: new "Pulse Grid" visual system.
// Buttons use the real Bot API 9.4 `style` field (added Feb 9, 2026):
// style: 'primary' = blue, style: 'danger' = red, style: 'success' = green.
// Requires a Telegram client version that supports Bot API 9.4+;
// older clients just fall back to the default button color.
// =============================================

require('dotenv').config();
require('../config/setting/config');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const chalk = require('chalk');
const { BOT_TOKEN } = require('../session/token');
const { autoLoadPairs } = require('./autoload');

// IMPORTANT: pair.js exports startpairing directly (module.exports = startpairing)
// So we require it directly as a function, not as an object with a .startpairing property
const startpairing = require('./pair');

// ========================
// INITIALIZATION
// ========================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ========================
// FILE PATHS
// ========================
const DATA_DIR = path.join(__dirname, '..', 'storage', 'session-data');
const adminFilePath = path.join(DATA_DIR, 'admin.json');
const userFilePath = path.join(DATA_DIR, 'users.json');

// ========================
// DATA STORAGE
// ========================
let adminIDs = [];
let userIDs = new Set();

// Command cooldowns
const cooldowns = new Map();

// ========================
// PULSE — VISUAL DESIGN SYSTEM
// ========================
// Blue = primary / informational / go
// Red  = danger / blocking / stop
const PULSE = {
    barBlue: '🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦',
    barRed:  '🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥',
    divider: '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄',
    dot:     '◆',
    arrow:   '➤',
    footer:  '◆ VICO · PULSE ◆',
};

// Frames a title inside a header card, e.g.
// 🔷 PULSE // TITLE
const wrapTitle = (title, tone = 'blue') => {
    const chip = tone === 'red' ? '🔻' : '🔷';
    return `${chip} *PULSE* // *${title.toUpperCase()}*`;
};

// ========================
// SOCIAL LINKS (requirements)
// ========================
const SOCIAL_LINKS = {
    group: 'https://t.me/rms_group01',
    channel: 'https://t.me/rmschannel01',
    channel2: 'https://t.me/rmschannel2',
    backupchannel: 'https://t.me/rmsbackupchannel',
    bio: 'https://t.me/rmsbio'
};

// ========================
// IMAGE URLS
// ========================
const BANNER_URL = 'https://files.catbox.moe/e7ej9g.jpg';

// ========================
// AUTHORIZATION SETTINGS
// ========================
const REQUIRE_MEMBERSHIP = true;
const REQUIRED_GROUPS = ['@rms_group01'];
const REQUIRED_CHANNELS = [
    { link: '@rmschannel01', name: 'RMS CHANNEL' },
    { link: '@rmschannel2', name: 'RMS CHANNEL 2' },
    { link: '@rmsbackupchannel', name: 'RMS BACKUP CHANNEL' },
    { link: '@rmsbio', name: 'RMS BIO' }
];

// ========================
// HELPER FUNCTIONS
// ========================
const exists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const ensureDirectoryExists = async (dirPath) => {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
};

function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
}

const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
};

// ========================
// DATA LOAD/SAVE FUNCTIONS
// ========================
const loadAdminIDs = async () => {
    const ownerID = '7446783863';
    const defaultAdmins = [ownerID];

    await ensureDirectoryExists(DATA_DIR);

    if (!(await exists(adminFilePath))) {
        await fs.writeFile(adminFilePath, JSON.stringify(defaultAdmins, null, 2));
        adminIDs = defaultAdmins;
        console.log(chalk.green('✓ Created admin.json'));
    } else {
        try {
            const raw = await fs.readFile(adminFilePath, 'utf8');
            adminIDs = JSON.parse(raw);
            if (!Array.isArray(adminIDs)) adminIDs = defaultAdmins;
        } catch (err) {
            console.error(chalk.red('✗ Error loading admin.json:'), err);
            adminIDs = defaultAdmins;
        }
    }
    console.log(chalk.cyan(`📥 Loaded ${adminIDs.length} admin(s)`));
};

const loadUserIDs = async () => {
    if (await exists(userFilePath)) {
        try {
            const raw = await fs.readFile(userFilePath, 'utf8');
            const users = JSON.parse(raw);
            userIDs = new Set(Array.isArray(users) ? users : []);
            console.log(chalk.cyan(`📥 Loaded ${userIDs.size} user(s)`));
        } catch (err) {
            console.error(chalk.red('✗ Error loading users.json:'), err);
            userIDs = new Set();
        }
    }
};

const saveUserIDs = async () => {
    try {
        await fs.writeFile(userFilePath, JSON.stringify([...userIDs], null, 2));
    } catch (err) {
        console.error(chalk.red('✗ Error saving users.json:'), err);
    }
};

// ========================
// USER TRACKING
// ========================
const trackUser = async (userId) => {
    const userIdStr = userId.toString();
    if (!userIDs.has(userIdStr)) {
        userIDs.add(userIdStr);
        await saveUserIDs();
        console.log(chalk.green(`✓ New user: ${userIdStr}`));
    }
};

// ========================
// MEMBERSHIP CHECK
// ========================
const checkMembership = async (userId) => {
    if (!REQUIRE_MEMBERSHIP) {
        return {
            hasJoinedGroup: true,
            hasJoinedAllChannels: true,
            hasJoinedAll: true,
            missingChannels: []
        };
    }

    try {
        const groupChecks = await Promise.all(
            REQUIRED_GROUPS.map(g => bot.getChatMember(g, userId).catch(() => null))
        );

        const channelChecks = await Promise.all(
            REQUIRED_CHANNELS.map(channel =>
                bot.getChatMember(channel.link, userId).catch(() => null)
            )
        );

        const validStatuses = ['member', 'administrator', 'creator'];
        const hasJoinedGroup = groupChecks.every(m => m && validStatuses.includes(m.status));
        const hasJoinedAllChannels = channelChecks.every(member => member && validStatuses.includes(member.status));

        return {
            hasJoinedGroup,
            hasJoinedAllChannels,
            hasJoinedAll: hasJoinedGroup && hasJoinedAllChannels,
            missingChannels: REQUIRED_CHANNELS.filter((_, idx) => !channelChecks[idx])
        };
    } catch (error) {
        console.error(chalk.red('Membership check error:'), error.message);
        return {
            hasJoinedGroup: false,
            hasJoinedAllChannels: false,
            hasJoinedAll: false,
            missingChannels: REQUIRED_CHANNELS
        };
    }
};

// ========================
// UI HELPERS
// ========================
// tone: 'blue' (default, informational/success) or 'red' (warning/danger)
const sendStyledMessage = async (chatId, title, content, buttons = null, tone = 'blue') => {
    const bar = tone === 'red' ? PULSE.barRed : PULSE.barBlue;
    const styledText =
`${wrapTitle(title, tone)}
${bar}
${content}
${PULSE.divider}
_${PULSE.footer}_`;

    const options = {
        caption: styledText,
        parse_mode: 'Markdown'
    };

    if (buttons) {
        options.reply_markup = { inline_keyboard: buttons };
    }

    return bot.sendPhoto(chatId, BANNER_URL, options);
};

const sendJoinRequirement = async (chatId) => {
    const content = `🔻 *ACCESS LOCKED*

  ${PULSE.dot} Join the group + channels below
  ${PULSE.dot} Then tap 🔵 *VERIFY ✅*

  🔵 *GROUP*           VICO XMD
  🔵 *CHANNEL*         RMS CHANNEL
  🔵 *CHANNEL 2*       RMS CHANNEL 2
  🔵 *BACKUP CHANNEL*  RMS BACKUP
  🔵 *BIO*             RMS BIO`;

    const keyboard = [
        [
            { text: 'JOIN GROUP', url: SOCIAL_LINKS.group, style: 'primary' },
            { text: 'JOIN CHANNEL', url: SOCIAL_LINKS.channel, style: 'primary' }
        ],
        [
            { text: 'JOIN CHANNEL 2', url: SOCIAL_LINKS.channel2, style: 'primary' },
            { text: 'JOIN BACKUP', url: SOCIAL_LINKS.backupchannel, style: 'primary' }
        ],
        [
            { text: 'JOIN BIO', url: SOCIAL_LINKS.bio, style: 'primary' }
        ],
        [{ text: 'VERIFY NOW', callback_data: 'check_membership', style: 'primary' }],
        [{ text: 'CANCEL', callback_data: 'dismiss', style: 'danger' }]
    ];

    return sendStyledMessage(chatId, 'ACCESS REQUIRED', content, keyboard, 'red');
};

// ========================
// MIDDLEWARE
// ========================
const withCooldown = (command, seconds = 3) => {
    return (handler) => {
        return async (msg, match) => {
            const userId = msg.from.id;
            const key = `${userId}_${command}`;
            const now = Date.now();
            const cooldown = cooldowns.get(key);

            if (cooldown && now - cooldown < seconds * 1000) {
                const remaining = Math.ceil((seconds * 1000 - (now - cooldown)) / 1000);
                const content = `🔻 *Slow down!* Wait ${remaining}s before using this again.`;
                return sendStyledMessage(msg.chat.id, 'COOLDOWN', content, null, 'red');
            }

            cooldowns.set(key, now);
            return handler(msg, match);
        };
    };
};

const requireMembership = (handler) => {
    return async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        await trackUser(userId);

        if (!REQUIRE_MEMBERSHIP) {
            return handler(msg, match);
        }

        if (adminIDs.includes(userId.toString())) {
            return handler(msg, match);
        }

        const membership = await checkMembership(userId);

        if (!membership.hasJoinedAll) {
            return sendJoinRequirement(chatId);
        }

        return handler(msg, match);
    };
};

// ========================
// COMMAND HANDLERS
// ========================

// Start command — first contact: join-gate for regular users, welcome for verified/admins
bot.onText(/^\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    await trackUser(userId);

    const isAdmin = adminIDs.includes(userId.toString());

    if (!isAdmin && REQUIRE_MEMBERSHIP) {
        const membership = await checkMembership(userId);
        if (!membership.hasJoinedAll) {
            return sendJoinRequirement(chatId);
        }
    }

    const content = `🔵 *Welcome, ${msg.from.first_name || 'there'}!*

  📲 *COMMANDS*
  ${PULSE.arrow} /pair or .pair \`num\` — Connect WhatsApp
  ${PULSE.arrow} /delpair \`num\` — Remove device
  ${PULSE.arrow} /listpair or .listpair confirm — View devices
  ${PULSE.arrow} /ping — Latency check
  ${PULSE.arrow} /runtime — Bot uptime`;

    await sendStyledMessage(chatId, 'WELCOME', content, [
        [
            { text: 'GROUP', url: SOCIAL_LINKS.group, style: 'primary' },
            { text: 'CHANNEL', url: SOCIAL_LINKS.channel, style: 'primary' }
        ]
    ]);
});

// Ping command
bot.onText(/\/ping/, requireMembership(withCooldown('ping', 5)(async (msg) => {
    const chatId = msg.chat.id;
    const start = Date.now();

    const sentMsg = await bot.sendPhoto(chatId, BANNER_URL, {
        caption: `🔵 *Pinging...*`,
        parse_mode: 'Markdown'
    });

    const latency = Date.now() - start;
    const apiLatency = sentMsg.date - msg.date;

    const isGood = latency < 200;
    const tone = isGood ? 'blue' : 'red';
    const bar = isGood ? PULSE.barBlue : PULSE.barRed;
    const pingStatus = latency < 100 ? 'Excellent' : latency < 200 ? 'Good' : latency < 500 ? 'Slow' : 'Very Slow';
    const pingChip = isGood ? '🔵' : '🔴';

    const pingEdit = `${wrapTitle('PONG!', tone)}
${bar}
  ${pingChip} *Response*   ${latency}ms
  🔵 *API Delay*   ${apiLatency}ms
  ${pingChip} *Quality*    ${pingStatus}
${PULSE.divider}
_${PULSE.footer}_`;

    await bot.editMessageMedia({
        type: 'photo',
        media: BANNER_URL,
        caption: pingEdit,
        parse_mode: 'Markdown'
    }, {
        chat_id: chatId,
        message_id: sentMsg.message_id
    });
})));

// Runtime command
bot.onText(/\/runtime/, requireMembership(async (msg) => {
    const chatId = msg.chat.id;
    const uptime = runtime(process.uptime());
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const content = `🔵 *Status* — Online & Running

  ${PULSE.arrow} *Uptime*   ${uptime}
  ${PULSE.arrow} *Memory*   ${memory} MB
  ${PULSE.arrow} *Users*    ${formatNumber(userIDs.size)} registered`;

    await sendStyledMessage(chatId, 'SYSTEM STATUS', content, [
        [{ text: 'REFRESH', callback_data: 'refresh_runtime', style: 'primary' }]
    ]);
}));

// PAIR COMMAND — usage (no number provided)
bot.onText(/^(?:\/pair|\.pair)$/i, requireMembership(async (msg) => {
    const chatId = msg.chat.id;
    return sendStyledMessage(chatId, 'PAIR USAGE', '🔻 *Usage :* `/pair 2347066217262`\n\n  Example with your number (no + or 0 prefix)', null, 'red');
}));

// PAIR COMMAND
bot.onText(/(?:\/pair|\.pair) (.+)/, requireMembership(withCooldown('pair', 10)(async (msg, match) => {
    const chatId = msg.chat.id;
    const number = match[1].trim();

    try {
        if (!number || /[a-z]/i.test(number) || !/^\d{7,15}$/.test(number) || number.startsWith('0')) {
            return sendStyledMessage(chatId, 'INVALID NUMBER', '🔻 *Use:* /pair 234XXXXXXXXX', null, 'red');
        }

        await sendStyledMessage(chatId, 'PAIRING', '🔵 *Processing your request...*');

        const jid = number.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

        // DIRECT CALL - startpairing is the function itself
        await startpairing(jid);
        await sleep(4000);

        const pairingFile = path.join(DATA_DIR, 'pairing', 'pairing.json');

        if (!(await exists(pairingFile))) {
            return sendStyledMessage(chatId, 'PAIRING FAILED', '🔴 *Failed to generate code*\n  Please try again.', null, 'red');
        }

        const cu = await fs.readFile(pairingFile, 'utf-8');
        const cuObj = JSON.parse(cu);

        const senderNumber = number.replace(/[^0-9]/g, '');

        await sendStyledMessage(chatId, 'PAIRING SUCCESSFUL',
            `🔵 *Device Linked!*\n\n  ${PULSE.arrow} Number  ${senderNumber}\n  ${PULSE.arrow} Code    \`${cuObj.code}\`\n\n  Open WhatsApp › Linked Devices › Link a Device`);

    } catch (error) {
        console.error(chalk.red('Pair error:'), error);
        sendStyledMessage(chatId, 'PAIRING FAILED', `🔴 *ERROR*\n\n  ${error.message || 'Please try again'}`, null, 'red');
    }
})));

// Delpair command
bot.onText(/\/delpair (.+)/, requireMembership(async (msg, match) => {
    const chatId = msg.chat.id;
    const number = match[1].trim();

    try {
        if (!number || /[a-z]/i.test(number) || !/^\d{7,15}$/.test(number)) {
            return sendStyledMessage(chatId, 'INVALID NUMBER', '🔻 *Use:* /delpair 234XXXXXXXXX', null, 'red');
        }

        const jidSuffix = `${number}@s.whatsapp.net`;
        const pairingPath = path.join(DATA_DIR, 'pairing');

        if (!(await exists(pairingPath))) {
            return sendStyledMessage(chatId, 'DELETE FAILED', '🔴 *No session found*', null, 'red');
        }

        const entries = await fs.readdir(pairingPath, { withFileTypes: true });
        const matched = entries.find(entry => entry.isDirectory() && entry.name === jidSuffix);

        if (!matched) {
            return sendStyledMessage(chatId, 'NOT FOUND', `🔴 *${number} is not paired*`, null, 'red');
        }

        const targetPath = path.join(pairingPath, matched.name);
        await fs.rm(targetPath, { recursive: true, force: true });

        await sendStyledMessage(chatId, 'DEVICE REMOVED', `🔵 *Unlinked Successfully*\n\n  ${PULSE.arrow} ${number} has been removed.`);

        console.log(chalk.green(`🗑️ Deleted: ${number}`));
    } catch (err) {
        console.error(chalk.red('Delpair error:'), err);
        sendStyledMessage(chatId, 'DELETE FAILED', `🔴 *ERROR*\n\n  ${err.message}`, null, 'red');
    }
}));


// Listpair command (admin only) — with or without confirm
bot.onText(/(?:\/listpair|\.listpair)(?:\s+confirm)?$/, async (msg) => {
    // listpair without confirm

    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    if (!adminIDs.includes(userId)) {
        return sendStyledMessage(chatId, 'ADMIN ONLY', '🔴 *Access Denied*', null, 'red');
    }

    try {
        const pairingPath = path.join(DATA_DIR, 'pairing');

        if (!(await exists(pairingPath))) {
            return sendStyledMessage(chatId, 'PAIRED DEVICES', '🔴 *No devices found*', null, 'red');
        }

        const entries = await fs.readdir(pairingPath, { withFileTypes: true });
        const pairedDevices = entries
            .filter(entry => entry.isDirectory() && entry.name !== 'pairing.json' && entry.name.endsWith('@s.whatsapp.net'))
            .map(entry => entry.name);

        if (pairedDevices.length === 0) {
            return sendStyledMessage(chatId, 'PAIRED DEVICES', '🔴 *No devices found*', null, 'red');
        }

        let deviceList = `🔵 *${pairedDevices.length} device(s) linked*\n\n`;
        pairedDevices.forEach((device, index) => {
            const phoneNumber = device.split('@')[0];
            deviceList += `  ${PULSE.arrow} ${index + 1}. \`${phoneNumber}\`\n`;
        });

        await sendStyledMessage(chatId, 'PAIRED DEVICES', deviceList);
    } catch (err) {
        console.error(chalk.red('Listpair error:'), err);
        sendStyledMessage(chatId, 'ERROR', '🔴 *Failed to load devices*', null, 'red');
    }
});


// ========================
// 80-COMMAND EXPANSION
// ========================
// 78 utility/social/admin-safe commands + .pair + .listpair aliases = 80 additions.
// All utility commands support both /command and .command prefixes.
const EXTRA_COMMANDS = [
    'help','menu','about','botinfo','status','id','chatid','userid','myid','time','date',
    'uptime','echo','say','reverse','upper','lower','title','repeat','wordcount','charcount',
    'linecount','vowels','palindrome','calc','random','dice','coinflip','choose','8ball',
    'quote','joke','fact','compliment','roast','ship','love','rps','truth','dare','password',
    'uuid','hash','base64','unbase64','urlencode','urldecode','json','timestamp','bytes','kb',
    'mb','gb','hex','unhex','binary','unbinary','slug','sort','unique','sum','avg','min','max',
    'count','isprime','fibonacci','factorial','percent','discount','tip','convert','contact',
    'support','admin','users','stats','source'
];

const EXTRA_QUOTES = [
    'Small progress is still progress.',
    'Build quietly. Let the results make the noise.',
    'Consistency beats intensity when intensity is not consistent.',
    'Learn, ship, improve, repeat.',
    'Your next level starts with today’s action.'
];
const EXTRA_JOKES = [
    'Why did the developer go broke? Because they used up all their cache.',
    'I told my bot a joke. It replied with a stack trace.',
    'Why do programmers prefer dark mode? Because light attracts bugs.'
];
const EXTRA_FACTS = [
    'A day on Venus is longer than a Venusian year.',
    'Honey can remain edible for extremely long periods when properly stored.',
    'Octopuses have three hearts.'
];
const EIGHT_BALL = [
    'Yes — definitely.', 'No — not this time.', 'Probably.', 'Ask again later.',
    'The signs point to yes.', 'Very doubtful.', 'It is possible.', 'Absolutely.'
];

const safeArg = (arg) => String(arg || '').trim();
const parseNumbers = (arg) => safeArg(arg).split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

function simpleSlug(text) {
    return safeArg(text).toLowerCase().normalize('NFKD')
        .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}
function isPrimeNumber(n) {
    n = Number(n);
    if (!Number.isInteger(n) || n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
    return true;
}
function factorialNumber(n) {
    n = Number(n);
    if (!Number.isInteger(n) || n < 0 || n > 170) return null;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}
function fibonacci(n) {
    n = Number(n);
    if (!Number.isInteger(n) || n < 0 || n > 1476) return null;
    let a = 0, b = 1;
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    return a;
}

bot.onText(/^[/\.](\w+)(?:\s+([\s\S]*))?$/i, requireMembership(withCooldown('extra', 1)(async (msg, match) => {
    const command = match[1].toLowerCase();
    const arg = safeArg(match[2]);
    if (!EXTRA_COMMANDS.includes(command)) return;
    // Existing commands have dedicated handlers below/above. Do not duplicate them.
    if (['start','pair','delpair','listpair','ping','runtime'].includes(command)) return;

    const chatId = msg.chat.id;
    const user = msg.from || {};
    const firstName = user.first_name || 'User';

    const reply = async (title, content, tone = 'blue') =>
        sendStyledMessage(chatId, title, content, null, tone);

    try {
        switch (command) {
            case 'help':
            case 'menu':
                return reply('COMMAND MENU',
`🔵 *COMMANDS READY*

${PULSE.arrow} *PAIRING*
  .pair 234XXXXXXXXX
  .listpair confirm
  /delpair 234XXXXXXXXX

${PULSE.arrow} *SYSTEM*
  .ping  •  .runtime  •  .status  •  .stats
  .botinfo • .users • .id • .chatid

${PULSE.arrow} *MATH*
  .calc • .random • .dice • .sum • .avg • .min • .max
  .isprime • .fibonacci • .factorial • .percent
  .discount • .tip • .count

${PULSE.arrow} *FUN*
  .8ball • .quote • .joke • .fact • .compliment
  .roast • .ship • .love • .rps • .truth • .dare

${PULSE.arrow} *ENCODING*
  .unbase64 • .urlencode • .urldecode • .hex • .unhex
  .binary • .unbinary • .timestamp • .bytes • .kb • .mb • .gb

${PULSE.arrow} *INFO*
  .about • .contact • .source`);
            case 'about':
                return reply('ABOUT', `🔵 *${global.BOT_NAME || 'VICO XMD'}*\n\nPremium Telegram control bot with WhatsApp pairing, utilities and interactive tools.\n\n${PULSE.arrow} Prefixes: \`/\` and \`.\``);
            case 'botinfo':
                return reply('BOT INFO', `🤖 *Name:* ${global.BOT_NAME || 'VICO XMD'}\n⚡ *Version:* ${global.version || '1.0.1'}\n🟢 *Status:* Online\n👥 *Users:* ${formatNumber(userIDs.size)}\n⏱️ *Uptime:* ${runtime(process.uptime())}`);
            case 'status':
                return reply('STATUS', `🟢 *ONLINE*\n\n${PULSE.arrow} Uptime: ${runtime(process.uptime())}\n${PULSE.arrow} Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n${PULSE.arrow} Users: ${formatNumber(userIDs.size)}`);
            case 'id':
            case 'userid':
            case 'myid':
                return reply('USER ID', `👤 *${firstName}*\n\n${PULSE.arrow} Telegram ID: \`${user.id}\``);
            case 'chatid':
                return reply('CHAT ID', `💬 *Chat ID:* \`${chatId}\`\n${PULSE.arrow} Type: ${msg.chat.type}`);
            case 'time':
                return reply('TIME', `🕐 *Server time:* \`${new Date().toLocaleTimeString()}\``);
            case 'date':
                return reply('DATE', `📅 *Server date:* \`${new Date().toLocaleDateString()}\``);
            case 'uptime':
                return reply('UPTIME', `⏱️ *Bot uptime:* ${runtime(process.uptime())}`);
            case 'echo':
            case 'say':
                return arg ? reply('ECHO', arg) : reply('ECHO', '🔻 Usage: `.echo your text`', 'red');
            case 'reverse':
                return arg ? reply('REVERSE', arg.split('').reverse().join('')) : reply('REVERSE', '🔻 Provide text.', 'red');
            case 'upper':
                return arg ? reply('UPPERCASE', arg.toUpperCase()) : reply('UPPERCASE', '🔻 Provide text.', 'red');
            case 'lower':
                return arg ? reply('LOWERCASE', arg.toLowerCase()) : reply('LOWERCASE', '🔻 Provide text.', 'red');
            case 'title':
                return arg ? reply('TITLE CASE', arg.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())) : reply('TITLE CASE', '🔻 Provide text.', 'red');
            case 'repeat': {
                const m = arg.match(/^(\d{1,2})\s+([\s\S]+)$/);
                if (!m) return reply('REPEAT', '🔻 Usage: `.repeat 3 hello`', 'red');
                const n = Math.min(20, Number(m[1]));
                return reply('REPEAT', Array(n).fill(m[2]).join('\n'));
            }
            case 'wordcount':
                return reply('WORD COUNT', `📝 *Words:* ${arg ? arg.split(/\s+/).length : 0}`);
            case 'charcount':
                return reply('CHAR COUNT', `🔤 *Characters:* ${arg.length}`);
            case 'linecount':
                return reply('LINE COUNT', `📄 *Lines:* ${arg ? arg.split(/\r?\n/).length : 0}`);
            case 'vowels':
                return reply('VOWELS', `🔡 *Vowels:* ${(arg.match(/[aeiou]/gi) || []).length}`);
            case 'palindrome':
                return reply('PALINDROME', `🔁 ${arg && arg.toLowerCase().replace(/[^a-z0-9]/g,'') === arg.toLowerCase().replace(/[^a-z0-9]/g,'').split('').reverse().join('') ? '*Yes, palindrome.*' : '*No, not a palindrome.*'}`);
            case 'calc': {
                if (!arg) return reply('CALCULATOR', '🔻 Usage: `.calc 12 * (5 + 2)`', 'red');
                try {
                    const math = require('mathjs');
                    const result = math.evaluate(arg);
                    return reply('CALCULATOR', `🧮 \`${arg}\` = *${String(result)}*`);
                } catch {
                    return reply('CALCULATOR', '🔻 Invalid expression.', 'red');
                }
            }
            case 'random': {
                const nums = parseNumbers(arg);
                const min = nums.length >= 2 ? nums[0] : 1;
                const max = nums.length >= 2 ? nums[1] : (nums.length === 1 ? nums[0] : 100);
                if (max < min) return reply('RANDOM', '🔻 Max must be greater than min.', 'red');
                return reply('RANDOM', `🎲 *${Math.floor(Math.random() * (max - min + 1)) + min}*`);
            }
            case 'dice':
                return reply('DICE', `🎲 *${Math.floor(Math.random() * 6) + 1} / 6*`);
            case 'coinflip':
                return reply('COIN FLIP', `🪙 *${Math.random() < 0.5 ? 'HEADS' : 'TAILS'}*`);
            case 'choose': {
                const options = arg.split('|').map(x => x.trim()).filter(Boolean);
                return reply('CHOOSER', options.length ? `🎯 *${randomItem(options)}*` : '🔻 Usage: `.choose red | blue | green`', options.length ? 'blue' : 'red');
            }
            case '8ball':
                return reply('8 BALL', `🎱 *${randomItem(EIGHT_BALL)}*`);
            case 'quote':
                return reply('QUOTE', `💬 _${randomItem(EXTRA_QUOTES)}_`);
            case 'joke':
                return reply('JOKE', `😂 ${randomItem(EXTRA_JOKES)}`);
            case 'fact':
                return reply('FACT', `🧠 ${randomItem(EXTRA_FACTS)}`);
            case 'compliment':
                return reply('COMPLIMENT', `✨ ${firstName}, you're doing better than you think.`);
            case 'roast':
                return reply('ROAST', `🔥 ${firstName}, your Wi-Fi has more stability than your plans.`);
            case 'ship': {
                const names = arg.split(/\s+/).filter(Boolean);
                if (names.length < 2) return reply('SHIP', '🔻 Usage: `.ship Alice Bob`', 'red');
                return reply('SHIP', `💞 *${names[0]} × ${names[1]}:* ${Math.floor(Math.random()*101)}%`);
            }
            case 'love':
                return reply('LOVE METER', `❤️ *Love level:* ${Math.floor(Math.random()*101)}%`);
            case 'rps': {
                const choices = ['rock','paper','scissors'];
                const pick = arg.toLowerCase();
                if (!choices.includes(pick)) return reply('RPS', '🔻 Usage: `.rps rock|paper|scissors`', 'red');
                const botPick = randomItem(choices);
                const win = (pick === 'rock' && botPick === 'scissors') || (pick === 'paper' && botPick === 'rock') || (pick === 'scissors' && botPick === 'paper');
                const result = pick === botPick ? 'Draw 🤝' : win ? 'You win 🏆' : 'Bot wins 🤖';
                return reply('RPS', `You: *${pick}*\nBot: *${botPick}*\n\n*${result}*`);
            }
            case 'truth':
                return reply('TRUTH', `🎯 ${randomItem(['What is one goal you have not told anyone?','What was your funniest mistake?','What skill do you wish you had?'])}`);
            case 'dare':
                return reply('DARE', `🔥 ${randomItem(['Send a funny sticker.','Change your profile status for 10 minutes.','Compliment the last person you chatted with.'])}`);
            case 'password':
                return reply('PASSWORD', `🔐 \`${crypto.randomBytes(12).toString('base64url')}\``);
            case 'uuid':
                return reply('UUID', `🆔 \`${crypto.randomUUID()}\``);
            case 'hash': {
                if (!arg) return reply('HASH', '🔻 Usage: `.hash text`', 'red');
                return reply('SHA256', `\`${crypto.createHash('sha256').update(arg).digest('hex')}\``);
            }
            case 'base64':
                return reply('BASE64', arg ? `\`${Buffer.from(arg,'utf8').toString('base64')}\`` : '🔻 Provide text.');
            case 'unbase64':
                try { return reply('UNBASE64', arg ? `\`${Buffer.from(arg,'base64').toString('utf8')}\`` : '🔻 Provide Base64.'); } catch { return reply('UNBASE64', '🔻 Invalid Base64.', 'red'); }
            case 'urlencode':
                return reply('URL ENCODE', arg ? `\`${encodeURIComponent(arg)}\`` : '🔻 Provide text.');
            case 'urldecode':
                try { return reply('URL DECODE', arg ? decodeURIComponent(arg) : '🔻 Provide encoded text.'); } catch { return reply('URL DECODE', '🔻 Invalid encoded text.', 'red'); }
            case 'json':
                try { return reply('JSON', `\`\`\`json\n${JSON.stringify(JSON.parse(arg), null, 2)}\n\`\`\``); } catch { return reply('JSON', '🔻 Invalid JSON.', 'red'); }
            case 'timestamp':
                return reply('TIMESTAMP', `⏱️ *Unix:* \`${Math.floor(Date.now()/1000)}\`\n🕐 *ISO:* \`${new Date().toISOString()}\``);
            case 'bytes':
            case 'kb':
            case 'mb':
            case 'gb': {
                const n = Number(arg);
                if (!Number.isFinite(n)) return reply('CONVERTER', '🔻 Usage: `.kb 1024`', 'red');
                const factors = { bytes:1, kb:1024, mb:1024**2, gb:1024**3 };
                const base = command === 'bytes' ? n : n * factors[command];
                return reply('BYTES', `📦 *Bytes:* ${base.toLocaleString()}`);
            }
            case 'hex':
                return reply('HEX', arg ? `\`${Buffer.from(arg,'utf8').toString('hex')}\`` : '🔻 Provide text.');
            case 'unhex':
                try { return reply('UNHEX', arg ? `\`${Buffer.from(arg,'hex').toString('utf8')}\`` : '🔻 Provide hex.'); } catch { return reply('UNHEX', '🔻 Invalid hex.', 'red'); }
            case 'binary':
                return reply('BINARY', arg ? `\`${Buffer.from(arg,'utf8').toString('hex').match(/.{2}/g).map(h=>parseInt(h,16).toString(2).padStart(8,'0')).join(' ')}\`` : '🔻 Provide text.');
            case 'unbinary': {
                try {
                    const clean = arg.replace(/[^01]/g,'');
                    if (!clean || clean.length % 8) throw new Error();
                    const out = clean.match(/.{8}/g).map(b=>String.fromCharCode(parseInt(b,2))).join('');
                    return reply('UNBINARY', `\`${out}\``);
                } catch { return reply('UNBINARY', '🔻 Invalid binary. Use 8-bit groups.', 'red'); }
            }
            case 'slug':
                return reply('SLUG', arg ? `\`${simpleSlug(arg)}\`` : '🔻 Provide text.');
            case 'sort': {
                const arr = parseNumbers(arg);
                return reply('SORT', arr.length ? `\`${arr.sort((a,b)=>a-b).join(', ')}\`` : '🔻 Provide numbers.');
            }
            case 'unique': {
                const vals = arg.split(/[\s,]+/).filter(Boolean);
                return reply('UNIQUE', vals.length ? `\`${[...new Set(vals)].join(', ')}\`` : '🔻 Provide values.');
            }
            case 'sum': {
                const a = parseNumbers(arg); return reply('SUM', `➕ *${a.reduce((x,y)=>x+y,0)}*`);
            }
            case 'avg': {
                const a = parseNumbers(arg); return reply('AVERAGE', a.length ? `📊 *${a.reduce((x,y)=>x+y,0)/a.length}*` : '🔻 Provide numbers.');
            }
            case 'min': {
                const a = parseNumbers(arg); return reply('MINIMUM', a.length ? `⬇️ *${Math.min(...a)}*` : '🔻 Provide numbers.');
            }
            case 'max': {
                const a = parseNumbers(arg); return reply('MAXIMUM', a.length ? `⬆️ *${Math.max(...a)}*` : '🔻 Provide numbers.');
            }
            case 'count': {
                const a = arg.split(/[\s,]+/).filter(Boolean); return reply('COUNT', `🔢 *${a.length} item(s)*`);
            }
            case 'isprime':
                return reply('PRIME CHECK', isPrimeNumber(arg) ? `✅ *${arg} is prime.*` : `❌ *${arg} is not prime.*`);
            case 'fibonacci': {
                const r = fibonacci(arg);
                return reply('FIBONACCI', r === null ? '🔻 Use an integer from 0 to 1476.' : `🌀 F(${arg}) = *${r}*`);
            }
            case 'factorial': {
                const r = factorialNumber(arg);
                return reply('FACTORIAL', r === null ? '🔻 Use an integer from 0 to 170.' : `❗ ${arg}! = *${r}*`);
            }
            case 'percent': {
                const m = arg.match(/^(-?\d+(?:\.\d+)?)\s+of\s+(-?\d+(?:\.\d+)?)$/i) || arg.match(/^(-?\d+(?:\.\d+)?)\s*%\s*(-?\d+(?:\.\d+)?)$/);
                return reply('PERCENT', m ? `📈 *${(Number(m[1])*Number(m[2])/100)}*` : '🔻 Usage: `.percent 15 of 200`');
            }
            case 'discount': {
                const m = arg.match(/^([\d.]+)\s+([\d.]+)$/);
                if (!m) return reply('DISCOUNT', '🔻 Usage: `.discount 100 20`', 'red');
                const price=Number(m[1]), pct=Number(m[2]);
                return reply('DISCOUNT', `💰 Final: *${(price*(1-pct/100)).toFixed(2)}*\n💸 Saved: *${(price*pct/100).toFixed(2)}*`);
            }
            case 'tip': {
                const m = arg.match(/^([\d.]+)\s+([\d.]+)$/);
                if (!m) return reply('TIP', '🔻 Usage: `.tip 5000 10`', 'red');
                const bill=Number(m[1]), pct=Number(m[2]);
                return reply('TIP', `💵 Tip: *${(bill*pct/100).toFixed(2)}*\n🧾 Total: *${(bill*(1+pct/100)).toFixed(2)}*`);
            }
            case 'convert': {
                const m = arg.match(/^([\d.]+)\s*(km|m|cm|mm|mi|ft|kg|g|lb|c|f)\s+(km|m|cm|mm|mi|ft|kg|g|lb|c|f)$/i);
                if (!m) return reply('CONVERT', '🔻 Example: `.convert 10 km mi`', 'red');
                const n=Number(m[1]), from=m[2].toLowerCase(), to=m[3].toLowerCase();
                const length={mm:0.001,cm:0.01,m:1,km:1000,mi:1609.344,ft:0.3048};
                const mass={g:0.001,kg:1,lb:0.45359237};
                let out=null;
                if (length[from] && length[to]) out=n*length[from]/length[to];
                else if (mass[from] && mass[to]) out=n*mass[from]/mass[to];
                else if ((from==='c'||from==='f')&&(to==='c'||to==='f')) out=from===to?n:(from==='c'?n*9/5+32:(n-32)*5/9);
                return reply('CONVERT', out===null?'🔻 Incompatible units.':`🔄 *${n} ${from} = ${out} ${to}*`);
            }
            case 'contact':
                return reply('CONTACT', `📞 *Owner:* ${global.ownername || 'Bot Owner'}\n${PULSE.arrow} Use the support link below or contact the bot administrator https://t.me/RMS_HK or wa.me/2349129873629.`);
            case 'support':
                return reply('SUPPORT', `🛟 Need help?\n\n${PULSE.arrow} Telegram group: ${SOCIAL_LINKS.group}\n${PULSE.arrow} Channel: ${SOCIAL_LINKS.channel}`);
            case 'admin':
                return reply('ADMIN', `👑 *Administrators:* ${adminIDs.length}\n${PULSE.arrow} Use '.listpair confirm' to view paired devices.`);
            case 'users':
                if (!adminIDs.includes(String(user.id))) return reply('ADMIN ONLY', '🔴 Access denied.', 'red');
                return reply('USERS', `👥 *Registered users:* ${userIDs.size}\n\n${[...userIDs].slice(0,30).map((id,i)=>`${i+1}. \`${id}\``).join('\n') || 'No users recorded.'}`);
            case 'stats':
                return reply('STATS', `📊 *Bot Statistics*\n\n${PULSE.arrow} Users: ${userIDs.size}\n${PULSE.arrow} Admins: ${adminIDs.length}\n${PULSE.arrow} Uptime: ${runtime(process.uptime())}\n${PULSE.arrow} RAM: ${(process.memoryUsage().rss/1024/1024).toFixed(2)} MB`);
            case 'source':
                return reply('SOURCE', `⚡ *${global.BOT_NAME || 'VICO XMD'}*\n\nThis deployment uses a modular Node.js Telegram/WhatsApp bot architecture.`);
            default:
                return;
        }
    } catch (err) {
        console.error(chalk.red(`Extra command ${command} error:`), err);
        return reply('COMMAND ERROR', '🔴 Something went wrong. Try again.', 'red');
    }
})));

// ========================
// CALLBACK QUERY HANDLER
// ========================
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const chatId = msg.chat.id;

    await trackUser(userId);

    if (data === 'dismiss') {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Dismissed' });
        return bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    }

    if (data === 'refresh_runtime') {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '🔵 Refreshed' });
        const uptime = runtime(process.uptime());
        const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const content = `🔵 *Status* — Online & Running

  ${PULSE.arrow} *Uptime*   ${uptime}
  ${PULSE.arrow} *Memory*   ${memory} MB
  ${PULSE.arrow} *Users*    ${formatNumber(userIDs.size)} registered`;

        const caption = `${wrapTitle('SYSTEM STATUS', 'blue')}\n${PULSE.barBlue}\n${content}\n${PULSE.divider}\n_${PULSE.footer}_`;
        await bot.editMessageMedia({
            type: 'photo',
            media: BANNER_URL,
            caption,
            parse_mode: 'Markdown'
        }, {
            chat_id: chatId,
            message_id: msg.message_id,
            reply_markup: { inline_keyboard: [[{ text: 'REFRESH', callback_data: 'refresh_runtime', style: 'primary' }]] }
        }).catch(() => {});
        return;
    }

    if (data === 'check_membership') {
        try {
            await bot.answerCallbackQuery(callbackQuery.id, { text: '🔵 Checking membership...' });

            const membership = await checkMembership(userId);

            if (membership.hasJoinedAll) {
                const content = `🔵 *Access Granted, ${callbackQuery.from.first_name}!*

  📲 *COMMANDS*
  ${PULSE.arrow} /pair or .pair \`num\` — Connect WhatsApp
  ${PULSE.arrow} /delpair \`num\` — Remove device
  ${PULSE.arrow} /listpair or .listpair confirm — View devices
  ${PULSE.arrow} /ping — Latency check
  ${PULSE.arrow} /runtime — Bot uptime`;

                const verifiedCaption = `${wrapTitle('WELCOME', 'blue')}\n${PULSE.barBlue}\n${content}\n${PULSE.divider}\n_${PULSE.footer}_`;
                await bot.editMessageMedia({
                    type: 'photo',
                    media: BANNER_URL,
                    caption: verifiedCaption,
                    parse_mode: 'Markdown'
                }, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'GROUP', url: SOCIAL_LINKS.group, style: 'primary' },
                                { text: 'CHANNEL', url: SOCIAL_LINKS.channel, style: 'primary' }
                            ]
                        ]
                    }
                });
            } else {
                const deniedCaption = `${wrapTitle('ACCESS DENIED', 'red')}\n${PULSE.barRed}\n  You haven't joined the group & channels yet.\n  Join them and tap 🔵 *VERIFY* again.\n${PULSE.divider}\n_${PULSE.footer}_`;
                await bot.editMessageMedia({
                    type: 'photo',
                    media: BANNER_URL,
                    caption: deniedCaption,
                    parse_mode: 'Markdown'
                }, {
                    chat_id: chatId,
                    message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'JOIN GROUP', url: SOCIAL_LINKS.group, style: 'primary' },
                                { text: 'JOIN CHANNEL', url: SOCIAL_LINKS.channel, style: 'primary' }
                            ],
                            [
                                { text: 'JOIN CHANNEL 2', url: SOCIAL_LINKS.channel2, style: 'primary' },
                                { text: 'JOIN BACKUP', url: SOCIAL_LINKS.backupchannel, style: 'primary' }
                            ],
                            [
                                { text: 'JOIN BIO', url: SOCIAL_LINKS.bio, style: 'primary' }
                            ],
                            [{ text: 'VERIFY AGAIN', callback_data: 'check_membership', style: 'primary' }],
                            [{ text: 'CANCEL', callback_data: 'dismiss', style: 'danger' }]
                        ]
                    }
                });
            }
        } catch (error) {
            console.error(chalk.red('Callback error:'), error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Error checking membership' });
        }
    }
});

// ========================
// UNKNOWN COMMAND HANDLER
// ========================
bot.on('message', async (msg) => {
    if (msg.text && (msg.text.startsWith('/') || msg.text.startsWith('.'))) {
        const command = msg.text.split(' ')[0];
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const validCommands = ['/start', '/pair', '.pair', '/delpair', '/listpair', '.listpair', '/ping', '/runtime', ...EXTRA_COMMANDS.map(c => '/' + c), ...EXTRA_COMMANDS.map(c => '.' + c)];

        if (!validCommands.includes(command)) {
            await trackUser(userId);

            if (!adminIDs.includes(userId.toString()) && REQUIRE_MEMBERSHIP) {
                const membership = await checkMembership(userId);
                if (!membership.hasJoinedAll) {
                    return sendJoinRequirement(chatId);
                }
            }

            const content = `🔴 *Unknown command*

  📲 *AVAILABLE*
  ${PULSE.arrow} /pair or .pair \`num\`
  ${PULSE.arrow} /delpair \`num\`
  ${PULSE.arrow} /listpair or .listpair confirm
  ${PULSE.arrow} /ping
  ${PULSE.arrow} /runtime`;

            sendStyledMessage(chatId, 'UNKNOWN COMMAND', content, null, 'red');
        }
    }
});

// ========================
// ERROR HANDLERS
// ========================
bot.on('polling_error', (error) => {
    console.error(chalk.red('Polling error:'), error.message);
});

bot.on('webhook_error', (error) => {
    console.error(chalk.red('Webhook error:'), error.message);
});

// ========================
// INITIALIZATION
// ========================
(async () => {
    console.log(chalk.cyan('\n◆ ⟦ VICO XMD PULSE — INITIALIZING ⟧'));
    console.log(chalk.cyan('┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n'));

    await ensureDirectoryExists(DATA_DIR);
    await ensureDirectoryExists(path.join(DATA_DIR, 'pairing'));

    await loadAdminIDs();
    await loadUserIDs();

    console.log(chalk.cyan(`
◆ ⟦ VICO XMD — PULSE EDITION ⟧
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  🔵 Status   Running
  🔵 Users    ${userIDs.size}
  🔵 Admins   ${adminIDs.length}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
◆ VICO · PULSE ◆
    `));

    console.log(chalk.green(`✓ Membership checking: ${REQUIRE_MEMBERSHIP ? 'ENABLED' : 'DISABLED'}`));
    console.log(chalk.green(`✓ All systems ready!\n`));

    // Auto-load pairs
    setTimeout(async () => {
        try {
            console.log(chalk.cyan('📱 Starting auto-load of paired devices...'));
            const result = await autoLoadPairs({ batchSize: 1 });
            if (result.success) {
                console.log(chalk.green(`✓ Auto-load completed: ${result.successful}/${result.total} users connected`));
                if (result.failedUsers && result.failedUsers.length > 0) {
                    console.log(chalk.yellow(`⚠️ Failed connections: ${result.failedUsers.length}`));
                }
            } else {
                console.log(chalk.yellow(`⚠️ Auto-load skipped: ${result.message}`));
            }
        } catch (err) {
            console.error(chalk.red('✗ Auto-load pairs failed:'), err.message);
        }
    }, 8000);
})();

// ========================
// SHUTDOWN HANDLERS
// ========================
const shutdown = async () => {
    console.log(chalk.yellow('\n🛑 Shutting down VICO XMD...'));
    await saveUserIDs();
    bot.stopPolling();
    console.log(chalk.green('✓ Data saved. Goodbye!'));
    process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught Exception:'), error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection:'), reason);
});
