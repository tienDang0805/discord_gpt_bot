const { SlashCommandBuilder } = require('discord.js');
const GptChatService = require('./services/gptChatService');
const { getWeatherDescription } = require('./services/weather');
const ImageGenerationService = require('./services/imageGenerationService');
const MusicService = require('./services/musicService');


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
    console.log('✅ Tool command triggered!'); // Thêm dòng này để kiểm tra

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
  },
  // Thêm command mới ở đây
  {
    data: new SlashCommandBuilder()
      .setName('genimage')
      .setDescription('Tạo ảnh từ mô tả bằng AI')
      .addStringOption(option =>
        option.setName('prompt')
          .setDescription('Mô tả nội dung ảnh cần tạo')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('style')
          .setDescription('Phong cách ảnh')
          .addChoices(
            { name: 'Digital Art', value: 'digital-art' },
            { name: 'Photorealistic', value: 'photorealistic' },
            { name: 'Anime', value: 'anime' },
            { name: 'Watercolor', value: 'watercolor' }
          )
          .setRequired(false)),
    
    async execute(interaction) {
      await interaction.deferReply();
      const imageGenService = new ImageGenerationService();
      
      try {
        const prompt = interaction.options.getString('prompt');
        const style = interaction.options.getString('style');
        
        // Thêm style vào prompt nếu có
        const fullPrompt = style 
          ? `${prompt}, ${style} style, high quality, 4k` 
          : prompt;
        
        const result = await imageGenService.generateImage(fullPrompt);
        
        if (result.success) {
          await interaction.editReply({
            content: result.textResponse || `Ảnh được tạo từ: "${prompt}"`,
            files: [{
              attachment: result.imageBuffer,
              name: 'generated-image.png'
            }]
          });
        } else {
          await interaction.editReply({
            content: result.textResponse || '❌ Không thể tạo ảnh. Lỗi: ' + (result.error || 'Không xác định')
          });
        }
      } catch (error) {
        console.error('GenImage Error:', error);
        await interaction.editReply('❌ Bot gặp lỗi khi tạo ảnh. Vui lòng thử lại sau!');
      }
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('speak')
      .setDescription('Chuyển văn bản thành giọng nói AI')
      .addStringOption(option =>
        option.setName('prompt')
          .setDescription('Nội dung cần chuyển thành giọng nói')
          .setRequired(true)),
    
    async execute(interaction) {
      // Xử lý trong interactionHandler
    }
  },
  ///music 
  {
    data: new SlashCommandBuilder()
      .setName('play')
      .setDescription('Play music from YouTube')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('YouTube URL to play')
          .setRequired(true)),
    

    
  async execute(interaction) {
  await interaction.deferReply(); // ⚠️ LUÔN defer trước

  try {
    const { musicService } = interaction.client;
    const voiceChannel = interaction.member?.voice?.channel;
    const url = interaction.options.getString('url');

    // Kiểm tra voice channel
    if (!voiceChannel) {
      return await interaction.editReply("❌ Bạn cần vào voice channel trước!");
    }

    // Kiểm tra musicService
    if (!musicService?.play) {
      console.error("[CRITICAL] MusicService.play không tồn tại!");
      return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
    }

    // Gọi play và xử lý kết quả
    const result = await musicService.play(voiceChannel, url, {
      requestedBy: interaction.user.tag
    });

    await interaction.editReply(result.message || "🎵 Đang phát nhạc...");
  } catch (error) {
    console.error("[ERROR] /play failed:", error);
    await interaction.editReply(`❌ Lỗi: ${error.message}`);
  }
}
  },
  {
    data: new SlashCommandBuilder()
      .setName('skip')
      .setDescription('Skip the current track'),
    
    async execute(interaction) {
      await interaction.deferReply();
      
      const musicService = interaction.client.musicService;
      
      try {
        const result = await musicService.skip(interaction.guild.id);
        await interaction.editReply(result.message);
      } catch (error) {
        console.error('Skip Error:', error);
        await interaction.editReply(`❌ Error: ${error.message}`);
      }
    }
  },
];