const fs = require('fs')

// ===== BOT IDENTITY =====
global.owner = ['2349129873629']           // owner number (final)
global.ownernumber = '2349129873629'       // creator number
global.OWNER_NAME = "𝐌𝐑 𝐑𝐌𝐒"
global.DEVELOPER = ["2349129873629"]
global.BOT_NAME = "𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳"
global.botName = "𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳"
global.botname = "𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳"
global.bankowner = "𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳"
global.creatorName = "𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳"
global.ownername = '𝐌𝐑 𝐑𝐌𝐒 '
global.author = "𝐃𝐄𝐕 𝐑𝐌𝐒 "        // final (was set twice)
global.creator = "2349129873629@s.whatsapp.net"

// ===== BOT SETTINGS =====
global.status = false                      // "self/public" section
global.prefa = ['','!','.','#','&']        // prefixes
global.xprefix = '.'
global.prefix = process.env.BOT_PREFIX || '.'
global.version = "1.0.1"
global.themeemoji = "🥷"
global.location = "Nigeria,lagos island"

// ===== LINKS & MEDIA =====
global.gambar = "https://files.catbox.moe/diyll7.jpg"
global.thumbnail = 'https://files.catbox.moe/diyll7.jpg'
global.link = "https://chat.whatsapp.com/KAjUdEoPJMe85CArrtpsuG?s=cl&p=a&mlu=4"
global.wagc = 'https://chat.whatsapp.com/KAjUdEoPJMe85CArrtpsuG?s=cl&p=a&mlu=4'
global.richpp = ' '
global.packname = "Sticker By 𝐃𝐄𝐕 𝐑𝐌𝐒"

// ===== MENU IMAGE =====
global.menuImage = __dirname + '/../media/logo.jpg'   // local file used as the menu thumbnail

// ===== NEWSLETTER / CHANNEL CONTEXT =====
// Used to make bot messages show a "forwarded from channel" tag with a View channel button.
global.newsletterJid = "0029Vb84j7NFy72Ffx2t1a38@newsletter"
global.newsletterName = "𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳"

// ===== DISPLAY =====
global.footer = "𝐕𝐈𝐂𝐎 𝐗𝐌𝐃 𓉳"             // final (was set twice)
global.onlyowner = `Only 𝐃𝐄𝐕 𝐑𝐌𝐒 can use this Command 🥶🥷`
global.database = `*To Exist In The Database Contact The Owner of this bot*`

// ===== FEATURES =====
global.autobio = true                      // auto update bio
global.hituet = 0
global.autoviewstatus = false
global.autoread = false                    // auto read messages
global.anti92 = true                       // auto block +92
global.autoswview = true                   // auto view status/story

// ===== MESSAGES =====
global.mess = {
    wait: "*Configurating.......*",
    success: "*Successfully acknowledged ☑️*",
    on: "*Activated ✅*",
    prem: "*Feature For Premium Users only*",
    off: "*Deactivated 📛*",
    query: {
        text: "*Please, Provide A Text Query 📑*",
        link: "Please, provide a valid link 🔗*",
    },
    error: {
        fitur: "*Status 🌐: Feature Or Command error ❌*",
    },
    only: {
        group: "*Group only feature ❌*",
        private: "*Private chat feature only ❌*",
        owner: "*Owner feature only ❌*",
        admin: "*bot owner feature only ❌*",
        badmin: "*Seek admin privilege's to use this command ❌*",
        premium: "*Availabe for premium users only ❌*",
    }
}

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file)
  console.log('\x1b[0;32m'+__filename+' \x1b[1;32mupdated!\x1b[0m')
  delete require.cache[file]
  require(file)
})

//Property of Violetkingdev  
//owner number:+2347059886720
//telegram :@VIOLETKINGDEV
