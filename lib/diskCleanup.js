'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAX_BYTES = Number(process.env.TEMP_MAX_BYTES || 80 * 1024 * 1024);
const MAX_AGE_MS = Number(process.env.TEMP_MAX_AGE_MS || 15 * 60 * 1000);

function dirs() {
  return [
    path.join(ROOT, 'tmp'),
    path.join(ROOT, 'sticker'),
    path.join(ROOT, 'src'),
    path.join(ROOT, 'core', 'src'),
    path.join(ROOT, 'storage', 'tmp'),
    path.join(require('os').tmpdir(), 'vico-xmd')
  ];
}

function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    try {
      const s = fs.statSync(p);
      if (s.isFile()) out.push({ path: p, size: s.size, mtime: s.mtimeMs });
      else if (s.isDirectory()) out.push(...filesIn(p));
    } catch (_) {}
  }
  return out;
}

function cleanupTempFiles() {
  const now = Date.now();
  const all = dirs().flatMap(filesIn);
  for (const f of all) {
    if (now - f.mtime > MAX_AGE_MS) {
      try { fs.unlinkSync(f.path); } catch (_) {}
    }
  }

  const remaining = dirs().flatMap(filesIn).sort((a, b) => a.mtime - b.mtime);
  let total = remaining.reduce((n, f) => n + f.size, 0);
  for (const f of remaining) {
    if (total <= MAX_BYTES) break;
    try { fs.unlinkSync(f.path); total -= f.size; } catch (_) {}
  }
}

function tempDir() {
  const dir = path.join(ROOT, 'tmp');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { cleanupTempFiles, tempDir };
