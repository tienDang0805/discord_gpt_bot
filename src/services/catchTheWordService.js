// File: services/catchTheWordService.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GptChatService = require('./gptChatService'); 
const ImageGenerationService = require('./imageGenerationService');

class CatchTheWordService {
    constructor() {
        this.activeGames = new Map();
        this.imageGenService = new ImageGenerationService();
    }

    isGameActive(guildId) {
        return this.activeGames.has(guildId);
    }

    async startGame(guildId, channelId, creatorId, numRounds, timeLimitSeconds) {
        const timeLimitMs = timeLimitSeconds * 1000;

        // Tạo trạng thái game
        this.activeGames.set(guildId, {
            channelId,
            creatorId,
            currentRoundIndex: 0,
            rounds: [],
            scores: new Map(), // Dùng Map để dễ quản lý điểm
            numRounds,
            timeLimit: timeLimitMs,
            roundMessage: null,
            roundTimer: null,
        });

        const gameState = this.activeGames.get(guildId);

        try {
            // 1. Lấy ý tưởng câu đố từ AI Chữ
            const roundsData = await GptChatService.generateCatchTheWordRounds(numRounds);
            if (!roundsData || roundsData.length === 0) {
                this.activeGames.delete(guildId);
                return { success: false, message: '❌ Bot không thể nghĩ ra câu đố nào lúc này. Vui lòng thử lại!' };
            }
            gameState.rounds = roundsData;
            
            // 2. Bắt đầu vòng đầu tiên
            await this.sendNextRound(guildId);

            return { 
                success: true, 
                message: `🎉 **Game Đuổi Hình Bắt Chữ** với ${numRounds} vòng đã bắt đầu! Chúc mọi người may mắn!` 
            };
        } catch (error) {
            console.error('Lỗi khi bắt đầu game:', error);
            this.activeGames.delete(guildId);
            return { success: false, message: '❌ Đã xảy ra lỗi nghiêm trọng khi tạo game.' };
        }
    }

    async sendNextRound(guildId) {
        const gameState = this.activeGames.get(guildId);
        if (!gameState) return;

        // Nếu đã hết vòng thì kết thúc game
        if (gameState.currentRoundIndex >= gameState.numRounds) {
            await this.endGame(guildId);
            return;
        }

        const channel = await global.discordClient.channels.fetch(gameState.channelId);
        const roundData = gameState.rounds[gameState.currentRoundIndex];

        const waitingMessage = await channel.send(`🧠 **Vòng ${gameState.currentRoundIndex + 1}/${gameState.numRounds}**: Bot đang vẽ hình, xin chờ...`);

        try {
            // 3. Tạo ảnh từ prompt
            const imageResult = await this.imageGenService.generateImage(roundData.imagePrompt);
            if (!imageResult.success || !imageResult.imageBuffer) {
                throw new Error('Không thể tạo ảnh cho câu đố.');
            }

            const embed = new EmbedBuilder()
                .setColor(0xFF4500)
                .setTitle(`🖼️ Vòng ${gameState.currentRoundIndex + 1}: Đây là chữ gì?`)
                .setImage('attachment://puzzle-image.png')
                .setFooter({ text: `Bạn có ${gameState.timeLimit / 1000} giây để trả lời.` });

            const buttons = roundData.options.map((option, index) => 
                new ButtonBuilder()
                    .setCustomId(`ctw_answer_${index}`)
                    .setLabel(option)
                    .setStyle(ButtonStyle.Secondary)
            );
            const row = new ActionRowBuilder().addComponents(buttons);

            await waitingMessage.delete();
            const message = await channel.send({ 
                embeds: [embed], 
                components: [row],
                files: [{ attachment: imageResult.imageBuffer, name: 'puzzle-image.png' }]
            });

            gameState.roundMessage = message;
            gameState.answeredUsers = new Set(); // Reset người đã trả lời
            gameState.roundStartTime = Date.now();

            // 4. Hẹn giờ hết thời gian
            gameState.roundTimer = setTimeout(() => this.revealAnswer(guildId), gameState.timeLimit);

        } catch (error) {
            console.error("Lỗi khi gửi vòng chơi:", error);
            await waitingMessage.edit('❌ Gặp lỗi khi tạo hình ảnh. Game sẽ tự hủy.');
            this.activeGames.delete(guildId);
        }
    }
     
    async submitAnswer(guildId, userId, userName, answerIndex) {
        const gameState = this.activeGames.get(guildId);
        if (!gameState || gameState.answeredUsers.has(userId)) return;

        gameState.answeredUsers.add(userId);
        const currentRound = gameState.rounds[gameState.currentRoundIndex];
        
        // Nếu trả lời đúng
        if (answerIndex === currentRound.correctAnswerIndex) {
            const timeTaken = Date.now() - gameState.roundStartTime;
            
            // Lấy điểm hiện tại, nếu chưa có thì là 0
            const userScore = gameState.scores.get(userId) || { score: 0, totalTime: 0, name: userName };
            
            userScore.score += 1;
            userScore.totalTime += timeTaken;
            gameState.scores.set(userId, userScore);

            // Gửi thông báo trả lời đúng và chuyển vòng ngay lập tức
            const channel = await global.discordClient.channels.fetch(gameState.channelId);
            await channel.send(`✅ **${userName}** đã trả lời đúng! Chuẩn bị sang vòng tiếp theo...`);
            
            // Hủy bộ đếm giờ cũ và tiết lộ đáp án ngay
            clearTimeout(gameState.roundTimer);
            await this.revealAnswer(guildId);
        }
    }

    async revealAnswer(guildId) {
        const gameState = this.activeGames.get(guildId);
        if (!gameState) return;

        const channel = await global.discordClient.channels.fetch(gameState.channelId);
        const currentRound = gameState.rounds[gameState.currentRoundIndex];
        const correctAnswerText = currentRound.options[currentRound.correctAnswerIndex];

        // Vô hiệu hóa các nút bấm của câu hỏi cũ
        if (gameState.roundMessage) {
            try {
                const disabledRow = new ActionRowBuilder().addComponents(
                    gameState.roundMessage.components[0].components.map(button => ButtonBuilder.from(button).setDisabled(true))
                );
                await gameState.roundMessage.edit({ components: [disabledRow] });
            } catch {}
        }

        const revealEmbed = new EmbedBuilder()
            .setColor(0x32CD32)
            .setTitle(`Đáp án vòng ${gameState.currentRoundIndex + 1}`)
            .setDescription(`Đáp án đúng là: **${correctAnswerText}**`)
            .setTimestamp();
        await channel.send({ embeds: [revealEmbed] });

        gameState.currentRoundIndex++;

        // Chờ 3 giây rồi sang vòng mới
        setTimeout(() => this.sendNextRound(guildId), 3000);
    }

    async endGame(guildId) {
        const gameState = this.activeGames.get(guildId);
        if (!gameState) return;

        const channel = await global.discordClient.channels.fetch(gameState.channelId);
        
        // Sắp xếp người chơi theo điểm và thời gian
        const sortedScores = [...gameState.scores.entries()].sort(([, a], [, b]) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.totalTime - b.totalTime;
        });

        let scoreBoard = sortedScores.map(([userId, data], index) => 
            `${index + 1}. **${data.name}**: ${data.score} điểm (Thời gian: \`${(data.totalTime / 1000).toFixed(2)}s\`)`
        ).join('\n');

        const winnerTag = sortedScores.length > 0 ? `👑 Nhà vô địch: **${sortedScores[0][1].name}**!` : 'Không có ai ghi điểm trong game này.';

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🏆 Game Đã Kết Thúc!')
            .setDescription(`Bảng xếp hạng cuối cùng:\n\n${scoreBoard || 'Chưa có ai tham gia.'}\n\n${winnerTag}`)
            .setTimestamp();
        await channel.send({ embeds: [embed] });

        this.activeGames.delete(guildId);
    }
}

module.exports = new CatchTheWordService();