// src/services/pet/PetManagementService.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Pet } = require('../../model/petSchema');

class PetManagementService {
    constructor() {}

    /**
     * Hiển thị menu để chọn pet cần thả bằng buttons
     */
    async showReleasePetMenu(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetManagementService] Hiển thị menu thả pet cho User ID: ${userId}`);

        try {


            const pets = await Pet.find({ ownerId: userId });
            if (!pets || pets.length === 0) {
                return interaction.editReply({ 
                    content: `❌ Bạn chưa có thú cưng nào để thả.`
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🕊️ Chọn Pet Để Thả`)
                .setDescription(`Chọn pet bạn muốn thả về tự nhiên. **Hành động này không thể hoàn tác!**`)
                .setColor(0xFF6B6B);

            // Hiển thị danh sách pets trong embed
            pets.forEach((pet, index) => {
                const rarityEmoji = this.getRarityEmoji(pet.rarity);
                embed.addFields({
                    name: `${rarityEmoji} ${pet.name} (Level ${pet.level})`,
                    value: `${pet.rarity} - ${pet.element}`,
                    inline: true
                });
            });

            // Tạo buttons để thả pets
            const rows = [];
            const petsPerRow = 3;
            
            for (let i = 0; i < pets.length; i += petsPerRow) {
                const rowPets = pets.slice(i, i + petsPerRow);
                const buttons = rowPets.map((pet, index) => {
                    const globalIndex = i + index;
                    return new ButtonBuilder()
                        .setCustomId(`release_pet_${pet._id}_${userId}`)
                        .setLabel(`${globalIndex + 1}. Thả ${pet.name}`)
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🕊️');
                });
                
                rows.push(new ActionRowBuilder().addComponents(buttons));
                if (rows.length >= 5) break;
            }

            await interaction.editReply({ embeds: [embed], components: rows });

        } catch (error) {
            console.error(`[PetManagementService][ERROR] Lỗi trong showReleasePetMenu:`, error);
            await interaction.editReply("❌ Có lỗi xảy ra khi hiển thị menu thả pet.");
        }
    }

    /**
     * Xác nhận thả pet
     */
    async confirmReleasePet(interaction, petId, requestUserId) {
        try {
            const userId = interaction.user.id;
            
            // Kiểm tra quyền truy cập - chỉ owner mới được thả
            if (userId !== requestUserId) {
                return interaction.reply({ 
                    content: `❌ Chỉ <@${requestUserId}> mới có thể thả pet này!`, 
                    ephemeral: true 
                });
            }

            await interaction.deferUpdate();
            
            const pet = await Pet.findById(petId);
            if (!pet || pet.ownerId !== userId) {
                return interaction.editReply({ 
                    content: '❌ Không tìm thấy thú cưng này!',
                    components: []
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🕊️ Xác Nhận Thả ${pet.name}`)
                .setDescription(`Bạn có chắc chắn muốn thả **${pet.name}** (${pet.rarity} - ${pet.element}) về tự nhiên?\n\n⚠️ **Hành động này không thể hoàn tác!**`)
                .setColor(0xFF6B6B);

            const confirmButton = new ButtonBuilder()
                .setCustomId(`confirm_release_${petId}_${userId}`)
                .setLabel('Xác Nhận Thả')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🕊️');

            const cancelButton = new ButtonBuilder()
                .setCustomId(`cancel_release_${userId}`)
                .setLabel('Hủy')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error(`[PetManagementService][ERROR] Lỗi trong confirmReleasePet:`, error);
            await interaction.editReply({
                content: "❌ Có lỗi xảy ra.",
                components: []
            });
        }
    }

    /**
     * Thực hiện thả pet
     */
    async releasePet(interaction, petId, requestUserId) {
        try {
            const userId = interaction.user.id;
            
            // Kiểm tra quyền truy cập - chỉ owner mới được thả
            if (userId !== requestUserId) {
                return interaction.reply({ 
                    content: `❌ Chỉ <@${requestUserId}> mới có thể thả pet này!`, 
                    ephemeral: true 
                });
            }

            await interaction.deferUpdate();

            const pet = await Pet.findById(petId);
            if (!pet || pet.ownerId !== userId) {
                return interaction.editReply({ 
                    content: '❌ Không tìm thấy thú cưng này!',
                    components: []
                });
            }

            const petName = pet.name;
            await Pet.findByIdAndDelete(petId);

            const embed = new EmbedBuilder()
                .setTitle(`🕊️ ${petName} Đã Được Thả`)
                .setDescription(`**${petName}** đã được thả về tự nhiên và sẽ sống hạnh phúc ở đó.\n\nCảm ơn bạn đã chăm sóc ${petName}! 💚`)
                .setColor(0x2ECC71);

            await interaction.editReply({ embeds: [embed], components: [] });

        } catch (error) {
            console.error(`[PetManagementService][ERROR] Lỗi trong releasePet:`, error);
            await interaction.editReply({
                content: "❌ Có lỗi xảy ra khi thả pet.",
                components: []
            });
        }
    }

    /**
     * Hủy thả pet và quay lại menu thả pet
     */
    async cancelRelease(interaction, requestUserId) {
        const userId = interaction.user.id;
        
        // Kiểm tra quyền truy cập
        if (userId !== requestUserId) {
            return interaction.reply({ 
                content: `❌ Bạn không có quyền thực hiện action này!`, 
                ephemeral: true 
            });
        }

        // Quay lại menu thả pet
        await this.showReleasePetMenuUpdate(interaction);
    }

    /**
     * Update release pet menu (dùng cho navigation buttons)
     */
    async showReleasePetMenuUpdate(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetManagementService] Update menu thả pet cho User ID: ${userId}`);

        try {
            await interaction.deferUpdate();

            const pets = await Pet.find({ ownerId: userId });
            if (!pets || pets.length === 0) {
                return interaction.editReply({ 
                    content: `❌ Bạn chưa có thú cưng nào để thả.`,
                    components: []
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🕊️ Chọn Pet Để Thả`)
                .setDescription(`Chọn pet bạn muốn thả về tự nhiên. **Hành động này không thể hoàn tác!**`)
                .setColor(0xFF6B6B);

            pets.forEach((pet, index) => {
                const rarityEmoji = this.getRarityEmoji(pet.rarity);
                embed.addFields({
                    name: `${rarityEmoji} ${pet.name} (Level ${pet.level})`,
                    value: `${pet.rarity} - ${pet.element}`,
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
                        .setCustomId(`release_pet_${pet._id}_${userId}`)
                        .setLabel(`${globalIndex + 1}. Thả ${pet.name}`)
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🕊️');
                });
                
                rows.push(new ActionRowBuilder().addComponents(buttons));
                if (rows.length >= 5) break;
            }

            await interaction.editReply({ embeds: [embed], components: rows });

        } catch (error) {
            console.error(`[PetManagementService][ERROR] Lỗi trong showReleasePetMenuUpdate:`, error);
            await interaction.editReply({
                content: "❌ Có lỗi xảy ra khi cập nhật menu thả pet.",
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

module.exports = PetManagementService;