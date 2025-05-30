require('dotenv').config();

// Import các dependencies
const discordClient = require('./config/discordClient');
const readyHandler = require('./handlers/readyHandler');
const messageHandler = require('./handlers/messageHandler');
const interactionHandler = require('./handlers/interactionHandler');

// Đăng ký các event handlers
discordClient.once('ready', () => readyHandler(discordClient));
discordClient.on('messageCreate', messageHandler);
discordClient.on('interactionCreate', interactionHandler);

// Đăng nhập bot
discordClient.login(process.env.DISCORD_TOKEN);
