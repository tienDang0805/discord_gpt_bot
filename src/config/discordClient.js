const { Client, GatewayIntentBits } = require('discord.js');
const { DISCORD_INTENTS } = require('./constants');
const MusicService = require('../services/musicService');

const client = new Client({
  intents: DISCORD_INTENTS.map(intent => GatewayIntentBits[intent])
});

// Initialize music service
client.musicService = new MusicService();
console.log("MusicService initialized?", client.musicService); // Nếu undefined => Lỗi khởi tạo

// Handle cleanup when client is destroyed
client.on('destroyed', () => {
  client.guilds.cache.forEach(guild => {
    client.musicService.cleanup(guild.id);
  });
});

module.exports = client;