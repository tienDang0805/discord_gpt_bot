// src/services/pet/EggService.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GptChatService = require('../gptChatService');
const { Pet, UserEggCooldown } = require('../../model/petSchema');
const ImageGenerationService = require('../imageGenerationService');

const ADMIN_IDS = ['448507913879945216','1376058136879955999','685881075125190726','1376071689124839526'];
const MAX_PETS_PER_USER = 6;
const MAX_EGGS_PER_DAY = 5;

class EggService {
    constructor() {
        this.gptService = GptChatService;
        this.imageService = new ImageGenerationService();
        this.DEFAULT_QUESTION_TIME_LIMIT_MS = 15 * 1000;
    }

   
    getRandomRarity() {
        const rand = Math.random() * 100;
        
        if (rand < 40) return 'Normal';
        if (rand < 70) return 'Magic';
        if (rand < 90) return 'Rare';
        if (rand < 99) return 'Unique';
        return 'Legend';
    }

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
     * Tạo 3 trứng với AI - GỌI 1 LẦN DUY NHẤT
     */
    async generateThreeEggs(rarities) {
        const prompt = `[Bối Cảnh & Vai Trò]
Bạn là **"Ovum-Genesis Master"**, bậc thầy sáng tạo các quả trứng huyền bí trong thế giới giả tưởng. Mỗi quả trứng bạn tạo ra không chỉ có tên gọi độc đáo mà còn mang trong mình một câu chuyện ngắn, gợi lên sự tò mò về sinh vật tiềm ẩn bên trong.

[Nhiệm Vụ]
Tạo **3 QUẢ TRỨNG HOÀN TOÀN KHÁC NHAU** cho 3 độ hiếm được chỉ định:
1. **${rarities[0]}**
2. **${rarities[1]}**
3. **${rarities[2]}**

Mỗi quả trứng cần có:
- **name**: Tên trứng độc đáo, gợi mở về bản chất của nó
- **description**: Mô tả ngắn gọn (1-2 câu) về vẻ ngoài và cảm giác tỏa ra từ quả trứng

---
[Hệ Thống Đặt Tên & Phong Cách Theo Độ Hiếm]

**🟢 Normal (Thường - 40%):**
- **Chủ đề:** Thiên nhiên cơ bản, hiện tượng thường ngày, vật liệu phổ thông
- **Phong cách:** Giản dị, ấm áp, gần gũi, bình dị
- **Công thức tên:** [Hiện tượng tự nhiên đơn giản] + [Tính từ mô tả nhẹ nhàng]
- **Nguồn cảm hứng:** Sương sớm, lá cây, đá cuội, gió nhẹ, mây trời, ánh nắng ban mai, cỏ dại, hoa nhỏ, sương mù
- **Ví dụ tên:** 
  - "Trứng Sương Mai" - "Trứng Lá Xanh" - "Trứng Gió Xuân"
  - "Trứng Đá Rêu" - "Trứng Cỏ Mềm" - "Trứng Mây Trắng"
  - "Trứng Nắng Chiều" - "Trứng Sỏi Nhỏ" - "Trứng Hoa Dại"
- **Mô tả:** Tập trung vào sự dịu dàng, thanh bình. Dùng từ như "nhẹ nhàng", "dịu êm", "ấm áp", "trong trẻo"

**🔵 Magic (Ma Thuật - 30%):**
- **Chủ đề:** Hiện tượng thiên nhiên đặc biệt, ánh sáng lung linh, năng lượng huyền bí, khoáng chất đẹp
- **Phong cách:** Mơ mộng, huyền ảo, lung linh, có chút phép thuật
- **Công thức tên:** [Hiện tượng đẹp/Đá quý] + [Nguyên tố ma thuật]
- **Nguồn cảm hứng:** Ánh trăng, sao băng, cầu vồng, ngọc bích, thủy tinh, vân mây, tuyết rơi, hoa kỳ ảo
- **Ví dụ tên:**
  - "Trứng Ánh Nguyệt" - "Trứng Sương Ngọc" - "Trứng Tinh Vân"
  - "Trứng Lục Bảo" - "Trứng Hoa Tuyết" - "Trứng Thủy Tinh"
  - "Trứng Lam Sương" - "Trứng Hồng Ngọc" - "Trứng Vân Du"
- **Mô tả:** Nhấn mạnh ánh sáng lấp lánh, màu sắc huyền ảo. Dùng từ như "lung linh", "huyền ảo", "lấp lánh", "mộng mơ"

**🟡 Rare (Hiếm - 20%):**
- **Chủ đề:** Nguyên tố mạnh mẽ, khoáng vật quý hiếm, hiện tượng thiên nhiên hiếm gặp
- **Phong cách:** Uy nghiêm, quyền năng, rực rỡ, bí ẩn sâu xa
- **Công thức tên:** [Nguyên tố mạnh/Hiện tượng đặc biệt] + [Khoáng chất quý/Sức mạnh]
- **Nguồn cảm hứng:** Sấm sét, lửa núi lửa, băng vĩnh cửu, gió bão, kim cương, thạch anh, nham thạch
- **Ví dụ tên:**
  - "Trứng Lôi Diệm" - "Trứng Băng Tinh" - "Trứng Nham Thạch"
  - "Trứng Phong Vân" - "Trứng Kim Cương" - "Trứng Hỏa Diệm"
  - "Trứng Băng Hà" - "Trứng Sấm Sét" - "Trứng Thạch Anh"
- **Mô tả:** Thể hiện sức mạnh, uy lực. Dùng từ như "rực rỡ", "hùng mạnh", "dữ dội", "uy nghiêm"

**🟠 Unique (Độc Đáo - 9%):**
- **Chủ đề:** Sinh vật thần thoại Á Đông, thiên thể, khái niệm huyền học cao cấp
- **Phong cách:** Cổ điển, thần thoại, uy nghi, thánh thiện
- **Công thức tên:** [Thần thú/Khái niệm vũ trụ] + [Thuộc tính đặc biệt]
- **Nguồn cảm hứng:** Long, Phượng, Kỳ Lân, Huyền Vũ, Chu Tước, Bạch Hổ, tinh tú, thiên hà
- **Ví dụ tên:**
  - "Trứng Long Vương" - "Trứng Phượng Hoàng" - "Trứng Kỳ Lân"
  - "Trứng Chu Tước" - "Trứng Huyền Vũ" - "Trứng Bạch Trạch"
  - "Trứng Tinh Tú" - "Trứng Linh Vân" - "Trứng Thiên Mã"
- **Mô tả:** Toát lên khí chất thần thánh, cổ xưa. Dùng từ như "linh thiêng", "uy nghi", "huyền bí", "cao quý"

**🔴 Legend (Huyền Thoại - 1%):**
- **Chủ đề:** Khái niệm triết học, nguồn gốc vũ trụ, tối thượng thần thánh, bản chất tạo hóa
- **Phong cách:** Tối thượng, siêu việt, vô cực, vượt ngoài nhận thức
- **Công thức tên:** [Khái niệm tối cao/Triết lý tạo hóa]
- **Nguồn cảm hứng:** Hỗn Độn, Thái Cực, Âm Dương, Ngũ Hành, Càn Khôn, Vô Cực, Hư Không
- **Ví dụ tên:**
  - "Trứng Hỗn Độn" - "Trứng Thái Cực" - "Trứng Vô Cực"
  - "Trứng Càn Khôn" - "Trứng Nguyên Sơ" - "Trứng Thiên Địa"
  - "Trứng Vạn Cổ" - "Trứng Hư Không" - "Trứng Nguyên Thủy"
- **Mô tả:** Gợi lên sự bất tận, vĩ đại. Dùng từ như "vô tận", "siêu việt", "chói lọi", "tối thượng", "huyền diệu"

---
[Nguyên Tắc Sáng Tạo BẮT BUỘC]

1. **Tuyệt Đối KHÔNG Trùng Lặp:**
   - 3 quả trứng phải HOÀN TOÀN KHÁC BIỆT về tên, chủ đề, và mô tả
   - Không lặp lại các ví dụ đã cho
   - Mỗi lần gọi phải tạo ra sự kết hợp MỚI

2. **Kho Từ Vựng Đa Dạng:**
   - **Thiên nhiên:** Mai, Đào, Sen, Lan, Cúc, Trúc, Liễu, Dương, Ngô Đồng
   - **Đá quý:** Ngọc, Bích, Hồng Ngọc, Lam Ngọc, Huyền Ngọc, Thanh Ngọc
   - **Thiên văn:** Tinh, Nguyệt, Vân, Hà, Diệu, Tú, Linh, Hào Quang
   - **Nguyên tố:** Lôi (Sấm), Phong (Gió), Băng (Tuyết), Viêm (Lửa), Thủy (Nước), Thổ (Đất)
   - **Thần thoại:** Long, Phượng, Kỳ Lân, Huyền Vũ, Chu Tước, Bạch Hổ, Thanh Long
   - **Triết học:** Âm Dương, Ngũ Hành, Thái Cực, Hỗn Độn, Hư Vô, Càn, Khôn

3. **Cấu Trúc:**
   - **Tên:** "Trứng [Thuộc tính 1-2]" (2-4 chữ, dễ nhớ, có âm điệu)
   - **Mô tả:** 1-2 câu ngắn gọn, sinh động, tạo hình ảnh trong đầu người đọc

4. **Tính Hợp Lý:**
   - Tên và mô tả phải nhất quán với nhau
   - Phong cách phải phù hợp với độ hiếm được chỉ định
   - Gợi mở về loại sinh vật có thể nở ra mà KHÔNG tiết lộ trực tiếp

---
[Ví Dụ Mẫu Output JSON]

\`\`\`json
{
  "eggs": [
    {
      "name": "Trứng Sương Bạc",
      "description": "Một quả trứng nhỏ nhắn với lớp vỏ mịn màng như giọt sương đọng, tỏa ra hơi lạnh dịu dàng. Nó phản chiếu ánh sáng như bạc lấp lánh dưới trăng non."
    },
    {
      "name": "Trứng Huyền Vũ",
      "description": "Quả trứng có vẻ ngoài uy nghiêm với những đường vân rồng rắn, tỏa ra khí chất cổ xưa của một vị thần hộ mệnh. Ánh sáng xung quanh nó dường như bị uốn cong bởi sức mạnh huyền bí."
    },
    {
      "name": "Trứng Phong Lôi",
      "description": "Bề mặt trứng không ngừng lấp loáng những tia điện nhỏ li ti, kèm theo tiếng vo ve như gió rít. Chạm vào nó, bạn có thể cảm nhận được năng lượng mãnh liệt đang dồn nén bên trong."
    }
  ]
}
\`\`\`

---
[Output Format - QUAN TRỌNG]
Trả về **DUY NHẤT** một JSON object với cấu trúc:
\`\`\`json
{
  "eggs": [
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." },
    { "name": "...", "description": "..." }
  ]
}
\`\`\`

**KHÔNG** thêm markdown, giải thích, hoặc text ngoài JSON.

[Bắt Đầu]
Độ hiếm của 3 trứng: ${rarities[0]}, ${rarities[1]}, ${rarities[2]}
Hãy tạo 3 quả trứng:`;

        try {
            const response = await this.gptService.generatePKResponse(prompt);
            const cleanedResponse = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const data = JSON.parse(cleanedResponse);
            
            if (!data.eggs || data.eggs.length < 3) {
                throw new Error('AI không trả về đủ 3 trứng');
            }
            
            console.log(`[EggService] AI tạo 3 trứng thành công:`, data.eggs.map(e => e.name));
            return data.eggs.slice(0, 3);
            
        } catch (error) {
            console.error(`[EggService] Lỗi generateThreeEggs:`, error);
            
            // Fallback
            const timestamp = Date.now();
            const fallbackMap = {
                'Normal': [
                    { name: 'Trứng Lá Xanh', description: 'Quả trứng nhỏ với lớp vỏ mịn màu xanh nhạt như lá non, tỏa ra hơi ấm dịu dàng.' },
                    { name: 'Trứng Sương Mai', description: 'Bề mặt trứng ướt át như giọt sương sớm, mang theo mùi hương của đất và cỏ tươi.' },
                    { name: 'Trứng Gió Xuân', description: 'Một quả trứng nhẹ nhàng, dường như có thể bay đi bất cứ lúc nào theo làn gió nhẹ.' }
                ],
                'Magic': [
                    { name: 'Trứng Ánh Bạc', description: 'Quả trứng phản chiếu ánh sáng lung linh như bạc lỏng, tạo ra những vệt sáng huyền ảo.' },
                    { name: 'Trứng Sương Ngọc', description: 'Lớp vỏ trong suốt như ngọc, bên trong có thể thấy ánh sáng xanh ngọc nhẹ nhàng lấp lánh.' },
                    { name: 'Trứng Tinh Vân', description: 'Bề mặt trứng như chứa cả dải ngân hà thu nhỏ, với những đốm sáng lấp lánh như sao.' }
                ],
                'Rare': [
                    { name: 'Trứng Lôi Diệm', description: 'Quả trứng tỏa ra năng lượng điện mạnh mẽ, bề mặt lóe lên những tia chớp nhỏ li ti.' },
                    { name: 'Trứng Băng Tinh', description: 'Một khối băng tinh khiết hình trứng, bên trong có vẻ như đang ngủ yên một sinh vật cổ đại.' },
                    { name: 'Trứng Nham Thạch', description: 'Vỏ trứng cứng như đá núi lửa, ấm nóng và có những vết nứt tỏa ra ánh sáng đỏ rực.' }
                ],
                'Unique': [
                    { name: 'Trứng Long Vương', description: 'Quả trứng khắc họa hình rồng oai phong, toát ra khí chất uy nghiêm của bậc chúa tể.' },
                    { name: 'Trứng Phượng Hoàng', description: 'Bề mặt trứng rực rỡ như ngọn lửa thiêng, những đường vân như lông vũ của phượng hoàng.' },
                    { name: 'Trứng Kỳ Lân', description: 'Một quả trứng thánh thiện với ánh sáng trắng tinh khôi bao quanh, mang lại cảm giác bình an.' }
                ],
                'Legend': [
                    { name: 'Trứng Hỗn Độn', description: 'Quả trứng tối cao này dường như chứa cả vũ trụ bên trong, không gian xung quanh nó bị bóp méo.' },
                    { name: 'Trứng Thái Cực', description: 'Một nửa sáng, một nửa tối, quả trứng này thể hiện sự cân bằng tuyệt đối của vũ trụ.' },
                    { name: 'Trứng Vô Cực', description: 'Nhìn vào quả trứng này, bạn cảm thấy như đang trôi dạt trong không gian vô tận, siêu việt thời gian.' }
                ]
            };
            
            return rarities.map((rarity, i) => {
                const options = fallbackMap[rarity] || fallbackMap['Normal'];
                const index = Math.floor(((timestamp + i * 1000) / 1000) % options.length);
                return options[index];
            });
        }
    }

    async beginHatchingProcess(interaction) {
        const userId = interaction.user.id;
        console.log(`[EggService] Bắt đầu quy trình chọn trứng cho User ID: ${userId}`);

        try {
            const currentPets = await Pet.find({ ownerId: userId });
            if (currentPets.length >= MAX_PETS_PER_USER && !ADMIN_IDS.includes(userId)) {
                console.log(`[EggService] User ID: ${userId} đã có đủ ${MAX_PETS_PER_USER} pets.`);
                return interaction.editReply({ 
                    content: `❌ Bạn đã có đủ **${MAX_PETS_PER_USER} pets** rồi! Hãy thả bớt pet cũ trước khi mở trứng mới.`
                });
            }

            const eggCheck = await this.canOpenEgg(userId);
            if (!eggCheck.canOpen) {
                return interaction.editReply({ 
                    content: `⏰ Bạn đã hết lượt mở trứng hôm nay! Còn lại: **${eggCheck.remaining}/${MAX_EGGS_PER_DAY}** lượt.`
                });
            }

            // Random 3 độ hiếm và gọi AI 1 lần duy nhất
            const rarities = [this.getRandomRarity(), this.getRandomRarity(), this.getRandomRarity()];
            const eggs = await this.generateThreeEggs(rarities);

            console.log(`[EggService] Đã tạo 3 trứng:`, eggs);

            const embed = new EmbedBuilder()
                .setTitle('🥚 Lễ Thiêng Chọn Trứng')
                .setDescription(`Có ba quả trứng thần bí hiện ra trước mặt bạn, mỗi quả đều chứa đựng một linh hồn cổ xưa đang chờ được thức tỉnh...\n\n**Còn lại: ${eggCheck.remaining}/${MAX_EGGS_PER_DAY} lượt hôm nay**\n\n⚠️ **Chỉ ${interaction.user.displayName} mới có thể chọn trứng!**\n\nHãy chọn một quả trứng để bắt đầu cuộc hành trình của bạn!`)
                .setColor(0xFAEBD7);

            const buttons = eggs.map((egg, index) => {
                embed.addFields({ name: `🥚 ${egg.name}`, value: `*${egg.description}*` });
                return new ButtonBuilder()
                    .setCustomId(`select_egg_${index}_${rarities[index]}_${userId}`)
                    .setLabel(`Chọn ${egg.name}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🥚');
            });

            const row = new ActionRowBuilder().addComponents(buttons);

            await interaction.editReply({ embeds: [embed], components: [row] });
            console.log(`[EggService] Đã gửi bảng chọn trứng cho User ID: ${userId}`);

        } catch (error) {
            console.error(`[EggService][ERROR] Lỗi trong beginHatchingProcess:`, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply("❌ Bot gặp lỗi khi tạo trứng, vui lòng thử lại sau.");
            } else {
                await interaction.editReply("❌ Bot gặp lỗi khi tạo trứng, vui lòng thử lại sau.");
            }
        }
    }

    async hatchEgg(interaction, eggIndex, eggRarity, requestUserId) {
        const userId = interaction.user.id;
        console.log(`[EggService] hatchEgg called - User: ${userId}, Rarity: ${eggRarity}`);
        
        if (userId !== requestUserId) {
            return interaction.reply({ 
                content: `❌ Chỉ <@${requestUserId}> mới có thể chọn trứng này!`, 
                ephemeral: true 
            });
        }

        try {
            await interaction.deferUpdate();

            const hatchingEmbed = new EmbedBuilder()
                .setTitle('🥚 Trứng Đang Nở...')
                .setDescription('✨ Có điều gì đó đang xảy ra bên trong quả trứng...\n⏰ Vui lòng chờ trong giây lát...')
                .setColor(0xFFD700);
            
            await interaction.editReply({ embeds: [hatchingEmbed], components: [] });
            await new Promise(resolve => setTimeout(resolve, 3000));

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

            // Tạo lại tên trứng cho rarity này
            const eggData = await this.generateThreeEggs([eggRarity, eggRarity, eggRarity]);
            const eggType = eggData[0].name;
            
            console.log(`[EggService] Đang gọi generatePetFromEgg với rarity: ${eggRarity}, eggType: ${eggType}`);
            const petData = await this.gptService.generatePetFromEgg(eggType, eggRarity);
            console.log(`[EggService] AI đã tạo xong pet:`, petData.species, petData.rarity);

            const imagePrompt = `masterpiece, best quality, 4k, ultra-detailed, cinematic lighting, epic fantasy art, trending on artstation, a small adorable baby creature, ${petData.description_en_keywords}, species: ${petData.species}, element: ${petData.element}, rarity: ${petData.rarity}, isolated on a simple magical background`;

            const imageResult = await this.imageService.generateImage(imagePrompt);
            if (!imageResult.success) {
                throw new Error(imageResult.error || "AI không thể tạo hình ảnh cho pet.");
            }

            const finalStats = {
                hp: petData.base_stats.hp, maxHp: petData.base_stats.hp,
                mp: petData.base_stats.mp, maxMp: petData.base_stats.mp,
                atk: petData.base_stats.atk, def: petData.base_stats.def,
                int: petData.base_stats.int, spd: petData.base_stats.spd,
            };

            const imageBase64 = imageResult.imageBuffer ? imageResult.imageBuffer.toString('base64') : null;

            const newPet = new Pet({
                ownerId: userId,
                name: petData.species,
                species: petData.species,
                description: petData.description_vi,
                rarity: petData.rarity,
                element: petData.element,
                stats: finalStats,
                skills: petData.skills, 
                traits: petData.traits, 
                imageBasePrompt: imagePrompt,
                imageData: imageBase64,
                expToNextLevel: 100
            });

            await newPet.save();
            console.log(`[EggService] Đã lưu pet mới vào DB thành công`);

            await this.updateEggCooldown(userId);

            const rarityColors = { Normal: 0xAAAAAA, Magic: 0x00BFFF, Rare: 0xFFD700, Unique: 0xFF8C00, Legend: 0xFF4500 };
            const embed = new EmbedBuilder()
                .setTitle(`🎉 CHÚC MỪNG! THÚ CƯNG CỦA BẠN ĐÃ NỞ! 🎉`)
                .setDescription(`Từ trong quả trứng **${eggType}**, một **${petData.species}** đã ra đời!`)
                .setColor(rarityColors[petData.rarity] || 0xFFFFFF)
                .addFields(
                    { name: '🌟 Tên', value: newPet.name, inline: true },
                    { name: `✨ Độ hiếm`, value: newPet.rarity, inline: true},
                    { name: `💧 Hệ`, value: newPet.element, inline: true},
                    { name: '📜 Mô tả', value: newPet.description }
                )
                .setImage('attachment://pet-image.png');

            if (newPet.skills && newPet.skills.length > 0) {
                newPet.skills.forEach((skill, index) => {
                    embed.addFields({
                        name: `💥 Kỹ năng ${index + 1}: ${skill.name}`,
                        value: `*${skill.description}* (Cost: ${skill.cost} MP, Type: ${skill.type})`
                    });
                });
            }

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
            console.log(`[EggService] Đã gửi thông báo pet nở thành công`);

        } catch (error) {
            console.error(`[EggService][CRITICAL ERROR] Lỗi trong quá trình hatchEgg:`, error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Lỗi')
                .setDescription(`Bot gặp lỗi trong quá trình nở trứng: ${error.message}`)
                .setColor(0xFF0000);
                
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
}

module.exports = EggService;