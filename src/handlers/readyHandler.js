const { REST, Routes } = require('discord.js');
const commands = require('../commands');

module.exports = async (client) => {
  console.log(`🤖 Bot đã online với tên: ${client.user.tag}`);
  console.log(`🆔 Bot ID: ${client.user.id}`);
  console.log(`📡 Đang kết nối đến ${client.guilds.cache.size} servers`);

  try {
    // Chuyển đổi commands sang JSON
    const commandsData = commands.map(cmd => cmd.data.toJSON());
    
    // Khởi tạo REST client
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    console.log('🔄 Đang đăng ký slash commands...');
    
    // Deploy commands
    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commandsData }
    );

    console.log(`✅ Đã đăng ký ${data.length} commands thành công:`);
    data.forEach(cmd => console.log(`- /${cmd.name}`));
    
    // Set bot presence
    client.user.setPresence({
      activities: [{ name: '/tool | /thoitiet', type: 2 }], // 2 = Listening
      status: 'online'
    });
    
  } catch (error) {
    console.error('❌ Lỗi khi đăng ký commands:', error);
  }
};