const { Client, GatewayIntentBits } = require('discord.js');
const { DISCORD_INTENTS } = require('./constants');

module.exports = new Client({
  intents: DISCORD_INTENTS.map(intent => GatewayIntentBits[intent])
});