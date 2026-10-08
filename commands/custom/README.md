# VICO XMD custom commands

Add new commands here without editing `core/case.js`.

```js
module.exports = {
  name: 'hello',
  aliases: ['hi'],
  description: 'Say hello',
  async execute({ reply, text }) {
    await reply(`Hello ${text || 'there'}!`);
  }
};
```

Available context: `sock`, `message`, `jid`, `args`, `text`, `command`, `prefix`, `reply`, `isGroup`, `isCreator`, `isAdmins`, `isBotAdmins`, `groupMetadata`, `participants`, `db`.

The loader is intentionally separate from the large legacy switch so existing commands keep working while new commands stay modular.
