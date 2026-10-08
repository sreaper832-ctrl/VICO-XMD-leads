'use strict';

const path = require('path');

// Railway volumes are persistent only when mounted by the service. Set
// STORAGE_DIR=/data (or another mounted path) in Railway for persistence.
const PROJECT_ROOT = path.resolve(__dirname, '..');
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(PROJECT_ROOT, 'storage'));

module.exports = {
  PROJECT_ROOT,
  STORAGE_DIR,
  SESSION_DATA_DIR: path.join(STORAGE_DIR, 'session-data'),
  PAIRING_DIR: path.join(STORAGE_DIR, 'session-data', 'pairing'),
  DATABASE_FILE: path.join(STORAGE_DIR, 'database.json'),
  AUTH_FILE: path.join(STORAGE_DIR, 'auth.json'),
  LOG_DIR: path.join(STORAGE_DIR, 'logs'),
  TMP_DIR: path.join(STORAGE_DIR, 'tmp'),
};
