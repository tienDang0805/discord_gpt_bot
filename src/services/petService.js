// src/services/petService.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GptChatService = require('./gptChatService');
const Pet = require('../model/petSchema');
const ImageGenerationService = require('./imageGenerationService');
const ADMIN_IDS = ['448507913879945216']; // Add this line
// Khởi tạo các service một lần ở ngoài class để tái sử dụng
// Đúng theo cách bạn đã làm trong interactionHandler.js

class PetService {
    constructor() {
        
      
        this.gptService = GptChatService; // Sử dụng instance đã có
        this.imageService = new ImageGenerationService()
        this.imageGenService = new ImageGenerationService();

        this.DEFAULT_QUESTION_TIME_LIMIT_MS = 15 * 1000; // Mặc định 15 giây
    }

    /**
     * Bắt đầu quá trình chọn trứng cho người chơi.
     * @param {import('discord.js').Interaction} interaction 
     */
    async beginHatchingProcess(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetService] Bắt đầu quy trình chọn trứng cho User ID: ${userId}`);

        try {
            const existingPet = await Pet.findOne({ ownerId: userId });
            if (existingPet && !ADMIN_IDS.includes(userId)) {
                console.log(`[PetService] User ID: ${userId} đã có pet. Ngừng quy trình.`);
                return interaction.editReply({ content: `❌ Bạn đã có một thú cưng tên là **${existingPet.name}** rồi!`, ephemeral: true });
            }

            const prompt = `Tạo 3 loại trứng giả tưởng riêng biệt cho một game nuôi pet. Với mỗi quả trứng, hãy cung cấp một 'type' (ví dụ: 'Trứng Núi Lửa', 'Trứng Đại Dương', 'Trứng Vực Sâu') và một mô tả ngắn, bí ẩn chỉ trong một câu. Trả về dưới dạng một mảng JSON hợp lệ của các đối tượng, mỗi đối tượng có hai khóa là 'type' và 'description'.`;
            
            console.log(`[PetService] Đang gọi AI để tạo 3 loại trứng...`);
            const response = await this.gptService.generatePKResponse(prompt); // Dùng hàm generatePKResponse vẫn ổn cho tác vụ đơn giản này
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
     * Xử lý việc nở trứng sau khi người chơi đã chọn.
     * @param {import('discord.js').Interaction} interaction 
     * @param {string} eggType Loại trứng đã chọn.
     */
    async hatchEgg(interaction, eggType) {
        const userId = interaction.user.id;
        console.log(`[PetService] Bắt đầu nở trứng loại "${eggType}" cho User ID: ${userId}`);

        try {
            await interaction.message.delete();

            console.log(`[PetService] Đang gọi hàm generatePetFromEgg với loại trứng: ${eggType}`);

            
            const petData = await this.gptService.generatePetFromEgg(eggType);
            console.log(`[PetService] AI đã tạo xong dữ liệu pet cho User ID: ${userId}`, petData);

            const imagePrompt = `masterpiece, best quality, 4k, ultra-detailed, cinematic lighting, epic fantasy art, trending on artstation, a small adorable baby creature, ${petData.description_en_keywords}, species: ${petData.species}, element: ${petData.element}, rarity: ${petData.rarity}, isolated on a simple magical background`;
            console.log(`[PetService] Prompt tạo ảnh cho User ID: ${userId}: "${imagePrompt}"`);

            const imageResult = await this.imageService.generateImage(imagePrompt);
            if (!imageResult.success) {
                // Ném ra lỗi để catch block xử lý
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

            const rarityColors = { Normal: 0xAAAAAA, Magic: 0x00BFFF, Rare: 0xFFD700, Unique: 0x9400D3, Legend: 0xFF4500 };
            const embed = new EmbedBuilder()
                .setTitle(`🎉 CHÚC MỪNG! THÚ CƯNG CỦA BẠN ĐÃ NỞ! 🎉`)
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

                await interaction.editReply({ 
                    content: '',
                    embeds: [embed], 
                    files: [{ attachment: imageResult.imageBuffer, name: 'pet-image.png' }] 
                });
            console.log(`[PetService] Đã gửi thông báo pet nở thành công cho User ID: ${userId}`);

        } catch (error) {
            console.error(`[PetService][CRITICAL ERROR] Lỗi trong quá trình hatchEgg cho User ID: ${userId}:`, error);
            await interaction.editReply(`❌ Bot gặp lỗi nghiêm trọng trong quá trình nở trứng. Lỗi: ${error.message}. Vui lòng thử lại sau.`);
        }
    }

    /**
     * Hiển thị bảng trạng thái chi tiết của pet.
     * @param {import('discord.js').Interaction} interaction 
     */
    async showPetStatus(interaction) {
        const userId = interaction.user.id;
        console.log(`[PetService] Bắt đầu lấy trạng thái pet cho User ID: ${userId}`);

        try {
            const pet = await Pet.findOne({ ownerId: userId });
            if (!pet) {
                console.log(`[PetService] Không tìm thấy pet cho User ID: ${userId}.`);
                return interaction.editReply({ content: `❌ Bạn chưa có thú cưng. Dùng \`/pet start\` để bắt đầu!`, ephemeral: true });
            }
            console.log(`[PetService] Đã tìm thấy pet "${pet.name}" cho User ID: ${userId}.`);

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

            pet.skills.forEach(s => embed.addFields({ name: `💥 Kỹ năng: ${s.name}`, value: `*${s.description}* (Cost: ${s.cost} MP)`}));
            pet.traits.forEach(t => embed.addFields({ name: `💡 Nội tại: ${t.name}`, value: `*${t.description}*`}));
            
            await interaction.editReply({ 
                embeds: [embed],
                files: imageResult.success ? [{ attachment: imageResult.imageBuffer, name: 'pet-image.png' }] : []
            });
            console.log(`[PetService] Đã gửi bảng trạng thái thành công cho User ID: ${userId}`);

        } catch (error) {
            console.error(`[PetService][ERROR] Lỗi trong showPetStatus cho User ID: ${userId}:`, error);
            await interaction.editReply("❌ Có lỗi xảy ra khi lấy thông tin pet của bạn.");
        }
    }
}

module.exports = PetService;