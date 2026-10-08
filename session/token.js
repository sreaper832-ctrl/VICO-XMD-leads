'use strict';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN) console.warn('⚠️ BOT_TOKEN is not set; Telegram control bot will stay disabled.');

module.exports = { BOT_TOKEN };
