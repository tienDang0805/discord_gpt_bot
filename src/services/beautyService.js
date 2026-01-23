const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

class BeautyService {
    constructor() {
        this.interval = null;
    }

    /**
     * Bắt đầu service gửi ảnh định kỳ
     * @param {Client} client - Discord Client
     */
    start(client) {
        const intervalMinutes = process.env.BEAUTY_INTERVAL_MINUTES || 5;
        const ms = intervalMinutes * 60 * 1000;

        console.log(`✅ BeautyService đã khởi động! Gửi ảnh mỗi ${intervalMinutes} phút.`);

        // Gửi ngay 1 tấm khi vừa chạy bot (để test), nếu không thích thì comment dòng này lại
        this.sendGirlImage(client);

        // Tạo vòng lặp
        this.interval = setInterval(() => {
            this.sendGirlImage(client);
        }, ms);
    }

    /**
     * Logic lấy ảnh từ Pexels và gửi vào Discord
     */
    async sendGirlImage(client) {
        try {
            const channelId = process.env.BEAUTY_CHANNEL_ID;
            const channel = await client.channels.fetch(channelId).catch(() => null);

            if (!channel) {
                console.error(`❌ BeautyService: Không tìm thấy channel ID ${channelId}`);
                return;
            }

            const imageUrl = await this.getPexelsImage();

            if (imageUrl) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF69B4) // Màu hồng
                    .setTitle('🌸 Vitamin Gái Xinh 🌸')
                    .setImage(imageUrl)
                    .setFooter({ text: 'Powered by Pexels API' })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
                console.log('✅ Đã gửi ảnh gái xinh thành công.');
            }

        } catch (error) {
            console.error('❌ Lỗi BeautyService:', error.message);
        }
    }

    /**
     * Gọi API Pexels lấy link ảnh
     */
    async getPexelsImage() {
        try {
            // Random page từ 1 đến 100 để ảnh luôn mới
            const randomPage = Math.floor(Math.random() * 100) + 1;
            
            // Các từ khóa hot: asian girl, woman portrait, beauty, korean model, fashion
            const query = 'Vietnamese girl'; 

            const response = await axios.get('https://api.pexels.com/v1/search', {
                headers: {
                    Authorization: process.env.PEXELS_API_KEY
                },
                params: {
                    query: query,
                    per_page: 1,
                    page: randomPage,
                }
            });

            if (response.data.photos && response.data.photos.length > 0) {
                // Lấy ảnh chất lượng cao (large2x hoặc large)
                return response.data.photos[0].src.large2x;
            }
            return null;
        } catch (error) {
            console.error('❌ Lỗi gọi Pexels API:', error.response?.data || error.message);
            return null;
        }
    }
}

module.exports = new BeautyService();