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

    // Music commands
    if (interaction.commandName === 'play') {
        await interaction.deferReply();
        
        try {
            const { musicService } = interaction.client;
            const voiceChannel = interaction.member?.voice?.channel;
            const url = interaction.options.getString('url');
                console.log("[DEBUG] URL người dùng nhập:", url); // 👈 log ra URL

            if (!voiceChannel) {
                return await interaction.editReply("❌ Bạn cần vào voice channel trước!");
            }

            if (!musicService?.play) {
                console.error("[CRITICAL] MusicService.play không tồn tại!");
                return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
            }

            const result = await musicService.play(voiceChannel, url, {
                requestedBy: interaction.user.tag
            });

            await interaction.editReply(result.message || "🎵 Đang phát nhạc...");
        } catch (error) {
            console.error("[ERROR] /play failed:", error);
            await interaction.editReply(`❌ Lỗi: ${error.message}`);
        }
    }

    if (interaction.commandName === 'skip') {
        await interaction.deferReply();
        
        try {
            const { musicService } = interaction.client;
            const guildId = interaction.guild.id;
            
            if (!musicService?.skip) {
                console.error("[CRITICAL] MusicService.skip không tồn tại!");
                return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
            }

            const result = await musicService.skip(guildId);
            await interaction.editReply(result.message);
        } catch (error) {
            console.error('Skip Error:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }

    if (interaction.commandName === 'stop') {
        await interaction.deferReply();
        
        try {
            const { musicService } = interaction.client;
            const guildId = interaction.guild.id;
            
            if (!musicService?.stop) {
                console.error("[CRITICAL] MusicService.stop không tồn tại!");
                return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
            }

            const result = await musicService.stop(guildId);
            await interaction.editReply(result.message);
        } catch (error) {
            console.error('Stop Error:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }

    if (interaction.commandName === 'pause') {
        await interaction.deferReply();
        
        try {
            const { musicService } = interaction.client;
            const guildId = interaction.guild.id;
            
            if (!musicService?.pause) {
                console.error("[CRITICAL] MusicService.pause không tồn tại!");
                return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
            }

            const result = await musicService.pause(guildId);
            await interaction.editReply(result.message);
        } catch (error) {
            console.error('Pause Error:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }

    if (interaction.commandName === 'resume') {
        await interaction.deferReply();
        
        try {
            const { musicService } = interaction.client;
            const guildId = interaction.guild.id;
            
            if (!musicService?.resume) {
                console.error("[CRITICAL] MusicService.resume không tồn tại!");
                return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
            }

            const result = await musicService.resume(guildId);
            await interaction.editReply(result.message);
        } catch (error) {
            console.error('Resume Error:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }

    if (interaction.commandName === 'queue') {
        await interaction.deferReply();
        
        try {
            const { musicService } = interaction.client;
            const guildId = interaction.guild.id;
            
            if (!musicService?.getQueue) {
                console.error("[CRITICAL] MusicService.getQueue không tồn tại!");
                return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
            }

            const { current, queue, repeatMode } = await musicService.getQueue(guildId);
            
            let message = `🔁 Chế độ lặp: ${repeatMode}\n`;
            
            if (current) {
                message += `🎶 Đang phát: **${current.title}** (Yêu cầu bởi: ${current.requestedBy})\n\n`;
            } else {
                message += "🔇 Không có bài hát nào đang phát\n\n";
            }
            
            if (queue.length > 0) {
                message += "📃 Danh sách chờ:\n" + 
                    queue.map((track, index) => 
                        `${index + 1}. **${track.title}** (Yêu cầu bởi: ${track.requestedBy})`
                    ).join('\n');
            } else {
                message += "📭 Danh sách chờ trống";
            }
            
            await interaction.editReply(message);
        } catch (error) {
            console.error('Queue Error:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }

    if (interaction.commandName === 'volume') {
        await interaction.deferReply();
        
        try {
            const { musicService } = interaction.client;
            const guildId = interaction.guild.id;
            const volume = interaction.options.getInteger('volume');
            
            if (!musicService?.setVolume) {
                console.error("[CRITICAL] MusicService.setVolume không tồn tại!");
                return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
            }

            if (volume === null || volume < 0 || volume > 100) {
                return await interaction.editReply("❌ Volume phải từ 0 đến 100!");
            }

            const result = await musicService.setVolume(guildId, volume);
            await interaction.editReply(result.message);
        } catch (error) {
            console.error('Volume Error:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }

    if (interaction.commandName === 'repeat') {
        await interaction.deferReply();
        
        try {
            const { musicService } = interaction.client;
            const guildId = interaction.guild.id;
            const mode = interaction.options.getString('mode');
            
            if (!musicService?.setRepeatMode) {
                console.error("[CRITICAL] MusicService.setRepeatMode không tồn tại!");
                return await interaction.editReply("❌ Bot đang gặp lỗi hệ thống!");
            }

            const result = await musicService.setRepeatMode(guildId, mode);
            await interaction.editReply(result.message);
        } catch (error) {
            console.error('Repeat Error:', error);
            await interaction.editReply(`❌ Error: ${error.message}`);
        }
    }
};