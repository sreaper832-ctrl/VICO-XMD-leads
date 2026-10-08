'use strict';

// Per-session record of every distinct WhatsApp user who has messaged this
// linked number, used to power things like "N people are using this bot"
// (see: channel auto-reaction in antiFeatures.js). Factory per session for
// the same reason as groupSettings.js/economy.js — one linked number's
// user count should never leak into another's.

const fs = require('fs');
const path = require('path');

function createUserStatsStore(dataDir) {
  const FILE = path.join(dataDir, 'userStats.json');

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      return Array.isArray(parsed.users) ? parsed.users : [];
    } catch {
      return [];
    }
  }

  function save() {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ users: [...users] }, null, 2));
  }

  const users = new Set(load());

  // Strips the WhatsApp device suffix (":12@s.whatsapp.net") down to the
  // bare number, so the same person on multiple linked devices only ever
  // counts once.
  function normalize(jid) {
    return String(jid || '').split(':')[0].split('@')[0];
  }

  function trackUser(jid) {
    const id = normalize(jid);
    if (!id || users.has(id)) return false;
    users.add(id);
    save();
    return true; // true means this was a brand-new user
  }

  function getUserCount() {
    return users.size;
  }

  return { trackUser, getUserCount };
}

module.exports = { createUserStatsStore };
