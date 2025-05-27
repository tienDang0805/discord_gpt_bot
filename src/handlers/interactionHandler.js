const { getWeatherDescription } = require('../services/weather');
const GptChatService = require('../services/gptChatService');

module.exports = async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const gptChatService = new GptChatService();

  if (interaction.commandName === 'thoitiet') {
    await interaction.deferReply();
    const weather = await getWeatherDescription();
    await interaction.editReply(weather);
  }
  
  if (interaction.commandName === 'tool') {
    await interaction.deferReply();
    
    try {
      const searchQuery = interaction.options.getString('query');
      
      if (!searchQuery) {
        return await interaction.editReply('Vui lòng cung cấp từ khóa tìm kiếm!');
      }

      // Gọi phương thức chatWithSearch đã được thêm vào GptChatService
      const result = await gptChatService.chatWithSearch(
        interaction.user.id,
        interaction.id,
        searchQuery
      );

      if (result.success) {
        await interaction.editReply(result.response);
      } else {
        await interaction.editReply(`Lỗi: ${result.error}`);
      }
    } catch (error) {
      console.error('Search Error:', error);
      await interaction.editReply('Đã xảy ra lỗi khi thực hiện tìm kiếm');
    }
  }
};