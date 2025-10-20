const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Pet } = require('../../model/petSchema');
const ImageGenerationService = require('../imageGenerationService');
const mongoose = require('mongoose');

const MAX_PETS_PER_USER = 6;

class PetDisplayService {
    constructor() {
        this.imageService = new ImageGenerationService();
    }

    /**
     * Hiển thị danh sách pets của user bằng buttons
     * KHÔNG defer/reply - chỉ return data (Dùng cho command /pet list ban đầu)
     */
    async showPetList(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetDisplayService] Hiển thị danh sách pets cho User ID: ${userId}`);

        try {
            const pets = await Pet.find({ ownerId: userId });
            console.log(`[PetDisplayService] Tìm thấy ${pets?.length || 0} pets cho User ID: ${userId}`);
            
            if (!pets || pets.length === 0) {
                return { 
                    content: `❌ Bạn chưa có thú cưng nào. Dùng \`/pet start\` để bắt đầu!`
                };
            }

            const embed = new EmbedBuilder()
                .setTitle(`📋 Danh Sách Pets của ${interaction.user.displayName}`)
                .setDescription(`Tổng cộng: **${pets.length}/${MAX_PETS_PER_USER}** pets\n\n⚠️ **Chỉ ${interaction.user.displayName} mới có thể tương tác với pets!**\n\nChọn pet bạn muốn xem chi tiết:`)
                .setColor(0x3498DB);

            // Hiển thị danh sách pets trong embed
            pets.forEach((pet, index) => {
                const rarityEmoji = this.getRarityEmoji(pet.rarity);
                embed.addFields({
                    name: `${rarityEmoji} ${pet.name} (Level ${pet.level})`,
                    value: `${pet.rarity} - ${pet.element} - HP: ${pet.stats.hp}/${pet.stats.maxHp}`,
                    inline: true
                });
            });

            // Tạo buttons cho pets (tối đa 5 buttons per row, max 5 rows = 25 pets)
            const rows = [];
            const petsPerRow = 3;
            
            for (let i = 0; i < pets.length; i += petsPerRow) {
                const rowPets = pets.slice(i, i + petsPerRow);
                const buttons = rowPets.map((pet, index) => {
                    const globalIndex = i + index;
                    return new ButtonBuilder()
                        .setCustomId(`view_pet_${pet._id}_${userId}`)
                        .setLabel(`${globalIndex + 1}. ${pet.name}`)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(this.getRarityEmoji(pet.rarity));
                });
                
                rows.push(new ActionRowBuilder().addComponents(buttons));
                
                // Discord giới hạn 5 rows
                if (rows.length >= 5) break;
            }

            console.log(`[PetDisplayService] Tạo response thành công cho User ID: ${userId}`);
            return { 
                embeds: [embed], 
                components: rows 
            };

        } catch (error) {
            console.error(`[PetDisplayService][ERROR] Lỗi trong showPetList cho User ID: ${userId}:`, error);
            console.error(`[PetDisplayService][ERROR] Stack trace:`, error.stack);
            
            return {
                content: "❌ Có lỗi xảy ra khi lấy danh sách pets của bạn. Vui lòng thử lại sau.",
                components: []
            };
        }
    }

    /**
     * Hiển thị thông tin chi tiết của một pet cụ thể
     * SỬ DỤNG REPLY EPHEMERAL NGAY LẬP TỨC, sau đó FOLLOWUP CÔNG KHAI
     */
    async showSinglePetStatus(interaction, petId, requestUserId) {
        console.log("requestUserId",requestUserId)
        const userId = interaction.user.id;
        const userMention = `<@${userId}>`;

        // *** BẮT BUỘC: Reply ngay lập tức (ephemeral) để qua 3 giây của Discord ***
        // Sau đó dùng followUp cho tin nhắn chính.
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Đang tải thông tin pet...', ephemeral: true });
            }
        } catch (e) {
             // Bắt lỗi InteractionAlreadyReplied nếu có, để code tiếp tục chạy
             if (e.code === 'InteractionAlreadyReplied') {
                 console.warn(`[PetDisplayService] Warning: Interaction already replied/deferred, skipping initial reply.`);
             } else {
                 console.error(`[PetDisplayService] Fatal error during initial reply/defer:`, e);
                 // Nếu không thể phản hồi/defer, không thể tiếp tục, ta sẽ throw hoặc return.
                 return;
             }
        }
        
        try {
            // Kiểm tra quyền truy cập - chỉ owner mới được xem
            if (userId !== requestUserId) {
                // Dùng followUp và ephemeral: true cho lỗi
                await interaction.followUp({ 
                    content: `❌ ${userMention}, chỉ <@${requestUserId}> mới có thể xem thông tin pet này!`,
                    ephemeral: true 
                });
                return; // Dừng hàm
            }

            console.log(`[PetDisplayService] showSinglePetStatus called with petId: ${petId}`);
            
            // Validate ObjectId format
            if (!mongoose.Types.ObjectId.isValid(petId)) {
                console.error(`[PetDisplayService] Invalid petId format: ${petId}`);
                await interaction.followUp({ 
                    content: `${userMention}, ❌ ID pet không hợp lệ!`,
                    ephemeral: true
                });
                return; // Dừng hàm
            }
            
            const pet = await Pet.findById(petId);

            if (!pet || pet.ownerId !== userId) {
                console.log(`[PetDisplayService] Pet not found or wrong owner. Pet ownerId: ${pet?.ownerId}, User ID: ${userId}`);
                await interaction.followUp({ 
                    content: `${userMention}, ❌ Không tìm thấy thú cưng này hoặc bạn không phải là chủ!`,
                    ephemeral: true
                });
                return; // Dừng hàm
            }

            console.log(`[PetDisplayService] Creating status embed for pet: ${pet.name}`);
            
            const rarityColors = { Normal: 0xAAAAAA, Magic: 0x00BFFF, Rare: 0xFFD700, Unique: 0x9400D3, Legend: 0xFF4500 };
            const embed = new EmbedBuilder()
                .setColor(rarityColors[pet.rarity] || 0x3498DB)
                .setTitle(`📜 BẢNG TRẠNG THÁI - ${pet.name}`)
                .setDescription(`*${pet.description}*`)
                .addFields(
                    { name: '🌟 Loài', value: `**${pet.species}**`, inline: true },
                    { name: '🔮 Độ hiếm', value: `**${pet.rarity}**`, inline: true },
                    { name: '⚡ Nguyên tố', value: `**${pet.element}**`, inline: true },
                    { name: '📊 Cấp độ', value: `**${pet.level}**`, inline: true },
                    { name: '🎯 Kinh nghiệm', value: `\`${pet.exp} / ${pet.expToNextLevel}\``, inline: true },
                    { name: '🏆 Giai đoạn tiến hóa', value: `**${pet.evolutionStage}**`, inline: true }
                )
                .addFields(
                    { name: '❤️ HP', value: `\`${pet.stats.hp} / ${pet.stats.maxHp}\``, inline: true },
                    { name: '💙 MP', value: `\`${pet.stats.mp} / ${pet.stats.maxMp}\``, inline: true },
                    { name: '⚡ Stamina', value: `\`${pet.status.stamina} / ${pet.status.maxStamina}\``, inline: true },
                    { name: '⚔️ Tấn công', value: `\`${pet.stats.atk}\``, inline: true },
                    { name: '🛡️ Phòng thủ', value: `\`${pet.stats.def}\``, inline: true },
                    { name: '🧠 Trí tuệ', value: `\`${pet.stats.int}\``, inline: true },
                    { name: '💨 Tốc độ', value: `\`${pet.stats.spd}\``, inline: true },
                    { name: '🍎 Độ đói', value: `\`${pet.status.hunger}/100\``, inline: true },
                    { name: '📅 Ngày tạo', value: `\`${pet.createdAt.toLocaleDateString('vi-VN')}\``, inline: true }
                );

            // Handle image loading and generation logic (giữ nguyên)
            let imageBuffer = null;
            if (pet.imageData) {
                try {
                    imageBuffer = Buffer.from(pet.imageData, 'base64');
                    embed.setThumbnail('attachment://pet-image.png');
                } catch (imageError) {
                    console.warn(`[PetDisplayService] Failed to load image from DB:`, imageError);
                }
            }
            if (!imageBuffer && pet.imageBasePrompt) {
                try {
                    const imageResult = await this.imageService.generateImage(pet.imageBasePrompt);
                    if (imageResult.success) {
                        imageBuffer = imageResult.imageBuffer;
                        embed.setThumbnail('attachment://pet-image.png');
                        pet.imageData = imageBuffer.toString('base64');
                        await pet.save();
                    }
                } catch (imageGenError) {
                    console.warn(`[PetDisplayService] Failed to regenerate image:`, imageGenError);
                }
            }

            // Add all skills and traits fields (giữ nguyên)
            if (pet.skills && pet.skills.length > 0) {
                pet.skills.forEach((skill, index) => {
                    embed.addFields({ name: `💥 Kỹ năng ${index + 1}: ${skill.name}`, value: `*${skill.description}*\n🔹 **Type**: ${skill.type} | **Cost**: ${skill.cost} MP | **Power**: ${skill.power}` });
                });
            } else {
                embed.addFields({ name: `💥 Kỹ năng`, value: `*Chưa có kỹ năng nào*` });
            }
            
            if (pet.traits && pet.traits.length > 0) {
                pet.traits.forEach((trait, index) => {
                    embed.addFields({ name: `💡 Nội tại ${index + 1}: ${trait.name}`, value: `*${trait.description}*` });
                });
            } else {
                embed.addFields({ name: `💡 Nội tại`, value: `*Chưa có nội tại nào*` });
            }

            // Thêm button quay lại danh sách
            const backButton = new ButtonBuilder()
                .setCustomId(`back_to_pet_list_${userId}`)
                .setLabel('⬅️ Quay lại danh sách')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(backButton);
            
            console.log(`[PetDisplayService] Sending status reply for pet: ${pet.name}`);
            
            // SỬ DỤNG FOLLOWUP (CHAT TIN NHẮN MỚI CÓ @)
            await interaction.followUp({ 
                content: `${userMention}, đây là thông tin chi tiết của **${pet.name}**!`, // @ người dùng vào tin nhắn mới
                embeds: [embed],
                files: imageBuffer ? [{ attachment: imageBuffer, name: 'pet-image.png' }] : [],
                components: [row]
            });
            
            console.log(`[PetDisplayService] Successfully sent status for pet: ${pet.name}`);

        } catch (error) {
            console.error(`[PetDisplayService] Error in showSinglePetStatus:`, error);
            console.error(`[PetDisplayService] Error stack:`, error.stack);
            
            try {
                // Dùng followUp để báo lỗi
                await interaction.followUp({
                    content: `${userMention}, ❌ Có lỗi xảy ra khi hiển thị thông tin pet: ${error.message}`,
                    ephemeral: true
                });
            } catch (replyError) {
                console.error(`[PetDisplayService] Failed to send error reply:`, replyError);
            }
        }
    }

    /**
     * Update pet list (dùng cho navigation buttons)
     * LƯU Ý: Giữ lại deferUpdate/editReply cho logic SỬA tin nhắn cũ
     */
    async showPetListUpdate(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetDisplayService] Update danh sách pets cho User ID: ${userId}`);

        try {
            // Bắt buộc deferUpdate để sửa tin nhắn cũ (editReply)
            await interaction.deferUpdate();

            const pets = await Pet.find({ ownerId: userId });
            console.log(`[PetDisplayService] Tìm thấy ${pets?.length || 0} pets cho User ID: ${userId}`);
            
            if (!pets || pets.length === 0) {
                return interaction.editReply({ 
                    content: `❌ Bạn chưa có thú cưng nào. Dùng \`/pet start\` để bắt đầu!`,
                    components: []
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📋 Danh Sách Pets của ${interaction.user.displayName}`)
                .setDescription(`Tổng cộng: **${pets.length}/${MAX_PETS_PER_USER}** pets\n\n⚠️ **Chỉ ${interaction.user.displayName} mới có thể tương tác với pets!**\n\nChọn pet bạn muốn xem chi tiết:`)
                .setColor(0x3498DB);

            // Hiển thị danh sách pets trong embed
            pets.forEach((pet, index) => {
                const rarityEmoji = this.getRarityEmoji(pet.rarity);
                embed.addFields({
                    name: `${rarityEmoji} ${pet.name} (Level ${pet.level})`,
                    value: `${pet.rarity} - ${pet.element} - HP: ${pet.stats.hp}/${pet.stats.maxHp}`,
                    inline: true
                });
            });

            // Tạo buttons cho pets
            const rows = [];
            const petsPerRow = 3;
            
            for (let i = 0; i < pets.length; i += petsPerRow) {
                const rowPets = pets.slice(i, i + petsPerRow);
                const buttons = rowPets.map((pet, index) => {
                    const globalIndex = i + index;
                    return new ButtonBuilder()
                        .setCustomId(`view_pet_${pet._id}_${userId}`)
                        .setLabel(`${globalIndex + 1}. ${pet.name}`)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(this.getRarityEmoji(pet.rarity));
                });
                
                rows.push(new ActionRowBuilder().addComponents(buttons));
                
                if (rows.length >= 5) break;
            }

            await interaction.editReply({ 
                embeds: [embed], 
                components: rows 
            });

        } catch (error) {
            console.error(`[PetDisplayService][ERROR] Lỗi trong showPetListUpdate:`, error);
            await interaction.editReply({
                content: "❌ Có lỗi xảy ra khi cập nhật danh sách pets.",
                components: []
            });
        }
    }

    /**
     * Quay lại danh sách pets
     * LƯU Ý: Giữ lại deferUpdate/editReply cho logic SỬA tin nhắn cũ
     */
    async backToPetList(interaction, requestUserId) {
        const userId = interaction.user.id;
        const userMention = `<@${userId}>`;
        
        // Bắt buộc deferUpdate để sửa tin nhắn cũ
        await interaction.deferUpdate();
        
        // Kiểm tra quyền truy cập
        if (userId !== requestUserId) {
            // Dùng followUp cho lỗi quyền truy cập
            await interaction.followUp({ 
                content: `❌ ${userMention}, chỉ <@${requestUserId}> mới có thể xem danh sách này!`,
                ephemeral: true
            });
            return; // Dừng hàm
        }

        // Gọi lại logic showPetList nhưng dùng editReply
        try {
            const pets = await Pet.find({ ownerId: userId });
            
            if (!pets || pets.length === 0) {
                return interaction.editReply({ 
                    content: `❌ Bạn chưa có thú cưng nào. Dùng \`/pet start\` để bắt đầu!`,
                    components: []
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📋 Danh Sách Pets của ${interaction.user.displayName}`)
                .setDescription(`Tổng cộng: **${pets.length}/${MAX_PETS_PER_USER}** pets\n\n⚠️ **Chỉ ${interaction.user.displayName} mới có thể tương tác với pets!**\n\nChọn pet bạn muốn xem chi tiết:`)
                .setColor(0x3498DB);

            pets.forEach((pet, index) => {
                const rarityEmoji = this.getRarityEmoji(pet.rarity);
                embed.addFields({
                    name: `${rarityEmoji} ${pet.name} (Level ${pet.level})`,
                    value: `${pet.rarity} - ${pet.element} - HP: ${pet.stats.hp}/${pet.stats.maxHp}`,
                    inline: true
                });
            });

            const rows = [];
            const petsPerRow = 3;
            
            for (let i = 0; i < pets.length; i += petsPerRow) {
                const rowPets = pets.slice(i, i + petsPerRow);
                const buttons = rowPets.map((pet, index) => {
                    const globalIndex = i + index;
                    return new ButtonBuilder()
                        .setCustomId(`view_pet_${pet._id}_${userId}`)
                        .setLabel(`${globalIndex + 1}. ${pet.name}`)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji(this.getRarityEmoji(pet.rarity));
                });
                
                rows.push(new ActionRowBuilder().addComponents(buttons));
                if (rows.length >= 5) break;
            }

            await interaction.editReply({ 
                embeds: [embed], 
                components: rows 
            });
        } catch (error) {
            console.error(`[PetDisplayService] Error in backToPetList:`, error);
            await interaction.editReply({
                content: "❌ Có lỗi xảy ra khi quay lại danh sách.",
                components: []
            });
        }
    }

    /**
     * Lấy emoji tương ứng với độ hiếm
     */
    getRarityEmoji(rarity) {
        const emojiMap = {
            'Normal': '⚪',
            'Magic': '🔵', 
            'Rare': '🟡',
            'Unique': '🟠',
            'Legend': '🔴'
        };
        return emojiMap[rarity] || '⚪';
    }
}

module.exports = PetDisplayService;