const { REST, Routes } = require('discord.js');
const commands = require('../commands');
const play = require('play-dl'); // Thêm play-dl
const BeautyService = require('../services/beautyService');
module.exports = async (client) => {
  console.log(`🤖 Bot đã online với tên: ${client.user.tag}`);
  console.log(`🆔 Bot ID: ${client.user.id}`);
  console.log(`📡 Đang kết nối đến ${client.guilds.cache.size} servers`);

  console.log('🔧 Đang khởi tạo YouTube connection...');
  try {

    console.log('✅ YouTube connection ready (No Cookie Mode)');
    console.log('ℹ️ Play-dl version:', play.version);
    
  } catch (error) {
    console.error('❌ Lỗi khởi tạo YouTube:', error.message);
  }

  client.user.setPresence({
    status: 'online',
    activities: [{
      name: '',
      type: 4
    }],
  });

  try {
    const commandsData = commands.map(cmd => cmd.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    console.log('🔄 Đang đăng ký slash commands...');
    
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID), 
      { body: commandsData }
    );

    console.log(`✅ Đã đăng ký ${data.length} commands thành công:`);
    data.forEach(cmd => console.log(`- /${cmd.name}`));
    
    client.user.setPresence({
      activities: [{ name: '/tool | /thoitiet', type: 2 }],
      status: 'online'
    });
  BeautyService.start(client);
  } catch (error) {
    console.error('❌ Lỗi khi đăng ký commands:', error);
  }
};