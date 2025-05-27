const { SlashCommandBuilder } = require('discord.js');
const GptChatService = require('./services/gptChatService');
const { getWeatherDescription } = require('./services/weather');

module.exports = [
  // Command thoitiet
  {
    data: new SlashCommandBuilder()
      .setName('thoitiet')
      .setDescription('Xem thời tiết hiện tại'),
    
    async execute(interaction) {
      await interaction.deferReply();
      const weather = await getWeatherDescription();
      await interaction.editReply(weather || "Không thể lấy thông tin thời tiết");
    }
  },
  
  // Command racoonsearch
  {
    data: new SlashCommandBuilder()
      .setName('tool')
      .setDescription('Tìm kiếm thông tin với Raccoon AI')
      .addStringOption(option =>
        option.setName('query')
          .setDescription('Nội dung cần tìm kiếm')
          .setRequired(true)),
    
    async execute(interaction) {
      await interaction.deferReply();
      const gptChatService = new GptChatService();
      const query = interaction.options.getString('query');

      try {
        const result = await gptChatService.chatWithSearch(
          interaction.user.id,
          interaction.id,
          query
        );

        await interaction.editReply(
          result.success 
            ? result.response 
            : `❌ Lỗi: ${result.error || "Không rõ nguyên nhân"}`
        );
      } catch (error) {
        console.error('Search Error:', error);
        await interaction.editReply('🔍 Đã xảy ra lỗi khi tìm kiếm');
      }
    }
  }
  // Thêm command mới ở đây
];