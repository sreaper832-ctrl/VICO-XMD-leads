'use strict';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeJid(jid) {
  const value = clean(jid);
  if (!value) return '';
  return value.replace(/:\d+(?=@)/, '');
}

function jidVariants(jid) {
  const value = normalizeJid(jid);
  if (!value) return [];
  const [node, server = ''] = value.split('@');
  if (!node) return [];
  const out = new Set([value]);
  if (server === 's.whatsapp.net' || server === 'c.us' || server === 'lid') {
    out.add(`${node}@s.whatsapp.net`);
    out.add(`${node}@c.us`);
    out.add(`${node}@lid`);
  }
  return [...out];
}

function getSenderIds(msg, sock) {
  const key = msg?.key || {};
  const ids = [];
  const add = (v) => { if (v && !ids.includes(v)) ids.push(v); };

  add(key.participant);
  add(key.participantAlt);
  add(msg?.participant);

  if (key.fromMe) {
    add(sock?.user?.id);
    add(sock?.user?.lid);
    add(sock?.authState?.creds?.me?.id);
    add(sock?.authState?.creds?.me?.lid);
  } else if (!key.participant && !key.participantAlt) {
    add(key.remoteJid);
  }

  return ids.flatMap(jidVariants).filter(Boolean);
}

function sameIdentity(a, b) {
  if (!a || !b) return false;
  const A = new Set(jidVariants(a));
  return jidVariants(b).some(v => A.has(v));
}

function isGroupAdmin(metadata, identities) {
  const ids = Array.isArray(identities) ? identities : [identities];
  return !!metadata?.participants?.some(p =>
    p?.admin && ids.some(id => sameIdentity(id, p.id) || sameIdentity(id, p.lid) || sameIdentity(id, p.jid))
  );
}

module.exports = { normalizeJid, jidVariants, getSenderIds, sameIdentity, isGroupAdmin };
