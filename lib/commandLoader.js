'use strict';

const fs = require('fs');
const path = require('path');

const COMMAND_DIR = path.join(__dirname, '..', 'commands', 'custom');
let registry = new Map();
let loaded = false;

function loadCommands(force = false) {
  if (loaded && !force) return registry;
  registry = new Map();
  if (!fs.existsSync(COMMAND_DIR)) {
    fs.mkdirSync(COMMAND_DIR, { recursive: true });
    loaded = true;
    return registry;
  }

  for (const file of fs.readdirSync(COMMAND_DIR)) {
    if (!file.endsWith('.js') || file.startsWith('_')) continue;
    const full = path.join(COMMAND_DIR, file);
    try {
      delete require.cache[require.resolve(full)];
      const command = require(full);
      if (!command || typeof command.execute !== 'function' || !command.name) {
        console.warn(`[commands] skipped ${file}: missing name/execute`);
        continue;
      }
      const names = [command.name, ...(command.aliases || [])]
        .map(String).map(s => s.toLowerCase().trim()).filter(Boolean);
      for (const name of names) registry.set(name, command);
    } catch (err) {
      console.error(`[commands] failed to load ${file}:`, err.message);
    }
  }
  loaded = true;
  return registry;
}

async function runCommand(name, context) {
  const command = loadCommands().get(String(name || '').toLowerCase());
  if (!command) return false;
  await command.execute(context);
  return true;
}

function listCommands() {
  return [...new Set([...loadCommands().values()].map(c => c.name))].sort();
}

module.exports = { loadCommands, runCommand, listCommands, COMMAND_DIR };
