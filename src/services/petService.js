// src/services/petService.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const GptChatService = require('./gptChatService');
const { Pet, UserEggCooldown } = require('../model/petSchema');
const ImageGenerationService = require('./imageGenerationService');
const mongoose = require('mongoose'); // Thêm dòng này vào đầu petService.js

const ADMIN_IDS = ['448507913879945216','1376058136879955999'];
const MAX_PETS_PER_USER = 6;
const MAX_EGGS_PER_DAY = 5;

class PetService {
    constructor() {
        this.gptService = GptChatService;
        this.imageService = new ImageGenerationService();
        this.imageGenService = new ImageGenerationService();
        this.DEFAULT_QUESTION_TIME_LIMIT_MS = 15 * 1000;
    }

    /**
     * Kiểm tra xem user có thể mở trứng không (giới hạn 5 lần/ngày)
     */
    async canOpenEgg(userId) {
        if (ADMIN_IDS.includes(userId)) {
            return { canOpen: true, remaining: 999 };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const cooldown = await UserEggCooldown.findOne({ userId });
        if (!cooldown) {
            return { canOpen: true, remaining: MAX_EGGS_PER_DAY };
        }

        const lastOpenDate = new Date(cooldown.lastEggOpenTime);
        lastOpenDate.setHours(0, 0, 0, 0);
        
        // Reset counter if it's a new day
        if (today.getTime() !== lastOpenDate.getTime()) {
            cooldown.dailyCount = 0;
            cooldown.lastEggOpenTime = new Date();
            await cooldown.save();
            return { canOpen: true, remaining: MAX_EGGS_PER_DAY };
        }

        const remaining = MAX_EGGS_PER_DAY - cooldown.dailyCount;
        return { 
            canOpen: remaining > 0,
            remaining: Math.max(0, remaining)
        };
    }

    /**
     * Cập nhật số lần mở trứng trong ngày
     */
    async updateEggCooldown(userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const cooldown = await UserEggCooldown.findOne({ userId });
        
        if (!cooldown) {
            await UserEggCooldown.create({
                userId,
                lastEggOpenTime: new Date(),
                dailyCount: 1
            });
        } else {
            const lastOpenDate = new Date(cooldown.lastEggOpenTime);
            lastOpenDate.setHours(0, 0, 0, 0);
            
            if (today.getTime() === lastOpenDate.getTime()) {
                cooldown.dailyCount += 1;
            } else {
                cooldown.dailyCount = 1;
            }
            cooldown.lastEggOpenTime = new Date();
            await cooldown.save();
        }
    }

    /**
     * Bắt đầu quá trình chọn trứng cho người chơi
     */
    async beginHatchingProcess(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetService] Bắt đầu quy trình chọn trứng cho User ID: ${userId}`);

        try {
            // Kiểm tra số lượng pets hiện tại
            const currentPets = await Pet.find({ ownerId: userId });
            if (currentPets.length >= MAX_PETS_PER_USER && !ADMIN_IDS.includes(userId)) {
                console.log(`[PetService] User ID: ${userId} đã có đủ ${MAX_PETS_PER_USER} pets.`);
                return interaction.editReply({ 
                    content: `❌ Bạn đã có đủ **${MAX_PETS_PER_USER} pets** rồi! Hãy thả bớt pet cũ trước khi mở trứng mới.`, 
                    ephemeral: true 
                });
            }

            // Kiểm tra số lần mở trứng trong ngày
            const eggCheck = await this.canOpenEgg(userId);
            if (!eggCheck.canOpen) {
                return interaction.editReply({ 
                    content: `⏰ Bạn đã hết lượt mở trứng hôm nay! Còn lại: **${eggCheck.remaining}/${MAX_EGGS_PER_DAY}** lượt.`, 
                    ephemeral: true 
                });
            }

            // Prompt cải tiến để tạo trứng đa dạng hơn
            // Thay thế prompt trong beginHatchingProcess method
const prompt = `
   Bạn là Người Sáng Tạo Trứng, bậc thầy tạo ra trứng từ mọi nền văn hóa , Chủng loại.

                        ## Quy tắc quan trọng về ĐỘ HIẾM & TÊN TRỨNG
                        - Mỗi quả trứng phải có tên phù hợp tuyệt đối với độ hiếm , : Các Chủng Tộc và Sinh Vật
                        - độ hiếm : Normal (40%) , magic(30%) , rare (20%) , unique(9%) , legend  (1%)=> tên trứng phải phù hợp với độ hiếm , Mày tự ngẫu nhiên 
                        ### Prompt Tổng hợp: Các Chủng Tộc và Sinh Vật

                            **1. Long tộc (Rồng):**
                            * **Phương Tây:** Dragon, Wyvern, Drake, Wyrm.
                            * **Phương Đông:** Thanh Long, Hắc Long, Hỏa Long, Ứng Long, Giao Long, Kỳ Lân Long.

                            **2. Điểu tộc (Chim thần):**
                            * **Phương Tây:** Phoenix, Griffin, Thunderbird, Roc.
                            * **Phương Đông:** Chu Tước, Cửu Thiên Huyền Nữ Điểu, Tinh Điểu, Bằng.

                            **3. Thú tộc (Quái vật):**
                            * **Phương Tây:** Wolf, Tiger, Lion, Fox, Bear.
                            * **Phương Đông:** Bạch Hổ, Thanh Hồ, Cửu Vĩ Hồ, Sơn Quân Hùng.

                            **4. Bò sát:**
                            * **Phương Tây:** Snake, Lizard, Turtle, Crocodile.
                            * **Phương Đông:** Huyền Vũ (rùa + rắn), Kim Xà, Hỏa Xà, Long Quy.

                            **5. Côn trùng / Yêu trùng:**
                            * **Phương Tây:** Butterfly, Beetle, Mantis, Spider.
                            * **Phương Đông:** Kim Thiền, Linh Chuồn, Độc Trùng, Tằm Tổ Mẫu.

                            **6. Thủy sinh:**
                            * **Phương Tây:** Fish, Octopus, Jellyfish, Shark.
                            * **Phương Đông:** Ngư Yêu, Kình Ngư, Thủy Quái, Côn Ngư (có thể hóa thành Bằng).

                            **7. Thực vật:**
                            * **Phương Tây:** Tree spirit, Flower fairy, Mushroom.
                            * **Phương Đông:** Mộc Linh, Liễu Tinh, Đào Hoa Yêu, Thụ Yêu.

                            **8. Khoáng chất:**
                            * **Phương Tây:** Golem, Crystal being, Stone guardian.
                            * **Phương Đông:** Thạch Quái, Ngọc Hồn, Kim Tinh, Sơn Thần.

                            **9. Linh thể:**
                            * **Phương Tây:** Ghost, Spirit, Wraith, Shade.
                            * **Phương Đông:** Quỷ Hồn, Oán Linh, Du Hồn, Phệ Hồn Quái.

                            **10. Nguyên tố:**
                            * **Phương Tây:** Fire, Water, Earth, Air elemental.
                            * **Phương Đông:** Ngũ Hành Linh (Kim, Mộc, Thủy, Hỏa, Thổ), Lôi Linh, Âm Dương Linh.

                            **11. Cơ giới:**
                            * **Phương Tây:** Automaton, Clockwork, Mecha.
                            * **Phương Đông:** Khôi Lỗi, Cơ Tượng, Thần Binh Hóa Hình.

                            **12. Vũ trụ / Huyền ảo:**
                            * **Phương Tây:** Star being, Cosmic entity, Nebula.
                            * **Phương Đông:** Tinh Thần, Nguyệt Thần, Thái Dương Thần, Thiên Ma, Cửu Thiên Tinh Quái.

                            **13. Tiểu yêu / Tinh linh:**
                            * **Phương Tây:** Fairy, Pixie, Sprite, Wisp.
                            * **Phương Đông:** Hồ Yêu, Sơn Tinh, Thủy Tinh, Lục Yêu, Dạ Xoa.

                            **14. Sơn Hải Kinh đặc hữu:**
                            * **Kỳ thú:** Bì Ngư, Cửu Đầu Điểu, Kinh Xà, Thao Thiết, Cùng Kỳ, Đào Ngột.
                            * **Thần thú:** Kỳ Lân, Bạch Trạch, Hỗn Độn.
                        `;
            
            console.log(`[PetService] Đang gọi AI để tạo 3 loại trứng...`);
            const response = await this.gptService.generatePKResponse(prompt);
            const eggs = JSON.parse(response);
            console.log(`[PetService] AI đã trả về ${eggs.length} loại trứng.`);

            const embed = new EmbedBuilder()
                .setTitle('🥚 Lễ Thiêng Chọn Trứng')
                .setDescription(`Có ba quả trứng thần bí hiện ra trước mặt bạn, mỗi quả đều chứa đựng một linh hồn cổ xưa đang chờ được thức tỉnh...\n\n**Còn lại: ${eggCheck.remaining}/${MAX_EGGS_PER_DAY} lượt hôm nay**\n\nHãy chọn một quả trứng để bắt đầu cuộc hành trình của bạn!`)
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

        // Kiểm tra lại số lượng pets
        const currentPets = await Pet.find({ ownerId: userId });
        if (currentPets.length >= MAX_PETS_PER_USER && !ADMIN_IDS.includes(userId)) {
            return interaction.editReply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Lỗi')
                    .setDescription(`Bạn đã có đủ **${MAX_PETS_PER_USER} pets** rồi!`)
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

        // Lưu ảnh vào database dưới dạng base64 (nếu cần)
        const imageBase64 = imageResult.imageBuffer ? imageResult.imageBuffer.toString('base64') : null;

        const newPet = new Pet({
            ownerId: userId,
            name: petData.species,
            species: petData.species,
            description: petData.description_vi,
            rarity: petData.rarity,
            element: petData.element,
            stats: finalStats,
            skills: petData.skills, // ✅ Sử dụng mảng skills từ AI
            traits: petData.traits, // ✅ Sử dụng mảng traits từ AI
            imageBasePrompt: imagePrompt,
            imageData: imageBase64,
            expToNextLevel: 100
        });

        console.log(`[PetService] Chuẩn bị lưu pet mới vào DB cho User ID: ${userId}`);
        await newPet.save();
        console.log(`[PetService] Đã lưu pet mới vào DB thành công cho User ID: ${userId}`);

        // Cập nhật lượt mở trứng
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
                { name: '📜 Mô tả', value: newPet.description }
            )
            .setImage('attachment://pet-image.png');

        // ✅ Hiển thị tất cả skills (thay vì chỉ skills[0])
        if (newPet.skills && newPet.skills.length > 0) {
            newPet.skills.forEach((skill, index) => {
                embed.addFields({
                    name: `💥 Kỹ năng ${index + 1}: ${skill.name}`,
                    value: `*${skill.description}* (Cost: ${skill.cost} MP, Type: ${skill.type})`
                });
            });
        }

        // ✅ Hiển thị tất cả traits (thay vì chỉ traits[0])
        if (newPet.traits && newPet.traits.length > 0) {
            newPet.traits.forEach((trait, index) => {
                embed.addFields({
                    name: `💡 Nội tại ${index + 1}: ${trait.name}`,
                    value: `*${trait.description}*`
                });
            });
        }

        embed.setFooter({ text: `Dùng /pet list để xem tất cả pets của bạn!` });

        await interaction.editReply({ 
            content: `<@${userId}>`,
            embeds: [embed], 
            files: [{ attachment: imageResult.imageBuffer, name: 'pet-image.png' }]
        });
        console.log(`[PetService] Đã gửi thông báo pet nở thành công cho User ID: ${userId}`);

    } catch (error) {
        console.error(`[PetService][CRITICAL ERROR] Lỗi trong quá trình hatchEgg cho User ID: ${userId}:`, error);
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Lỗi')
            .setDescription(`Bot gặp lỗi trong quá trình nở trứng: ${error.message}`)
            .setColor(0xFF0000);
            
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}
    /**
     * Hiển thị danh sách pets của user
     */
    // Alternative: Button-based pet list (thay thế trong PetService)

/**
 * Hiển thị danh sách pets của user bằng buttons
 */
async showPetList(interaction) {
    const userId = interaction.user.id;
    console.log(`[PetService] Hiển thị danh sách pets cho User ID: ${userId}`);

    try {
        const pets = await Pet.find({ ownerId: userId });
        console.log(`[PetService] Tìm thấy ${pets?.length || 0} pets cho User ID: ${userId}`);
        
        if (!pets || pets.length === 0) {
            return interaction.editReply({ 
                content: `❌ Bạn chưa có thú cưng nào. Dùng \`/pet start\` để bắt đầu!`, 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📋 Danh Sách Pets của ${interaction.user.displayName}`)
            .setDescription(`Tổng cộng: **${pets.length}/${MAX_PETS_PER_USER}** pets\n\nChọn pet bạn muốn xem chi tiết:`)
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
                    .setCustomId(`view_pet_${pet._id}`)
                    .setLabel(`${globalIndex + 1}. ${pet.name}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(this.getRarityEmoji(pet.rarity));
            });
            
            rows.push(new ActionRowBuilder().addComponents(buttons));
            
            // Discord giới hạn 5 rows
            if (rows.length >= 5) break;
        }

        await interaction.editReply({ 
            embeds: [embed], 
            components: rows 
        });
        console.log(`[PetService] Đã gửi danh sách pets thành công cho User ID: ${userId}`);

    } catch (error) {
        console.error(`[PetService][ERROR] Lỗi trong showPetList cho User ID: ${userId}:`, error);
        console.error(`[PetService][ERROR] Stack trace:`, error.stack);
        
        try {
            await interaction.editReply({
                content: "❌ Có lỗi xảy ra khi lấy danh sách pets của bạn. Vui lòng thử lại sau.",
                components: []
            });
        } catch (replyError) {
            console.error(`[PetService][ERROR] Không thể gửi error message:`, replyError);
        }
    }
}

/**
 * Hiển thị menu để chọn pet cần thả bằng buttons
 */
async showReleasePetMenu(interaction) {
    const userId = interaction.user.id;
    console.log(`[PetService] Hiển thị menu thả pet cho User ID: ${userId}`);

    try {
        const pets = await Pet.find({ ownerId: userId });
        if (!pets || pets.length === 0) {
            return interaction.editReply({ 
                content: `❌ Bạn chưa có thú cưng nào để thả.`, 
                ephemeral: true 
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
                    .setCustomId(`release_pet_${pet._id}`)
                    .setLabel(`${globalIndex + 1}. Thả ${pet.name}`)
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🕊️');
            });
            
            rows.push(new ActionRowBuilder().addComponents(buttons));
            if (rows.length >= 5) break;
        }

        await interaction.editReply({ embeds: [embed], components: rows });

    } catch (error) {
        console.error(`[PetService][ERROR] Lỗi trong showReleasePetMenu:`, error);
        await interaction.editReply("❌ Có lỗi xảy ra khi hiển thị menu thả pet.");
    }
}

    /**
     * Hiển thị thông tin chi tiết của một pet cụ thể
     */
   /**
 * Hiển thị thông tin chi tiết của một pet cụ thể
 */
async showSinglePetStatus(interaction, petId) {
    try {
        console.log(`[DEBUG] showSinglePetStatus called with petId: ${petId}`);
        
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(petId)) {
            console.error(`[DEBUG] Invalid petId format: ${petId}`);
            return interaction.editReply({ 
                content: '❌ ID pet không hợp lệ!', 
                ephemeral: true 
            });
        }
        
        const pet = await Pet.findById(petId);
        console.log(`[DEBUG] Pet found:`, pet ? `${pet.name} (${pet._id})` : 'null');
        
        if (!pet || pet.ownerId !== interaction.user.id) {
            console.log(`[DEBUG] Pet not found or wrong owner. Pet ownerId: ${pet?.ownerId}, User ID: ${interaction.user.id}`);
            return interaction.editReply({ 
                content: '❌ Không tìm thấy thú cưng này!', 
                ephemeral: true 
            });
        }

        console.log(`[DEBUG] Creating status embed for pet: ${pet.name}`);
        
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

        // Handle image loading
        let imageBuffer = null;
        if (pet.imageData) {
            try {
                imageBuffer = Buffer.from(pet.imageData, 'base64');
                embed.setThumbnail('attachment://pet-image.png');
                console.log(`[DEBUG] Loaded image from DB for pet: ${pet.name}`);
            } catch (imageError) {
                console.warn(`[DEBUG] Failed to load image from DB:`, imageError);
            }
        }

        // Regenerate image if needed
        if (!imageBuffer && pet.imageBasePrompt) {
            console.log(`[DEBUG] Regenerating image for pet: ${pet.name}`);
            try {
                const imageResult = await this.imageService.generateImage(pet.imageBasePrompt);
                if (imageResult.success) {
                    imageBuffer = imageResult.imageBuffer;
                    embed.setThumbnail('attachment://pet-image.png');
                    
                    // Save new image to DB
                    try {
                        pet.imageData = imageBuffer.toString('base64');
                        await pet.save();
                        console.log(`[DEBUG] Saved new image to DB for pet: ${pet.name}`);
                    } catch (saveError) {
                        console.warn(`[DEBUG] Failed to save image to DB:`, saveError);
                    }
                }
            } catch (imageGenError) {
                console.warn(`[DEBUG] Failed to regenerate image:`, imageGenError);
            }
        }

        // ✅ Add all skills (properly handle array)
        if (pet.skills && pet.skills.length > 0) {
            pet.skills.forEach((skill, index) => {
                embed.addFields({ 
                    name: `💥 Kỹ năng ${index + 1}: ${skill.name}`, 
                    value: `*${skill.description}*\n🔹 **Type**: ${skill.type} | **Cost**: ${skill.cost} MP | **Power**: ${skill.power}`
                });
            });
        } else {
            embed.addFields({ 
                name: `💥 Kỹ năng`, 
                value: `*Chưa có kỹ năng nào*`
            });
        }
        
        // ✅ Add all traits (properly handle array)
        if (pet.traits && pet.traits.length > 0) {
            pet.traits.forEach((trait, index) => {
                embed.addFields({ 
                    name: `💡 Nội tại ${index + 1}: ${trait.name}`, 
                    value: `*${trait.description}*`
                });
            });
        } else {
            embed.addFields({ 
                name: `💡 Nội tại`, 
                value: `*Chưa có nội tại nào*`
            });
        }
        
        console.log(`[DEBUG] Sending status reply for pet: ${pet.name}`);
        
        await interaction.editReply({ 
            embeds: [embed],
            files: imageBuffer ? [{ attachment: imageBuffer, name: 'pet-image.png' }] : [],
            components: []
        });
        
        console.log(`[DEBUG] Successfully sent status for pet: ${pet.name}`);

    } catch (error) {
        console.error(`[DEBUG] Error in showSinglePetStatus:`, error);
        console.error(`[DEBUG] Error stack:`, error.stack);
        
        try {
            await interaction.editReply({
                content: `❌ Có lỗi xảy ra khi hiển thị thông tin pet: ${error.message}`,
                components: []
            });
        } catch (replyError) {
            console.error(`[DEBUG] Failed to send error reply:`, replyError);
        }
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

    /**
     * Xử lý khi user chọn pet từ select menu
     */
    async handlePetListSelection(interaction, action, petId) {
        if (action === 'status') {
            await interaction.deferUpdate();
            await this.showSinglePetStatus(interaction, petId);
        } else if (action === 'release') {
            await interaction.deferUpdate();
            await this.confirmReleasePet(interaction, petId);
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
            'Unique': '🟣',
            'Legend': '🔴'
        };
        return emojiMap[rarity] || '⚪';
    }
}

module.exports = PetService;