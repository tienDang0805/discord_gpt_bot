const { getWeatherDescription } = require('../services/weather');
const GptChatService = require('../services/gptChatService');
const ImageGenerationService = require('../services/imageGenerationService');
const { sendLongMessage } = require('../utils/messageHelper');
const TextToAudioService = require('../services/textToAudioService');

module.exports = async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const gptChatService = new GptChatService();
    const imageGenService = new ImageGenerationService();
    const textToAudioService = new TextToAudioService();

    if (interaction.commandName === 'thoitiet') {
        await interaction.deferReply();
        const weather = await getWeatherDescription();
        await sendLongMessage(
            interaction.editReply.bind(interaction), 
            weather
        );
    }
    
    if (interaction.commandName === 'tool') {
        await interaction.deferReply();
        
        try {
            const searchQuery = interaction.options.getString('query');
            
            if (!searchQuery) {
                return await interaction.editReply('Vui lòng cung cấp từ khóa tìm kiếm!');
            }

            const result = await gptChatService.chatWithSearch(
                interaction.user.id,
                interaction.id,
                searchQuery
            );

            if (result.success) {
                await sendLongMessage(
                    interaction.editReply.bind(interaction),
                    result.response
                );
            } else {
                await interaction.editReply(`Lỗi: ${result.error}`);
            }
        } catch (error) {
            console.error('Search Error:', error);
            await interaction.editReply('Đã xảy ra lỗi khi thực hiện tìm kiếm');
        }
    }

    if (interaction.commandName === 'genimage') {
        await interaction.deferReply();
        
        try {
            const prompt = interaction.options.getString('prompt');
            const style = interaction.options.getString('style');
            
            if (!prompt) {
                return await interaction.editReply('Vui lòng cung cấp mô tả để tạo ảnh!');
            }

            // Thêm style vào prompt nếu có
            const fullPrompt = style 
                ? `${prompt}, ${style} style, high quality, 4k`
                : prompt;

            console.log(`[GenImage] Đang tạo ảnh với prompt: "${fullPrompt}"`);
            
            const result = await imageGenService.generateImage(fullPrompt);

            if (result.success) {
                console.log(`[GenImage] Tạo ảnh thành công, kích thước: ${result.imageBuffer.length} bytes`);
                
                await interaction.editReply({
                    content: result.textResponse || `Ảnh được tạo từ: "${prompt}"`,
                    files: [{
                        attachment: result.imageBuffer,
                        name: 'generated-image.png'
                    }]
                });
            } else {
                console.error('[GenImage] Lỗi khi tạo ảnh:', result.error);
                await interaction.editReply({
                    content: `❌ Lỗi khi tạo ảnh: ${result.error || 'Không xác định'}`
                });
            }
        } catch (error) {
            console.error('[GenImage] Lỗi không xử lý được:', {
                error: error.message,
                stack: error.stack,
                interaction: {
                    user: interaction.user.tag,
                    options: interaction.options.data
                }
            });
            await interaction.editReply('❌ Bot gặp lỗi nghiêm trọng khi tạo ảnh. Vui lòng thử lại sau!');
        }
    }
    if (interaction.commandName === 'speak') {
        await interaction.deferReply();
        
        try {
            const prompt = interaction.options.getString('prompt');
            if (!prompt) {
                return await interaction.editReply('Vui lòng nhập nội dung cần chuyển thành audio!');
            }

            console.log(`[Speak] Đang tạo audio cho: "${prompt}"`);
            const { text, audioBuffer } = await textToAudioService.generateResponseWithAudio(prompt);
            
            await interaction.editReply({
                content: `Nội dung: ${text}`,
                files: [{
                    attachment: audioBuffer,
                    name: 'audio-response.mp3'
                }]
            });
            console.log('[Speak] Đã gửi audio thành công');

        } catch (error) {
            console.error('[Speak] Lỗi:', error);
            await interaction.editReply({
                content: `❌ Lỗi khi tạo audio: ${error.message}`,
                ephemeral: true
            });
        }
    }
};