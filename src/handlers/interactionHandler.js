const { getWeatherDescription } = require('../services/weather');
const GptChatService = require('../services/gptChatService');
const ImageGenerationService = require('../services/imageGenerationService');
const { sendLongMessage } = require('../utils/messageHelper');
const TextToAudioService = require('../services/textToAudioService');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, InteractionType } = require('discord.js');
const PetService = require('../services/pet/PetService');

module.exports = async (interaction) => {
    if (!interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    // Initialize services
    const imageGenService = new ImageGenerationService();
    const textToAudioService = new TextToAudioService();
    const quizService = interaction.client.quizService;
    const catchTheWordService = interaction.client.catchTheWordService;
    const petService = new PetService();

    try {
        // 1. SLASH COMMAND HANDLING
        if (interaction.isChatInputCommand()) {
            return await handleSlashCommands(interaction, {
                imageGenService,
                textToAudioService,
                quizService,
                catchTheWordService,
                petService
            });
        }

        // 2. MODAL SUBMIT HANDLING
        if (interaction.type === InteractionType.ModalSubmit) {
            return await handleModalSubmits(interaction, { quizService, catchTheWordService });
        }

        // 3. BUTTON INTERACTION HANDLING
        if (interaction.isButton()) {
            return await handleButtonInteractions(interaction, { quizService, catchTheWordService, petService });
        }

        // 4. SELECT MENU HANDLING
        if (interaction.isStringSelectMenu()) {
            return await handleSelectMenus(interaction, { petService });
        }

    } catch (error) {
        console.error('[InteractionHandler] Unhandled error:', error);
        const errorMessage = 'Đã xảy ra lỗi khi xử lý tương tác. Vui lòng thử lại sau.';
        
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (replyError) {
            console.error('[InteractionHandler] Could not send error message:', replyError);
        }
    }
};

// ===== SLASH COMMAND HANDLERS =====
async function handleSlashCommands(interaction, services) {
    const { imageGenService, textToAudioService, quizService, catchTheWordService, petService } = services;

    switch (interaction.commandName) {
        case 'pet':
            return await handlePetCommands(interaction, petService);
        
        case 'thoitiet':
            return await handleWeatherCommand(interaction);
        
        case 'tool':
            return await handleToolCommand(interaction);
        
        case 'genimage':
            return await handleGenImageCommand(interaction, imageGenService);
        
        case 'speak':
            return await handleSpeakCommand(interaction);
        
        case 'setting':
            return await handleSettingCommands(interaction);
        
        case 'quiz':
            return await handleQuizSetupCommand(interaction, quizService);
        
        case 'quizcancel':
            return await handleQuizCancelCommand(interaction, quizService);
        
        case 'catchtheword':
            return await handleCatchTheWordSetupCommand(interaction, catchTheWordService);
        
        // Music commands
        case 'play':
        case 'skip':
        case 'stop':
        case 'pause':
        case 'resume':
        case 'queue':
        case 'volume':
        case 'repeat':
            return await handleMusicCommands(interaction);
    }
}

// ===== PET COMMAND HANDLERS =====
async function handlePetCommands(interaction, petService) {
    const subcommand = interaction.options.getSubcommand();
    
    // DEFER NGAY - cho TẤT CẢ commands
    await interaction.deferReply();
    
    try {
        switch (subcommand) {
            case 'start':
                // EggService tự xử lý toàn bộ flow
                await petService.beginHatchingProcess(interaction);
                break;
                
            case 'list':
                // DisplayService trả về data, handler gửi reply
                const listData = await petService.showPetList(interaction);
                await interaction.editReply(listData);
                break;
                
            case 'status':
                // Deprecated - redirect to list
                await interaction.editReply({ 
                    content: '⚠️ Lệnh này đã được thay thế. Hãy dùng `/pet list` để xem danh sách pets của bạn!'
                });
                break;
                
            case 'release':
                // ManagementService trả về data, handler gửi reply
                const releaseData = await petService.showReleasePetMenu(interaction);
                await interaction.editReply(releaseData);
                break;
                
            default:
                await interaction.editReply({ 
                    content: '❌ Lệnh không hợp lệ!'
                });
        }
    } catch (error) {
        console.error(`[handlePetCommands] Error in ${subcommand}:`, error);
        
        // Nếu chưa reply thì editReply, nếu đã reply rồi thì followUp
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: '❌ Có lỗi xảy ra khi thực thi lệnh. Vui lòng thử lại sau.',
                embeds: [],
                components: []
            });
        }
    }
}


// ===== OTHER COMMAND HANDLERS =====
async function handleWeatherCommand(interaction) {
    await interaction.deferReply();
    const weather = await getWeatherDescription();
    await sendLongMessage(interaction.editReply.bind(interaction), weather);
}

async function handleToolCommand(interaction) {
    await interaction.deferReply();
    
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
        await sendLongMessage(interaction.editReply.bind(interaction), result.response);
    } else {
        await interaction.editReply(`Lỗi: ${result.error}`);
    }
}

async function handleGenImageCommand(interaction, imageGenService) {
    await interaction.deferReply();
    
    const prompt = interaction.options.getString('prompt');
    const style = interaction.options.getString('style');
    
    if (!prompt) {
        return await interaction.editReply('Vui lòng cung cấp mô tả để tạo ảnh!');
    }

    const fullPrompt = style ? `${prompt}, ${style} style, high quality, 4k` : prompt;
    console.log(`[GenImage] Đang tạo ảnh với prompt: "${fullPrompt}"`);
    
    const result = await imageGenService.generateImage(fullPrompt);

    if (result.success) {
        console.log(`[GenImage] Tạo ảnh thành công, kích thước: ${result.imageBuffer.length} bytes`);
        await interaction.editReply({
            content: result.textResponse || `Ảnh được tạo từ: "${prompt}"`,
            files: [{ attachment: result.imageBuffer, name: 'generated-image.png' }]
        });
    } else {
        console.error('[GenImage] Lỗi khi tạo ảnh:', result.error);
        await interaction.editReply({
            content: `❌ Lỗi khi tạo ảnh: ${result.error || 'Không xác định'}`
        });
    }
}

async function handleSpeakCommand(interaction) {
    await interaction.deferReply();
    
    const prompt = interaction.options.getString('prompt');
    if (!prompt) {
        return await interaction.editReply('Vui lòng nhập nội dung cần chuyển thành audio!');
    }

    console.log(`[Speak] Đang tạo audio cho: "${prompt}"`);
    const { text, filePath } = await GptChatService.generateAudioWithContext(prompt);
    
    await interaction.editReply({
        content: `Nội dung: ${text}`,
        files: [{ attachment: filePath, name: 'audio-response.wav' }]
    });
    console.log('[Speak] Đã gửi audio thành công');
}

async function handleSettingCommands(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'edit') {
        const config = await GptChatService.getBotConfig();
        const modal = new ModalBuilder()
            .setCustomId('personality_modal_v2')
            .setTitle('Bảng Điều Khiển Nhân Cách AI');

        const identityInput = new TextInputBuilder()
            .setCustomId('identity_input')
            .setLabel("Danh tính (Bot là ai?)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.identity);

        const purposeInput = new TextInputBuilder()
            .setCustomId('purpose_input')
            .setLabel("Mục đích (Bot làm gì?)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.purpose);

        const hobbiesInput = new TextInputBuilder()
            .setCustomId('hobbies_input')
            .setLabel("Sở thích (Bot thích gì?)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.hobbies);

        const personalityInput = new TextInputBuilder()
            .setCustomId('personality_input')
            .setLabel("Tính cách (Hành vi)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.personality);

        const styleInput = new TextInputBuilder()
            .setCustomId('style_input')
            .setLabel("Giọng văn (Cách nói chuyện)")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.writing_style);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(identityInput),
            new ActionRowBuilder().addComponents(purposeInput),
            new ActionRowBuilder().addComponents(hobbiesInput),
            new ActionRowBuilder().addComponents(personalityInput),
            new ActionRowBuilder().addComponents(styleInput)
        );
        
        await interaction.showModal(modal);

    } else if (subcommand === 'view') {
        await interaction.deferReply();
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

async function handleQuizSetupCommand(interaction, quizService) {
    if (quizService.isQuizActive(interaction.guild.id)) {
        return await interaction.reply({ 
            content: '❌ Hiện đang có một trò đố vui đang diễn ra. Vui lòng đợi hoặc dùng `/quizcancel` để hủy bỏ.', 
            ephemeral: true 
        });
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
    
    const timeLimitInput = new TextInputBuilder()
        .setCustomId('time_limit_input')
        .setLabel('Thời gian cho mỗi câu (giây)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Mặc định: 15')
        .setRequired(false);

    const difficultyInput = new TextInputBuilder()
        .setCustomId('difficulty_input')
        .setLabel('Độ khó (Dễ, Trung bình, Khó, Địa ngục)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ví dụ: Trung bình')
        .setRequired(false);

    const toneInput = new TextInputBuilder()
        .setCustomId('tone_input')
        .setLabel('Giọng văn (Hài hước, Nghiêm túc)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Mặc định: Trung tính')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(numQuestionsInput),
        new ActionRowBuilder().addComponents(topicInput),
        new ActionRowBuilder().addComponents(timeLimitInput),
        new ActionRowBuilder().addComponents(difficultyInput),
        new ActionRowBuilder().addComponents(toneInput)
    );

    await interaction.showModal(modal);
}

async function handleQuizCancelCommand(interaction, quizService) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const result = await quizService.cancelQuiz(guildId, userId);
    await interaction.editReply({ content: result.message, ephemeral: true });
}

async function handleCatchTheWordSetupCommand(interaction, catchTheWordService) {
    if (catchTheWordService.isGameActive(interaction.guild.id)) {
        return await interaction.reply({ 
            content: '❌ Đã có một game đang diễn ra rồi.', 
            ephemeral: true 
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('ctw_setup_modal')
        .setTitle('Cài Đặt Game Đuổi Hình Bắt Chữ');

    const numRoundsInput = new TextInputBuilder()
        .setCustomId('num_rounds_input')
        .setLabel('Số lượng vòng (tối đa 5 vòng)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Nhập số từ 1 đến 5')
        .setRequired(true);
    
    const timeLimitInput = new TextInputBuilder()
        .setCustomId('time_limit_input')
        .setLabel('Thời gian mỗi vòng (giây, 15-60)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Mặc định: 20')
        .setRequired(false);

    const difficultyInput = new TextInputBuilder()
        .setCustomId('difficulty_input')
        .setLabel('Độ khó (Dễ, Trung bình, Khó, Địa ngục)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Mặc định: Trung bình')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(numRoundsInput),
        new ActionRowBuilder().addComponents(timeLimitInput),
        new ActionRowBuilder().addComponents(difficultyInput)
    );

    await interaction.showModal(modal);
}

async function handleMusicCommands(interaction) {
    await interaction.deferReply();
    const { musicService } = interaction.client;
    
    if (!musicService) {
        return await interaction.editReply("❌ Music service không khả dụng!");
    }

    try {
        switch (interaction.commandName) {
            case 'play': {
                const voiceChannel = interaction.member?.voice?.channel;
                const url = interaction.options.getString('url');
                console.log("[DEBUG] URL người dùng nhập:", url);

                if (!voiceChannel) {
                    return await interaction.editReply("❌ Bạn cần vào voice channel trước!");
                }

                const result = await musicService.play(voiceChannel, url, {
                    requestedBy: interaction.user.tag
                });
                await interaction.editReply(result.message || "🎵 Đang phát nhạc...");
                break;
            }
            
            case 'skip': {
                const result = await musicService.skip(interaction.guild.id);
                await interaction.editReply(result.message);
                break;
            }
            
            case 'stop': {
                const result = await musicService.stop(interaction.guild.id);
                await interaction.editReply(result.message);
                break;
            }
            
            case 'pause': {
                const result = await musicService.pause(interaction.guild.id);
                await interaction.editReply(result.message);
                break;
            }
            
            case 'resume': {
                const result = await musicService.resume(interaction.guild.id);
                await interaction.editReply(result.message);
                break;
            }
            
            case 'queue': {
                const { current, queue, repeatMode } = await musicService.getQueue(interaction.guild.id);
                
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
                break;
            }
            
            case 'volume': {
                const volume = interaction.options.getInteger('volume');
                
                if (volume === null || volume < 0 || volume > 100) {
                    return await interaction.editReply("❌ Volume phải từ 0 đến 100!");
                }

                const result = await musicService.setVolume(interaction.guild.id, volume);
                await interaction.editReply(result.message);
                break;
            }
            
            case 'repeat': {
                const mode = interaction.options.getString('mode');
                const result = await musicService.setRepeatMode(interaction.guild.id, mode);
                await interaction.editReply(result.message);
                break;
            }
        }
    } catch (error) {
        console.error(`[${interaction.commandName.toUpperCase()}] Error:`, error);
        await interaction.editReply(`❌ Error: ${error.message}`);
    }
}

// ===== MODAL SUBMIT HANDLERS =====
async function handleModalSubmits(interaction, services) {
    const { quizService, catchTheWordService } = services;

    if (interaction.customId === 'personality_modal_v2') {
        return await handlePersonalityModalSubmit(interaction);
    } else if (interaction.customId === 'quiz_setup_modal') {
        return await handleQuizSetupModalSubmit(interaction, quizService);
    } else if (interaction.customId === 'ctw_setup_modal') {
        return await handleCatchTheWordModalSubmit(interaction, catchTheWordService);
    }
}

async function handlePersonalityModalSubmit(interaction) {
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
            .setCustomId('confirm_clear_history_v2')
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
        await interaction.editReply({ 
            content: '❌ Đã xảy ra lỗi khi lưu cấu hình.', 
            ephemeral: true 
        });
    }
}

async function handleQuizSetupModalSubmit(interaction, quizService) {
    await interaction.deferReply();
    
    const numQuestions = parseInt(interaction.fields.getTextInputValue('num_questions_input'));
    const topic = interaction.fields.getTextInputValue('topic_input');
    const timeLimitInput = interaction.fields.getTextInputValue('time_limit_input');
    const timeLimit = timeLimitInput ? parseInt(timeLimitInput) : 15;
    const difficultyInput = interaction.fields.getTextInputValue('difficulty_input');
    const difficulty = difficultyInput ? difficultyInput.trim() : 'Trung bình';
    const toneInput = interaction.fields.getTextInputValue('tone_input');
    const tone = toneInput ? toneInput.trim() : 'Trung tính';

    const guildId = interaction.guild.id;
    const channelId = interaction.channel.id;
    const creatorId = interaction.user.id;

    // Validation
    if (isNaN(numQuestions) || numQuestions < 3 || numQuestions > 10) {
        return await interaction.editReply('❌ Số lượng câu hỏi phải là một số từ 3 đến 10.');
    }
    if (isNaN(timeLimit) || timeLimit < 5 || timeLimit > 60) {
        return await interaction.editReply('❌ Thời gian cho mỗi câu phải là một số từ 5 đến 60 giây.');
    }

    const validDifficulties = ['Dễ', 'Trung bình', 'Khó', 'Địa ngục'];
    if (!validDifficulties.includes(difficulty)) {
        return await interaction.editReply('❌ Độ khó không hợp lệ. Vui lòng chọn: Dễ, Trung bình, Khó, hoặc Địa ngục.');
    }

    const result = await quizService.startQuiz(guildId, channelId, creatorId, numQuestions, topic, timeLimit, difficulty, tone);
    if (result.success) {
        await interaction.editReply(result.message);
    } else {
        await interaction.editReply(`❌ Lỗi: ${result.message}`);
    }
}

async function handleCatchTheWordModalSubmit(interaction, catchTheWordService) {
    await interaction.deferReply();
    
    const numRounds = parseInt(interaction.fields.getTextInputValue('num_rounds_input'));
    const timeLimitInput = interaction.fields.getTextInputValue('time_limit_input');
    const timeLimit = timeLimitInput ? parseInt(timeLimitInput) : 20;
    const difficultyInput = interaction.fields.getTextInputValue('difficulty_input');
    const difficulty = difficultyInput?.trim() || 'Trung bình';

    // Validation
    if (isNaN(numRounds) || numRounds < 1 || numRounds > 5) {
        return await interaction.editReply('❌ Số vòng phải là một số từ 1 đến 5.');
    }
    if (isNaN(timeLimit) || timeLimit < 15 || timeLimit > 60) {
        return await interaction.editReply('❌ Thời gian phải là một số từ 15 đến 60 giây.');
    }
    
    const validDifficulties = ['Dễ', 'Trung bình', 'Khó', 'Địa ngục'];
    if (!validDifficulties.includes(difficulty)) {
        return await interaction.editReply('❌ Độ khó không hợp lệ. Vui lòng chọn: Dễ, Trung bình, Khó, hoặc Địa ngục.');
    }

    const result = await catchTheWordService.startGame(
        interaction.guild.id,
        interaction.channel.id,
        interaction.user.id,
        numRounds,
        timeLimit,
        difficulty
    );
    
    await interaction.editReply(result.message);
}

// ===== BUTTON INTERACTION HANDLERS =====
async function handleButtonInteractions(interaction, services) {
    const { quizService, catchTheWordService, petService } = services;

    // Quiz answer buttons
    if (interaction.customId.startsWith('quiz_answer_')) {
        await interaction.deferUpdate();
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const answerIndex = parseInt(interaction.customId.split('_')[2]);

        const result = await quizService.submitAnswer(guildId, userId, answerIndex);
        if (!result.success) {
            await interaction.followUp({ 
                content: `❌ ${result.message}`, 
                ephemeral: true 
            });
        }
        return;
    }

    // Catch the word answer buttons
    if (interaction.customId.startsWith('ctw_answer_')) {
        await interaction.deferUpdate();
        const answerIndex = parseInt(interaction.customId.split('_')[2]);
        const result = await catchTheWordService.submitAnswer(
            interaction.guild.id, 
            interaction.user.id,
            interaction.user.tag,
            answerIndex
        );

        if (result && result.answered) {
            await interaction.followUp({ 
                content: 'Bạn đã trả lời vòng này rồi!', 
                ephemeral: true 
            });
        } else {
            await interaction.followUp({ 
                content: '✅ Câu trả lời của bạn đã được ghi nhận!', 
                ephemeral: true 
            });
        }
        return;
    }

    // Pet egg selection buttons
    if (interaction.customId.startsWith('select_egg_')) {
        console.log(`[InteractionHandler] Button pressed: ${interaction.customId}`);
        console.log(`[InteractionHandler] Interaction state: deferred=${interaction.deferred}, replied=${interaction.replied}`);
        
        const eggType = interaction.customId.replace('select_egg_', '');
        await petService.hatchEgg(interaction, eggType);
        return;
    }

    // Pet release confirmation buttons
    if (interaction.customId.startsWith('confirm_release_')) {
        const petId = interaction.customId.replace('confirm_release_', '');
        await petService.releasePet(interaction, petId);
        return;
    }

    if (interaction.customId === 'cancel_release') {
        await interaction.update({
            content: '✅ Đã hủy thả pet.',
            embeds: [],
            components: []
        });
        return;
    }

    // History management buttons
    if (interaction.customId === 'confirm_clear_history_v2' || interaction.customId === 'keep_history_v2') {
        await interaction.deferUpdate();
        
        let historyCleared = false;
        
        if (interaction.customId === 'confirm_clear_history_v2') {
            try {
                await GptChatService.clearHistory();
                historyCleared = true;
            } catch (error) {
                console.error('Lỗi khi xóa history:', error);
                await interaction.followUp({ 
                    content: 'Có lỗi khi xóa lịch sử.', 
                    ephemeral: true 
                });
                return;
            }
        }

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
            
        await interaction.editReply({ 
            embeds: [privateConfirmationEmbed], 
            components: [] 
        });
        return;
    }
    if (interaction.customId.startsWith('view_pet_')) {
        // Format customId: view_pet_[petId]_[requestUserId]
        const parts = interaction.customId.split('_');
        const petId = parts[2]; // Lấy pet ID
        const requestUserId = parts[3]; // Lấy ID của chủ pet
        
        console.log(`[InteractionHandler] View pet button pressed for petId: ${petId} (Owner: ${requestUserId})`);
        

        await petService.showSinglePetStatus(interaction, petId, requestUserId); // ĐÃ THÊM requestUserId
        return;
    }


    // Pet release buttons (trực tiếp thả pet)
    if (interaction.customId.startsWith('release_pet_')) {
        const petId = interaction.customId.replace('release_pet_', '');
        console.log(`[InteractionHandler] Release pet button pressed for petId: ${petId}`);
        
        await interaction.deferUpdate();
        await petService.confirmReleasePet(interaction, petId);
        return;
    }
}
// ===== SELECT MENU HANDLERS ===== (thêm vào cuối file interaction handler)
async function handleSelectMenus(interaction, services) {
    const { petService } = services;
    
    console.log(`[DEBUG] Select menu interaction: ${interaction.customId}`);
    console.log(`[DEBUG] Values:`, interaction.values);
    
    try {
        // Pet list selection - xem status của pet
        if (interaction.customId === 'pet_list_select') {
            const value = interaction.values[0];
            console.log(`[DEBUG] Pet list select value: ${value}`);
            
            if (value.startsWith('pet_status_')) {
                const petId = value.replace('pet_status_', '');
                console.log(`[DEBUG] Extracted petId: ${petId}`);
                
                await interaction.deferUpdate();
                await petService.showSinglePetStatus(interaction, petId);
            }
            return;
        }
        
        // Pet release selection - chọn pet để thả
        if (interaction.customId === 'pet_release_select') {
            const value = interaction.values[0];
            console.log(`[DEBUG] Pet release select value: ${value}`);
            
            if (value.startsWith('pet_release_')) {
                const petId = value.replace('pet_release_', '');
                console.log(`[DEBUG] Extracted release petId: ${petId}`);
                
                await interaction.deferUpdate();
                await petService.confirmReleasePet(interaction, petId);
            }
            return;
        }
        
        console.log(`[DEBUG] Unknown select menu: ${interaction.customId}`);
        
    } catch (error) {
        console.error(`[DEBUG] Error in handleSelectMenus:`, error);
        console.error(`[DEBUG] Error stack:`, error.stack);
        
        // Prevent interaction failed error
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ Có lỗi xảy ra khi xử lý lựa chọn của bạn.', 
                    ephemeral: true 
                });
            } else {
                await interaction.editReply({ 
                    content: '❌ Có lỗi xảy ra khi xử lý lựa chọn của bạn.',
                    components: []
                });
            }
        } catch (replyError) {
            console.error(`[DEBUG] Could not send error reply:`, replyError);
        }
    }
}