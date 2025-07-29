require('dotenv').config();

// Import các dependencies
const { InteractionType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const discordClient = require('./config/discordClient');
const readyHandler = require('./handlers/readyHandler');
const messageHandler = require('./handlers/messageHandler');
const interactionHandler = require('./handlers/interactionHandler');
const GptChatService = require('./services/gptChatService');
const QuizService = require('./services/quizService'); // THÊM DÒNG NÀY

// Gán QuizService vào client để có thể truy cập từ các handler
discordClient.quizService = QuizService;
// Gán discordClient vào global để QuizService có thể fetch channel/user
global.discordClient = discordClient;

// Đăng ký các event handlers
discordClient.once('ready', () => readyHandler(discordClient));
discordClient.on('messageCreate', messageHandler);

// ==========================================================
// CẬP NHẬT TRÌNH XỬ LÝ INTERACTION
// ==========================================================
discordClient.on('interactionCreate', async (interaction) => {
    // 1. Xử lý Slash Command (giữ nguyên)
    if (interaction.isChatInputCommand()) {
        interactionHandler(interaction);
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
        // Chuyển xử lý modal submit cho interactionHandler
        interactionHandler(interaction); // Gọi interactionHandler để xử lý quiz_setup_modal
        return;
    }

    // 3. Xử lý bấm nút (ĐÃ CẬP NHẬT LOGIC)
    if (interaction.isButton()) {
        // Chuyển xử lý nút bấm cho interactionHandler
        interactionHandler(interaction); // Gọi interactionHandler để xử lý quiz_answer_ và các nút khác
        return;
    }
});

// Đăng nhập bot
discordClient.login(process.env.DISCORD_TOKEN);
