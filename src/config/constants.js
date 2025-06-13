const path = require('path');
require('dotenv').config();

module.exports = {
  CHAT_HISTORY_FILE: path.join(__dirname, '../data/chatHistory.json'),
  CHAT_HISTORY_COLLECTION: 'chat_histories',
  DB_NAME: 'chatWithAI',
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  GEMINI_CONFIG: {
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 2,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192
    }
  },

 DISCORD_INTENTS: [
    'Guilds',
    'GuildMessages',
    'GuildVoiceStates',
    'MessageContent'
  ],
  MUSIC_EMBED_COLOR: 0x3d85c6
};