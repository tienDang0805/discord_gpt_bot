require('dotenv').config();

// Import các dependencies
const { InteractionType,EmbedBuilder } = require('discord.js'); // <--- THÊM DÒNG NÀY
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
    if (interaction.isChatInputCommand()) {
        interactionHandler(interaction);
        return;
    }

    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'personality_modal_v2') {
            await interaction.reply({ content: 'Đang lưu và làm mới nhân cách...', ephemeral: true });

            try {
                // LẤY DỮ LIỆU TỪ CÁC Ô MỚI
                const identity = interaction.fields.getTextInputValue('identity_input');
                const purpose = interaction.fields.getTextInputValue('purpose_input');
                const hobbies = interaction.fields.getTextInputValue('hobbies_input');
                const personality = interaction.fields.getTextInputValue('personality_input');
                const writing_style = interaction.fields.getTextInputValue('style_input');
                
                const newConfigData = { identity, purpose, hobbies, personality, writing_style };

                const gptChatService = new GptChatService();
                const updatedConfig = await gptChatService.updateBotConfig(newConfigData);

                // CẬP NHẬT EMBED THÔNG BÁO
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Nhân cách AI đã được cập nhật!')
                    .setDescription(`Người cập nhật: ${interaction.user}\n\n*Bộ nhớ của bot đã được làm mới để học lại.*`)
                    .addFields(
                        { name: '📜 Danh tính mới', value: `\`\`\`${updatedConfig.identity}\`\`\`` },
                        { name: '🎯 Mục đích mới', value: `\`\`\`${updatedConfig.purpose}\`\`\`` },
                        { name: '🎨 Sở thích mới', value: `\`\`\`${updatedConfig.hobbies}\`\`\`` },
                        { name: '👤 Tính cách mới', value: `\`\`\`${updatedConfig.personality}\`\`\`` },
                        { name: '✍️ Giọng văn mới', value: `\`\`\`${updatedConfig.writing_style}\`\`\`` }
                    )
                    .setTimestamp();
                
                await interaction.channel.send({ embeds: [embed] });
                await interaction.editReply({ content: 'Lưu và làm mới thành công!' });
            } catch (error) {
                console.error("Lỗi khi xử lý modal personality:", error);
                await interaction.editReply({ content: '❌ Đã xảy ra lỗi khi lưu cấu hình.' });
            }
        }
    }
});

// Đăng nhập bot
discordClient.login(process.env.DISCORD_TOKEN);