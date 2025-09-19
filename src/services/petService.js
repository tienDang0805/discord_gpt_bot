// src/services/petService.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const GptChatService = require('./gptChatService');
const { Pet, UserEggCooldown } = require('../model/petSchema');
const ImageGenerationService = require('./imageGenerationService');

const ADMIN_IDS = ['448507913879945216'];
const MAX_PETS_PER_USER = 6;
const EGG_COOLDOWN_HOURS = 24; // 24 giờ

class PetService {
    constructor() {
        this.gptService = GptChatService;
        this.imageService = new ImageGenerationService();
        this.imageGenService = new ImageGenerationService();
        this.DEFAULT_QUESTION_TIME_LIMIT_MS = 15 * 1000;
    }

    /**
     * Kiểm tra xem user có thể mở trứng không
     */
    async canOpenEgg(userId) {
        if (ADMIN_IDS.includes(userId)) {
            return { canOpen: true };
        }

        const cooldown = await UserEggCooldown.findOne({ userId });
        if (!cooldown) {
            return { canOpen: true };
        }

        const now = new Date();
        const timeDiff = now - cooldown.lastEggOpenTime;
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (hoursDiff >= EGG_COOLDOWN_HOURS) {
            return { canOpen: true };
        }

        const remainingHours = Math.ceil(EGG_COOLDOWN_HOURS - hoursDiff);
        return { 
            canOpen: false, 
            remainingHours 
        };
    }

    /**
     * Cập nhật thời gian mở trứng cuối cùng
     */
    async updateEggCooldown(userId) {
        await UserEggCooldown.findOneAndUpdate(
            { userId },
            { lastEggOpenTime: new Date() },
            { upsert: true }
        );
    }

    /**
     * Bắt đầu quá trình chọn trứng cho người chơi
     */
    async beginHatchingProcess(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetService] Bắt đầu quy trình chọn trứng cho User ID: ${userId}`);

        try {
            // Kiểm tra xem user đã có pet chưa
            const existingPet = await Pet.findOne({ ownerId: userId });
            if (existingPet && !ADMIN_IDS.includes(userId)) {
                console.log(`[PetService] User ID: ${userId} đã có pet. Ngừng quy trình.`);
                return interaction.editReply({ 
                    content: `❌ Bạn đã có một thú cưng tên là **${existingPet.name}** rồi! Dùng \`/pet status\` để xem thông tin.`, 
                    ephemeral: true 
                });
            }

            // Kiểm tra cooldown
            const eggCheck = await this.canOpenEgg(userId);
            if (!eggCheck.canOpen) {
                return interaction.editReply({ 
                    content: `⏰ Bạn phải đợi thêm **${eggCheck.remainingHours} giờ** nữa mới có thể mở trứng tiếp theo!`, 
                    ephemeral: true 
                });
            }

            const prompt = `Tạo 3 loại trứng giả tưởng riêng biệt cho một game nuôi pet. Với mỗi quả trứng, hãy cung cấp một 'type' (ví dụ: 'Trứng Núi Lửa', 'Trứng Đại Dương', 'Trứng Vực Sâu') và một mô tả ngắn, bí ẩn chỉ trong một câu. Trả về dưới dạng một mảng JSON hợp lệ của các đối tượng, mỗi đối tượng có hai khóa là 'type' và 'description'.`;
            
            console.log(`[PetService] Đang gọi AI để tạo 3 loại trứng...`);
            const response = await this.gptService.generatePKResponse(prompt);
            const eggs = JSON.parse(response);
            console.log(`[PetService] AI đã trả về ${eggs.length} loại trứng.`);

            const embed = new EmbedBuilder()
                .setTitle('🥚 Lễ Chọn Trứng')
                .setDescription('Một sức mạnh cổ xưa đã ban cho bạn ba quả trứng bí ẩn. Linh hồn của một người bạn đồng hành đang chờ đợi bên trong.\n\nHãy chọn một quả trứng để bắt đầu cuộc hành trình của bạn!')
                .setColor(0xFAEBD7);

            const buttons = eggs.map(egg => {
                embed.addFields({ name: `🥚 ${egg.type}`, value: `*${egg.description}*` });
                return new ButtonBuilder()
                    .setCustomId(`select_egg_${egg.type.replace(/\s+/g, '_')}`)
                    .setLabel(`Chọn ${egg.type}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🥚');
            });

            const row = new ActionRowBuilder().addComponents(buttons);

            await interaction.editReply({ embeds: [embed], components: [row] });
            console.log(`[PetService] Đã gửi bảng chọn trứng cho User ID: ${userId}`);

        } catch (error) {
            console.error(`[PetService][ERROR] Lỗi trong beginHatchingProcess cho User ID: ${userId}:`, error);
            await interaction.editReply("❌ Bot gặp lỗi khi tạo trứng, vui lòng thử lại sau.");
        }
    }

    /**
     * Xử lý việc nở trứng sau khi người chơi đã chọn
     */
    async hatchEgg(interaction, eggType) {
        const userId = interaction.user.id;
        console.log(`[PetService] Bắt đầu nở trứng loại "${eggType}" cho User ID: ${userId}`);

        try {
            // Gửi message trứng đang nở ngay lập tức
            const hatchingEmbed = new EmbedBuilder()
                .setTitle('🥚 Trứng Đang Nở...')
                .setDescription('✨ Có điều gì đó đang xảy ra bên trong quả trứng...\n⏰ Vui lòng chờ trong giây lát...')
                .setColor(0xFFD700);
            
            await interaction.update({ embeds: [hatchingEmbed], components: [] });

            // Thêm delay để tạo cảm giác hồi hộp
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Kiểm tra lại xem user đã có pet chưa trước khi tạo
            const existingPet = await Pet.findOne({ ownerId: userId });
            if (existingPet && !ADMIN_IDS.includes(userId)) {
                return interaction.editReply({ 
                    embeds: [new EmbedBuilder()
                        .setTitle('❌ Lỗi')
                        .setDescription(`Bạn đã có thú cưng **${existingPet.name}** rồi!`)
                        .setColor(0xFF0000)
                    ], 
                    components: [] 
                });
            }

            console.log(`[PetService] Đang gọi hàm generatePetFromEgg với loại trứng: ${eggType}`);
            const petData = await this.gptService.generatePetFromEgg(eggType);
            console.log(`[PetService] AI đã tạo xong dữ liệu pet cho User ID: ${userId}`, petData);

            const imagePrompt = `masterpiece, best quality, 4k, ultra-detailed, cinematic lighting, epic fantasy art, trending on artstation, a small adorable baby creature, ${petData.description_en_keywords}, species: ${petData.species}, element: ${petData.element}, rarity: ${petData.rarity}, isolated on a simple magical background`;
            console.log(`[PetService] Prompt tạo ảnh cho User ID: ${userId}: "${imagePrompt}"`);

            const imageResult = await this.imageService.generateImage(imagePrompt);
            if (!imageResult.success) {
                throw new Error(imageResult.error || "AI không thể tạo hình ảnh cho pet.");
            }
            console.log(`[PetService] Tạo ảnh thành công cho User ID: ${userId}`);

            const finalStats = {
                hp: petData.base_stats.hp, maxHp: petData.base_stats.hp,
                mp: petData.base_stats.mp, maxMp: petData.base_stats.mp,
                atk: petData.base_stats.atk, def: petData.base_stats.def,
                int: petData.base_stats.int, spd: petData.base_stats.spd,
            };

            const newPet = new Pet({
                ownerId: userId,
                name: petData.species,
                species: petData.species,
                description: petData.description_vi,
                rarity: petData.rarity,
                element: petData.element,
                stats: finalStats,
                skills: [petData.skill],
                traits: [petData.trait],
                imageBasePrompt: imagePrompt,
                expToNextLevel: 100
            });

            console.log(`[PetService] Chuẩn bị lưu pet mới vào DB cho User ID: ${userId}`);
            await newPet.save();
            console.log(`[PetService] Đã lưu pet mới vào DB thành công cho User ID: ${userId}`);

            // Cập nhật cooldown
            await this.updateEggCooldown(userId);

            const rarityColors = { Normal: 0xAAAAAA, Magic: 0x00BFFF, Rare: 0xFFD700, Unique: 0x9400D3, Legend: 0xFF4500 };
            const embed = new EmbedBuilder()
                .setTitle(`🎉 CHÚC MỪNG! THÚ CƯNG CỦA BạN ĐÃ NỞ! 🎉`)
                .setDescription(`Từ trong quả trứng **${eggType.replace(/_/g, ' ')}**, một **${petData.species}** đã ra đời!`)
                .setColor(rarityColors[petData.rarity] || 0xFFFFFF)
                .addFields(
                    { name: '🌟 Tên', value: newPet.name, inline: true },
                    { name: `✨ Độ hiếm`, value: newPet.rarity, inline: true},
                    { name: `💧 Hệ`, value: newPet.element, inline: true},
                    { name: '📜 Mô tả', value: newPet.description },
                    { name: `💥 Kỹ năng: ${newPet.skills[0].name}`, value: newPet.skills[0].description },
                    { name: `💡 Nội tại: ${newPet.traits[0].name}`, value: newPet.traits[0].description }
                )
                .setImage('attachment://pet-image.png')
                .setFooter({ text: `Hãy dùng /pet status để xem chi tiết nhé!` });

            // Gửi kết quả cuối bằng cách edit message đang nở
            try {
                await hatchingMessage.edit({ 
                    content: `<@${userId}>`,
                    embeds: [embed], 
                    files: [{ attachment: imageResult.imageBuffer, name: 'pet-image.png' }]
                });
                console.log(`[PetService] Updated hatching message with final result`);
            } catch (editError) {
                console.error(`[PetService] Failed to edit hatching message:`, editError.message);
                // Fallback: gửi message mới
                await interaction.channel.send({ 
                    content: `<@${userId}>`,
                    embeds: [embed], 
                    files: [{ attachment: imageResult.imageBuffer, name: 'pet-image.png' }]
                });
            }
            console.log(`[PetService] Đã gửi thông báo pet nở thành công cho User ID: ${userId}`);

        } catch (error) {
            console.error(`[PetService][CRITICAL ERROR] Lỗi trong quá trình hatchEgg cho User ID: ${userId}:`, error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Lỗi')
                .setDescription(`Bot gặp lỗi trong quá trình nở trứng: ${error.message}`)
                .setColor(0xFF0000);
                
            // Send error as new message
            await interaction.channel.send({ 
                content: `<@${userId}>`, 
                embeds: [errorEmbed] 
            });
        }
    }

    /**
     * Hiển thị trạng thái pet của người dùng
     */
    async showPetStatus(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetService] Bắt đầu lấy trạng thái pet cho User ID: ${userId}`);

        try {
            const pet = await Pet.findOne({ ownerId: userId });
            if (!pet) {
                console.log(`[PetService] Không tìm thấy pet cho User ID: ${userId}.`);
                return interaction.editReply({ 
                    content: `❌ Bạn chưa có thú cưng nào. Dùng \`/pet start\` để bắt đầu!`, 
                    ephemeral: true 
                });
            }

            // Hiển thị thông tin pet trực tiếp
            return this.showSinglePetStatus(interaction, pet);

        } catch (error) {
            console.error(`[PetService][ERROR] Lỗi trong showPetStatus cho User ID: ${userId}:`, error);
            await interaction.editReply("❌ Có lỗi xảy ra khi lấy thông tin pet của bạn.");
        }
    }

    /**
     * Hiển thị thông tin chi tiết của một pet cụ thể
     */
    async showSinglePetStatus(interaction, pet) {
        console.log(`[PetService] Hiển thị thông tin pet "${pet.name}" ID: ${pet._id}`);

        try {
            console.log(`[PetService] Đang tái tạo ảnh cho pet "${pet.name}"...`);
            const imageResult = await this.imageService.generateImage(pet.imageBasePrompt);
            if (!imageResult.success) {
                console.warn(`[PetService] Tái tạo ảnh thất bại cho pet "${pet.name}", sẽ hiển thị status không có ảnh.`);
            } else {
                console.log(`[PetService] Tái tạo ảnh thành công cho pet "${pet.name}".`);
            }

            const rarityColors = { Normal: 0xAAAAAA, Magic: 0x00BFFF, Rare: 0xFFD700, Unique: 0x9400D3, Legend: 0xFF4500 };
            const embed = new EmbedBuilder()
                .setColor(rarityColors[pet.rarity] || 0x3498DB)
                .setTitle(`📜 BẢNG TRẠNG THÁI - ${pet.name}`)
                .setDescription(`*${pet.description}*`)
                .addFields(
                    { name: 'Cấp độ', value: `**${pet.level}**`, inline: true },
                    { name: 'Kinh nghiệm', value: `\`${pet.exp} / ${pet.expToNextLevel}\``, inline: true },
                    { name: 'Độ hiếm', value: `**${pet.rarity}**`, inline: true },
                    { name: 'HP', value: `❤️ \`${pet.stats.hp} / ${pet.stats.maxHp}\``, inline: true },
                    { name: 'MP', value: `💙 \`${pet.stats.mp} / ${pet.stats.maxMp}\``, inline: true },
                    { name: 'Stamina', value: `⚡ \`${pet.status.stamina} / ${pet.status.maxStamina}\``, inline: true },
                    { name: 'Tấn công', value: `⚔️ \`${pet.stats.atk}\``, inline: true },
                    { name: 'Phòng thủ', value: `🛡️ \`${pet.stats.def}\``, inline: true },
                    { name: 'Tốc độ', value: `💨 \`${pet.stats.spd}\``, inline: true }
                );
            
            if (imageResult.success) {
                embed.setThumbnail('attachment://pet-image.png');
            }

            pet.skills.forEach(s => embed.addFields({ 
                name: `💥 Kỹ năng: ${s.name}`, 
                value: `*${s.description}* (Cost: ${s.cost} MP)` 
            }));
            pet.traits.forEach(t => embed.addFields({ 
                name: `💡 Nội tại: ${t.name}`, 
                value: `*${t.description}*` 
            }));
            
            await interaction.editReply({ 
                embeds: [embed],
                files: imageResult.success ? [{ attachment: imageResult.imageBuffer, name: 'pet-image.png' }] : [],
                components: []
            });
            console.log(`[PetService] Đã gửi bảng trạng thái thành công cho pet "${pet.name}"`);

        } catch (error) {
            console.error(`[PetService][ERROR] Lỗi trong showSinglePetStatus cho pet "${pet.name}":`, error);
            await interaction.editReply("❌ Có lỗi xảy ra khi hiển thị thông tin pet.");
        }
    }

    /**
     * Xử lý khi user chọn pet từ select menu
     */
    async handlePetSelection(interaction, petId) {
        try {
            const pet = await Pet.findById(petId);
            if (!pet || pet.ownerId !== interaction.user.id) {
                return interaction.editReply({ 
                    content: '❌ Không tìm thấy thú cưng này!', 
                    ephemeral: true 
                });
            }

            await this.showSinglePetStatus(interaction, pet);
        } catch (error) {
            console.error(`[PetService][ERROR] Lỗi trong handlePetSelection:`, error);
            await interaction.editReply("❌ Có lỗi xảy ra khi hiển thị thông tin pet.");
        }
    }

    /**
     * Hiển thị menu để thả pet
     */
    async showReleasePetMenu(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetService] Hiển thị xác nhận thả pet cho User ID: ${userId}`);

        try {
            const pet = await Pet.findOne({ ownerId: userId });
            if (!pet) {
                return interaction.editReply({ 
                    content: `❌ Bạn chưa có thú cưng nào để thả.`, 
                    ephemeral: true 
                });
            }

            // Hiển thị xác nhận trực tiếp thay vì menu chọn
            return this.confirmReleasePet(interaction, pet._id);

        } catch (error) {
            console.error(`[PetService][ERROR] Lỗi trong showReleasePetMenu:`, error);
            await interaction.editReply("❌ Có lỗi xảy ra khi hiển thị menu thả pet.");
        }
    }

    /**
     * Xác nhận thả pet
     */
    async confirmReleasePet(interaction, petId) {
        try {
            const pet = await Pet.findById(petId);
            if (!pet || pet.ownerId !== interaction.user.id) {
                return interaction.editReply({ 
                    content: '❌ Không tìm thấy thú cưng này!', 
                    ephemeral: true 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🕊️ Xác Nhận Thả ${pet.name}`)
                .setDescription(`Bạn có chắc chắn muốn thả **${pet.name}** (${pet.rarity} - ${pet.element}) về tự nhiên?\n\n⚠️ **Hành động này không thể hoàn tác!**`)
                .setColor(0xFF6B6B);

            const confirmButton = new ButtonBuilder()
                .setCustomId(`confirm_release_${petId}`)
                .setLabel('Xác Nhận Thả')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🕊️');

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_release')
                .setLabel('Hủy')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error(`[PetService][ERROR] Lỗi trong confirmReleasePet:`, error);
            await interaction.editReply("❌ Có lỗi xảy ra.");
        }
    }

    /**
     * Thực hiện thả pet
     */
    async releasePet(interaction, petId) {
        try {
            const pet = await Pet.findById(petId);
            if (!pet || pet.ownerId !== interaction.user.id) {
                return interaction.editReply({ 
                    content: '❌ Không tìm thấy thú cưng này!', 
                    ephemeral: true 
                });
            }

            await Pet.findByIdAndDelete(petId);

            const embed = new EmbedBuilder()
                .setTitle(`🕊️ ${pet.name} Đã Được Thả`)
                .setDescription(`**${pet.name}** đã được thả về tự nhiên và sẽ sống hạnh phúc ở đó.\n\nCảm ơn bạn đã chăm sóc ${pet.name}! 💚`)
                .setColor(0x2ECC71);

            await interaction.editReply({ embeds: [embed], components: [] });

        } catch (error) {
            console.error(`[PetService][ERROR] Lỗi trong releasePet:`, error);
            await interaction.editReply("❌ Có lỗi xảy ra khi thả pet.");
        }
    }
}

module.exports = PetService;