'use strict';

module.exports = {
  name: 'health',
  aliases: ['healthcheck'],
  description: 'Show bot process health.',
  async execute({ reply }) {
    const mem = process.memoryUsage();
    await reply(
      `🟢 *VICO XMD HEALTH*\n\n` +
      `⏱️ Uptime: *${Math.floor(process.uptime())}s*\n` +
      `🧠 Heap: *${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB*\n` +
      `🟢 Status: *Healthy*`
    );
  }
};
