'use strict';

// Per-session sudo-user ledger. A jid in here is treated as if it were
// the bot owner (fromMe) for private-mode and premium gating — same
// factory-per-dataDir pattern as premium.js/settings.js so concurrently
// linked accounts never share sudo lists.

const fs = require('fs');
const path = require('path');

function createSudoStore(dataDir) {
  const FILE = path.join(dataDir, 'sudo.json');

  function load() {
    try {
      return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      return {};
    }
  }

  function save(data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  }

  let cache = load();

  // WhatsApp may expose an approved user as either a phone JID or a LID.
  // The command handler checks both participant and participantAlt, so this
  // store keeps the exact identity that was approved instead of incorrectly
  // equating unrelated phone numbers and LIDs just because their nodes match.
  function jidNode(j) {
    return String(j || '').split('@')[0].split(':')[0];
  }

  function findKey(jid) {
    if (!jid) return undefined;
    const value = String(jid);
    const exact = Object.keys(cache).find((k) => k === value);
    if (exact) return exact;

    // Keep backward compatibility with older sudo.json entries. Only use
    // node matching inside the same namespace; never equate a phone JID with
    // a LID just because both contain the same numeric node.
    const at = value.indexOf('@');
    const kind = at >= 0 ? value.slice(at + 1).split(':')[0] : '';
    const node = jidNode(value);
    if (!node || !kind) return undefined;

    return Object.keys(cache).find((k) => {
      const kat = k.indexOf('@');
      const kkind = kat >= 0 ? k.slice(kat + 1).split(':')[0] : '';
      return kkind === kind && jidNode(k) === node;
    });
  }

  function isSudo(jid) {
    return !!findKey(jid);
  }

  function addSudo(jid, note) {
    const existing = findKey(jid);
    if (existing && existing !== jid) delete cache[existing];
    cache[jid] = { since: Date.now(), note: note || null };
    save(cache);
  }

  function removeSudo(jid) {
    const existing = findKey(jid);
    if (existing) {
      delete cache[existing];
      save(cache);
      return true;
    }
    return false;
  }

  function listSudo() {
    return { ...cache };
  }

  return { isSudo, addSudo, removeSudo, listSudo };
}

module.exports = { createSudoStore };
