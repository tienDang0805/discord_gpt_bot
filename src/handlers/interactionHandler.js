const { getWeatherDescription } = require('../services/weather');
const GptChatService = require('../services/gptChatService');
const ImageGenerationService = require('../services/imageGenerationService');
const { sendLongMessage } = require('../utils/messageHelper');
const TextToAudioService = require('../services/textToAudioService');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, InteractionType } = require('discord.js');


module.exports = async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit()) return;

    const imageGenService = new ImageGenerationService();
    const textToAudioService = new TextToAudioService();
    const quizService = interaction.client.quizService; // Truy cập QuizService từ client

    if (interaction.isChatInputCommand()) {
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

                const result = await GptChatService.chatWithSearch(
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
                const { text, filePath } = await GptChatService.generateAudioWithContext(prompt); // Sử dụng GptChatService
                
                await interaction.editReply({
                    content: `Nội dung: ${text}`,
                    files: [{
                        attachment: filePath, // Đường dẫn file đã lưu
                        name: 'audio-response.wav' // Đổi tên file cho đúng định dạng
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
        if (interaction.commandName === 'setting') {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'edit') {
                try {
                    const config = await GptChatService.getBotConfig();
                    const modal = new ModalBuilder()
                        .setCustomId('personality_modal_v2') // Đổi ID để tránh xung đột
                        .setTitle('Bảng Điều Khiển Nhân Cách AI');

                    // TẠO CÁC Ô NHẬP LIỆU MỚI
                    const identityInput = new TextInputBuilder().setCustomId('identity_input').setLabel("Danh tính (Bot là ai?)").setStyle(TextInputStyle.Paragraph).setValue(config.identity);
                    const purposeInput = new TextInputBuilder().setCustomId('purpose_input').setLabel("Mục đích (Bot làm gì?)").setStyle(TextInputStyle.Paragraph).setValue(config.purpose);
                    const hobbiesInput = new TextInputBuilder().setCustomId('hobbies_input').setLabel("Sở thích (Bot thích gì?)").setStyle(TextInputStyle.Paragraph).setValue(config.hobbies);
                    const personalityInput = new TextInputBuilder().setCustomId('personality_input').setLabel("Tính cách (Hành vi)").setStyle(TextInputStyle.Paragraph).setValue(config.personality);
                    const styleInput = new TextInputBuilder().setCustomId('style_input').setLabel("Giọng văn (Cách nói chuyện)").setStyle(TextInputStyle.Paragraph).setValue(config.writing_style);
                    
                    // Modal chỉ cho phép 5 ActionRow
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(identityInput),
                        new ActionRowBuilder().addComponents(purposeInput),
                        new ActionRowBuilder().addComponents(hobbiesInput),
                        new ActionRowBuilder().addComponents(personalityInput),
                        new ActionRowBuilder().addComponents(styleInput)
                    );
                    
                    await interaction.showModal(modal);
                } catch (error) { /* ... xử lý lỗi ... */ }

            } else if (subcommand === 'view') {
                await interaction.deferReply(); // Công khai
                const config = await GptChatService.getBotConfig();
                
                const embed = new EmbedBuilder()
                    .setColor(0x3d85c6)
                    .setTitle('👀 Nhân cách hiện tại của AI')
                    .setDescription(`Yêu cầu bởi: ${interaction.user}`)
                    .addFields(
                        { name: '📜 Danh tính', value: `\`\`\`${config.identity}\`\`\`` },
                        { name: '🎯 Mục đích', value: `\`\`\`${config.purpose}\`\`\`` },
                        { name: '🎨 Sở thích', value: `\`\`\`${config.hobbies}\`\`\`` },
                        { name: '👤 Tính cách', value: `\`\`\`${config.personality}\`\`\`` },
                        { name: '✍️ Giọng văn', value: `\`\`\`${config.writing_style}\`\`\`` }
                    )
                    .setTimestamp();
                    
                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'reset') {
                await interaction.deferReply();
                await GptChatService.resetBotConfig();
                
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('🔄 Nhân cách AI đã được reset!')
                    .setDescription(`Người thực hiện: ${interaction.user}\n\nĐã quay về cấu hình mặc định và xóa sạch bộ nhớ.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
        }
        // START: Xử lý lệnh Quiz
        if (interaction.commandName === 'quiz') {
            if (quizService.isQuizActive(interaction.guild.id)) {
                return await interaction.reply({ content: '❌ Hiện đang có một trò đố vui đang diễn ra. Vui lòng đợi hoặc dùng `/quizcancel` để hủy bỏ.', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('quiz_setup_modal')
                .setTitle('Thiết Lập Racoon Quiz');

            const numQuestionsInput = new TextInputBuilder()
                .setCustomId('num_questions_input')
                .setLabel('Số lượng câu hỏi (3-10)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ví dụ: 5')
                .setRequired(true);

            const topicInput = new TextInputBuilder()
                .setCustomId('topic_input')
                .setLabel('Chủ đề câu hỏi')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ví dụ: Lịch sử Việt Nam, Khoa học, Phim ảnh')
                .setRequired(true);
            
            // Thêm trường nhập thời gian
            const timeLimitInput = new TextInputBuilder()
                .setCustomId('time_limit_input')
                .setLabel('Thời gian cho mỗi câu (giây)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Mặc định: 15')
                .setRequired(false); // Không bắt buộc, sẽ dùng default nếu trống

            // Thêm trường chọn độ khó
            const difficultyInput = new TextInputBuilder()
                .setCustomId('difficulty_input')
                .setLabel('Độ khó (Dễ, Trung bình, Khó, Địa ngục)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ví dụ: Trung bình')
                .setRequired(false); // Không bắt buộc, sẽ dùng default nếu trống

            modal.addComponents(
                new ActionRowBuilder().addComponents(numQuestionsInput),
                new ActionRowBuilder().addComponents(topicInput),
                new ActionRowBuilder().addComponents(timeLimitInput),
                new ActionRowBuilder().addComponents(difficultyInput) // Thêm input độ khó
            );

            await interaction.showModal(modal);
        }

        if (interaction.commandName === 'quizcancel') {
            await interaction.deferReply({ ephemeral: true });
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            const result = await quizService.cancelQuiz(guildId, userId);
            await interaction.editReply({ content: result.message, ephemeral: true });
        }
        // END: Xử lý lệnh Quiz
        return;
    }

    // 2. Xử lý Submit Modal (giữ nguyên)
    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'personality_modal_v2') {
            try {
                await interaction.deferReply({ ephemeral: true });

                const newConfigData = {
                    identity: interaction.fields.getTextInputValue('identity_input'),
                    purpose: interaction.fields.getTextInputValue('purpose_input'),
                    hobbies: interaction.fields.getTextInputValue('hobbies_input'),
                    personality: interaction.fields.getTextInputValue('personality_input'),
                    writing_style: interaction.fields.getTextInputValue('style_input'),
                };

                await GptChatService.updateBotConfig(newConfigData);

                const clearHistoryButton = new ButtonBuilder()
                    .setCustomId('confirm_clear_history_v2') // Thêm v2 để tránh xung đột id cũ nếu có
                    .setLabel('Xóa luôn lịch sử chat')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️');

                const keepHistoryButton = new ButtonBuilder()
                    .setCustomId('keep_history_v2')
                    .setLabel('Giữ lại lịch sử')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💾');

                const row = new ActionRowBuilder().addComponents(clearHistoryButton, keepHistoryButton);
                
                const embed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('✅ Cập nhật nhân cách thành công!')
                    .setDescription(`Nhân cách mới của AI đã được áp dụng ngay lập tức.\n*Thực hiện bởi: ${interaction.user}*`)
                    .addFields({
                        name: '🤔 Bạn có muốn xóa lịch sử trò chuyện không?',
                        value: 'Việc này sẽ giúp AI "nhập vai" nhân cách mới tốt hơn.'
                    })
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });

            } catch (error) {
                console.error("Lỗi khi xử lý modal personality:", error);
                await interaction.editReply({ content: '❌ Đã xảy ra lỗi khi lưu cấu hình.', ephemeral: true });
            }
        }
        // START: Xử lý submit modal Quiz
        if (interaction.customId === 'quiz_setup_modal') {
            await interaction.deferReply(); // Defer reply công khai
            const numQuestions = parseInt(interaction.fields.getTextInputValue('num_questions_input'));
            const topic = interaction.fields.getTextInputValue('topic_input');
            const timeLimitInput = interaction.fields.getTextInputValue('time_limit_input'); // Lấy thời gian nhập vào
            const timeLimit = timeLimitInput ? parseInt(timeLimitInput) : 15; // Mặc định 15 giây
            const difficultyInput = interaction.fields.getTextInputValue('difficulty_input'); // Lấy độ khó
            const difficulty = difficultyInput ? difficultyInput.trim() : 'Trung bình'; // Mặc định Trung bình

            const guildId = interaction.guild.id;
            const channelId = interaction.channel.id;
            const creatorId = interaction.user.id;

            if (isNaN(numQuestions) || numQuestions < 3 || numQuestions > 10) {
                return await interaction.editReply('❌ Số lượng câu hỏi phải là một số từ 3 đến 10.');
            }
            if (isNaN(timeLimit) || timeLimit < 5 || timeLimit > 60) { // Giới hạn thời gian từ 5-60 giây
                return await interaction.editReply('❌ Thời gian cho mỗi câu phải là một số từ 5 đến 60 giây.');
            }

            // Validate difficulty input
            const validDifficulties = ['Dễ', 'Trung bình', 'Khó', 'Địa ngục'];
            if (!validDifficulties.includes(difficulty)) {
                return await interaction.editReply('❌ Độ khó không hợp lệ. Vui lòng chọn: Dễ, Trung bình, Khó, hoặc Địa ngục.');
            }

            try {
                const result = await quizService.startQuiz(guildId, channelId, creatorId, numQuestions, topic, timeLimit, difficulty); // Truyền timeLimit và difficulty
                if (result.success) {
                    await interaction.editReply(result.message); // Thông báo quiz bắt đầu
                    // Câu hỏi đầu tiên sẽ được gửi bởi quizService
                } else {
                    await interaction.editReply(`❌ Lỗi: ${result.message}`);
                }
            } catch (error) {
                console.error('Lỗi khi bắt đầu quiz:', error);
                await interaction.editReply('❌ Đã xảy ra lỗi khi tạo quiz. Vui lòng thử lại sau.');
            }
        }
        // END: Xử lý submit modal Quiz
        return;
    }

    // 3. Xử lý bấm nút (ĐÃ CẬP NHẬT LOGIC)
    if (interaction.isButton()) {
        // START: Xử lý nút bấm Quiz
        if (interaction.customId.startsWith('quiz_answer_')) {
            await interaction.deferUpdate(); // Defer update để tránh lỗi interaction failed
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;
            const answerIndex = parseInt(interaction.customId.split('_')[2]);

            try {
                const result = await quizService.submitAnswer(guildId, userId, answerIndex);
                if (result.success) {
                    // Không cần editReply ở đây, quizService sẽ gửi tin nhắn mới
                } else {
                    // Nếu có lỗi, gửi tin nhắn riêng tư cho người dùng
                    await interaction.followUp({ content: `❌ ${result.message}`, ephemeral: true });
                }
            } catch (error) {
                console.error('Lỗi khi xử lý câu trả lời quiz:', error);
                await interaction.followUp({ content: '❌ Đã xảy ra lỗi khi xử lý câu trả lời của bạn.', ephemeral: true });
            }
            return; // Quan trọng: Dừng lại sau khi xử lý nút quiz
        }
        // END: Xử lý nút bấm Quiz

        let historyCleared = false;
        let actionCompleted = false;

        // Nút xác nhận xóa lịch sử
        if (interaction.customId === 'confirm_clear_history_v2') {
            await interaction.deferUpdate(); // Báo cho Discord biết mình đã nhận nút bấm
            try {
                await GptChatService.clearHistory();
                historyCleared = true;
                actionCompleted = true;
            } catch (error) {
                console.error('Lỗi khi xóa history:', error);
                await interaction.followUp({ content: 'Có lỗi khi xóa lịch sử.', ephemeral: true });
                return; // Dừng lại nếu lỗi
            }
        }

        // Nút giữ lại lịch sử
        if (interaction.customId === 'keep_history_v2') {
            await interaction.deferUpdate();
            historyCleared = false;
            actionCompleted = true;
        }

        // Nếu một trong hai hành động trên đã hoàn tất
        if (actionCompleted) {
            // Lấy config mới nhất để hiển thị
            const updatedConfig = await GptChatService.getBotConfig();
            
            // Xây dựng mô tả dựa trên hành động
            const description = historyCleared 
                ? `Người cập nhật: ${interaction.user}\n\n*Bộ nhớ của bot **đã được làm mới** để học lại nhân cách mới.*`
                : `Người cập nhật: ${interaction.user}\n\n*Lịch sử trò chuyện **vẫn được giữ nguyên**.*`;

            // Tạo embed công khai cuối cùng
            const publicEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Nhân cách AI đã được cập nhật!')
                .setDescription(description)
                .addFields(
                    { name: '📜 Danh tính mới', value: `\`\`\`${updatedConfig.identity}\`\`\`` },
                    { name: '🎯 Mục đích mới', value: `\`\`\`${updatedConfig.purpose}\`\`\`` },
                    { name: '🎨 Sở thích mới', value: `\`\`\`${updatedConfig.hobbies}\`\`\`` },
                    { name: '👤 Tính cách mới', value: `\`\`\`${updatedConfig.personality}\`\`\`` },
                    { name: '✍️ Giọng văn mới', value: `\`\`\`${updatedConfig.writing_style}\`\`\`` }
                )
                .setTimestamp();

            // Gửi tin nhắn công khai vào kênh mà lệnh được gọi
            await interaction.channel.send({ embeds: [publicEmbed] });

            // Cập nhật lại tin nhắn riêng tư, báo là đã xong và xóa các nút đi
            const privateConfirmationEmbed = new EmbedBuilder()
                .setColor(historyCleared ? 0xFFA500 : 0x3d85c6)
                .setTitle(historyCleared ? '🗑️ Đã xóa lịch sử thành công!' : '💾 Đã giữ lại lịch sử.')
                .setDescription('Một thông báo công khai đã được gửi vào kênh chat.')
                .setTimestamp();
                
            await interaction.editReply({ embeds: [privateConfirmationEmbed], components: [] });
        }
    }
    
};
