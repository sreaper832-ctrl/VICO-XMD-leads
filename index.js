'use strict';
const { cleanupTempFiles } = require('./lib/diskCleanup');
cleanupTempFiles();
setInterval(cleanupTempFiles, 5 * 60 * 1000).unref();
// KataBump/Pterodactyl entry point for VICO XMD.
require('./core/index.js');
