require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ Thiếu biến môi trường cần thiết!");
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Đang đăng ký commands...');
    
    const commandsData = commands.map(cmd => cmd.data.toJSON());
    
    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commandsData }
    );

    console.log(`✅ Đã đăng ký ${data.length} commands thành công:`);
    console.log(data.map(cmd => `- /${cmd.name}`).join('\n'));
    
  } catch (error) {
    console.error('❌ Lỗi khi đăng ký commands:', error);
    process.exit(1);
  }
})();