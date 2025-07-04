require('dotenv').config();

// Import các dependencies
const { InteractionType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const discordClient = require('./config/discordClient');
const readyHandler = require('./handlers/readyHandler');
const messageHandler = require('./handlers/messageHandler');
const interactionHandler = require('./handlers/interactionHandler');
const GptChatService = require('./services/gptChatService'); // <--- THÊM DÒNG NÀY

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
        return;
    }

    // 3. Xử lý bấm nút (ĐÃ CẬP NHẬT LOGIC)
    if (interaction.isButton()) {
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
});

// Đăng nhập bot
discordClient.login(process.env.DISCORD_TOKEN);