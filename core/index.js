const fs = require('fs');
const path = require('path');
function _safeChalk(){try{return require('chalk')}catch(_){const id=s=>s==null?'':String(s);return new Proxy(id,{get:(t,p)=>p==='hex'||p==='rgb'||p==='bgHex'?()=>t:t,apply:(t,a,args)=>id(args[0])})}}
function _safeFiglet(){try{return require('figlet')}catch(_){return{textSync:s=>String(s||''),text:(s,o,cb)=>cb&&cb(null,String(s||''))}}}
const chalk=_safeChalk();
const figlet=_safeFiglet();
const express=require('express');

// IMPORTANT: pair.js exports startpairing directly (module.exports = startpairing)
const startpairing = require('./pair');

const { STORAGE_DIR, PAIRING_DIR, AUTH_FILE } = require('../lib/paths');
const PAIRING_FILE = path.join(PAIRING_DIR, 'pairing.json');

// ========================
// RAILWAY HEALTH SERVER
// ========================
// Railway requires an HTTP service to bind to PORT within 60 seconds or
// it marks the deploy as unhealthy. This tiny Express server satisfies that.
const PORT = process.env.PORT || 3000;
const healthApp = express();

healthApp.use(express.json());
healthApp.use('/media', express.static(path.join(__dirname, '..', 'media')));

healthApp.get('/health', (_, res) => res.status(200).json({
    status: 'ok',
    bot: 'VICO XMD',
    uptime: process.uptime().toFixed(0) + 's'
}));

healthApp.get('/', (_, res) => res.redirect(302, '/pair'));
healthApp.get('/ready', (_, res) => res.status(200).json({ ready: true, service: 'VICO XMD' }));

// ========================
// WEB PAIRING
// ========================
// Serves a small web page where a user can enter their WhatsApp number and
// receive a pairing code, without needing the Telegram bot's /pair command.
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const webpairRateLimit = new Map(); // ip -> last request timestamp
const WEBPAIR_COOLDOWN_MS = 30000;

healthApp.get('/pair', (_, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'pair.html'));
});

healthApp.post('/api/webpair', async (req, res) => {
    try {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const lastRequest = webpairRateLimit.get(ip) || 0;
        const now = Date.now();

        if (now - lastRequest < WEBPAIR_COOLDOWN_MS) {
            const waitSecs = Math.ceil((WEBPAIR_COOLDOWN_MS - (now - lastRequest)) / 1000);
            return res.status(429).json({ error: `Please wait ${waitSecs}s before requesting another code.` });
        }

        const rawNumber = String(req.body?.number || '').trim();
        const number = rawNumber.replace(/[^0-9]/g, '');

        if (!number || rawNumber.startsWith('0') || !/^\d{7,15}$/.test(number)) {
            return res.status(400).json({ error: 'Enter a valid number with country code, no leading 0.' });
        }

        webpairRateLimit.set(ip, now);
        const jid = number + '@s.whatsapp.net';

        let resolveCode;
        const codePromise = new Promise(resolve => { resolveCode = resolve; });

        // Get the code directly from the pairing socket. This avoids stale or
        // cross-user results caused by polling one shared pairing.json file.
        await startpairing(jid, { onPairingCode: resolveCode });

        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Timed out waiting for a pairing code. Please try again.')), 25000);
        });

        try {
            const code = await Promise.race([codePromise, timeout]);
            clearTimeout(timer);
            return res.status(200).json({ code, number });
        } catch (e) {
            clearTimeout(timer);
            return res.status(504).json({ error: e.message });
        }
    } catch (err) {
        console.log(chalk.red('Web pairing error:'), err);
        return res.status(500).json({ error: err.message || 'Failed to generate a pairing code.' });
    }
});

healthApp.listen(PORT, () => {
    console.log(chalk.green(`✅ Health server listening on port ${PORT}`));
    console.log(chalk.green(`✅ Web pairing available at /pair`));
});

// ========================
// HELPERS
// ========================
function ensureAuthenticated() {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ authenticated: true }, null, 2));
}

// ========================
// LAUNCH BOT MODULES
// ========================
function launchBot() {
    console.clear();
    console.log(chalk.green('Starting VICO XMD...\n'));

    let telegramLoaded = false;
    let whatsappLoaded = false;

    const botPath = path.join(__dirname, 'bot.js');
    if (fs.existsSync(botPath)) {
        try {
            console.log(chalk.blue('📱 Loading Telegram bot...'));
            require('./bot');
            telegramLoaded = true;
            console.log(chalk.green('✅ Telegram bot active'));
        } catch (error) {
            console.log(chalk.red('❌ Failed to load Telegram bot:', error.message));
            console.log(chalk.yellow('⚠️  Continuing without Telegram bot...\n'));
        }
    } else {
        console.log(chalk.yellow('⚠️  bot.js not found, skipping Telegram bot...\n'));
    }

    const casePath = path.join(__dirname, 'case.js');
    if (fs.existsSync(casePath)) {
        try {
            console.log(chalk.blue('💬 Loading WhatsApp commands...'));
            require('./case');
            whatsappLoaded = true;
            console.log(chalk.green('✅ WhatsApp commands loaded'));
        } catch (error) {
            console.log(chalk.red('❌ Failed to load WhatsApp commands:', error.message));
            console.log(chalk.yellow('⚠️  Continuing without WhatsApp commands...\n'));
        }
    } else {
        console.log(chalk.yellow('⚠️  case.js not found, skipping WhatsApp commands...\n'));
    }

    console.log(chalk.cyan('\n⚄︎═══════════════════════════════⚄︎'));
    console.log(chalk.bold.white('  BOT INITIALIZATION SUMMARY'));
    console.log(chalk.cyan('⚄︎════════════════════════════════⚄︎'));
    console.log(telegramLoaded ? chalk.green('✅ Telegram Bot: ACTIVE') : chalk.red('❌ Telegram Bot: INACTIVE'));
    console.log(whatsappLoaded ? chalk.green('✅ WhatsApp Commands: ACTIVE') : chalk.red('❌ WhatsApp Commands: INACTIVE'));
    console.log(chalk.cyan('⚄︎════════════════════════════════⚄︎\n'));

    if (!telegramLoaded && !whatsappLoaded) {
        console.log(chalk.red('⚠️  Warning: No bot systems loaded! Check your config.\n'));
    } else {
        console.log(chalk.green('✅ VICO XMD is running!\n'));
    }

    const ignoredErrors = [
        'Socket connection timeout', 'EKEYTYPE', 'item-not-found',
        'rate-overlimit', 'Connection Closed', 'Timed Out', 'Value not found'
    ];

    process.on('unhandledRejection', (reason) => {
        if (ignoredErrors.some(e => String(reason).includes(e))) return;
        console.log(chalk.red('\n⚠️  Unhandled Promise Rejection:'), reason);
    });

    process.on('uncaughtException', (error) => {
        if (ignoredErrors.some(e => String(error).includes(e))) return;
        console.log(chalk.red('\n❌ Uncaught Exception:'), error.message);
        if (error.stack) console.log(chalk.gray(error.stack));
    });

    const originalConsoleError = console.error;
    console.error = function (message, ...args) {
        if (typeof message === 'string' && ignoredErrors.some(e => message.includes(e))) return;
        originalConsoleError.apply(console, [message, ...args]);
    };
}

// ========================
// INITIALIZE
// ========================
const initializeBot = async () => {
    console.clear();
    try {
        console.log(chalk.cyan(figlet.textSync('VICO XMD', {
            font: 'Standard',
            horizontalLayout: 'default',
            verticalLayout: 'default'
        })));
    } catch (e) {
        console.log(chalk.cyan('=== VICO XMD ==='));
    }

    console.log(chalk.yellow('\n⚄︎══════════════════════⚄︎'));
    console.log(chalk.green('VICO XMD — Railway Edition'));
    console.log(chalk.yellow('⚄︎═════════════════════⚄︎\n'));

    ensureAuthenticated();
    console.log(chalk.green('✅ Auto-authenticated for server deployment.'));

    // NOTE: autoLoadPairs is handled inside bot.js (8 seconds after startup).
    // Calling it here too would double-connect all paired users — so we skip it.
    launchBot();
};

// ========================
// GRACEFUL SHUTDOWN
// ========================
process.once('SIGINT', () => {
    console.log(chalk.yellow('\n\n⚠️  Shutting down gracefully...'));
    process.exit(0);
});

process.once('SIGTERM', () => {
    console.log(chalk.yellow('\n\n⚠️  Received termination signal...'));
    process.exit(0);
});

initializeBot().catch((error) => {
    console.log(chalk.red('\n❌ Fatal error during initialization:'), error.message);
    if (error.stack) console.log(chalk.gray(error.stack));
    process.exit(1);
});
