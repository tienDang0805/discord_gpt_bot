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

    async startGame(guildId, channelId, creatorId, numRounds, timeLimitSeconds, difficulty) {
        if (this.isGameActive(guildId)) {
            return { success: false, message: '❌ Đã có một game đang diễn ra rồi.' };
        }

        const timeLimitMs = timeLimitSeconds * 1000;

        this.activeGames.set(guildId, {
            channelId,
            creatorId,
            currentRoundIndex: 0,
            rounds: [],
            scores: new Map(), // { userId: { name: string, score: number, totalTime: number } }
            numRounds,
            timeLimit: timeLimitMs,
            difficulty: difficulty || 'Trung bình',
            roundMessage: null,
            roundTimer: null,
            roundStartTime: 0,
            currentRoundAnswers: new Map(), // { userId: { answerIndex: number, timeTaken: number, userName: string } }
        });

        const gameState = this.activeGames.get(guildId);

        try {
            const roundsData = await GptChatService.generateCatchTheWordRounds(numRounds, gameState.difficulty);
            if (!roundsData || roundsData.length === 0) {
                this.activeGames.delete(guildId);
                return { success: false, message: '❌ Bot không thể nghĩ ra câu đố nào với độ khó này. Vui lòng thử lại!' };
            }
            gameState.rounds = roundsData;
            
            await this.sendNextRound(guildId);

            return { 
                success: true, 
                message: `🎉 **Game Đuổi Hình Bắt Chữ** với **${numRounds}** vòng (Độ khó: **${gameState.difficulty}**) đã bắt đầu! Mỗi vòng có **${timeLimitSeconds} giây** để trả lời.` 
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

        if (gameState.currentRoundIndex >= gameState.numRounds) {
            await this.endGame(guildId);
            return;
        }

        gameState.currentRoundAnswers.clear(); // Xóa câu trả lời của vòng trước
        const channel = await global.discordClient.channels.fetch(gameState.channelId);
        const roundData = gameState.rounds[gameState.currentRoundIndex];

        const waitingMessage = await channel.send(`🧠 **Vòng ${gameState.currentRoundIndex + 1}/${gameState.numRounds}**: Bot đang vẽ hình, xin chờ...`);

        try {
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
                    .setLabel(option.substring(0, 80)) // Cắt bớt nếu quá dài
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
            gameState.roundStartTime = Date.now();
            gameState.roundTimer = setTimeout(() => this.revealAnswer(guildId), gameState.timeLimit);

        } catch (error) {
            console.error("Lỗi khi gửi vòng chơi:", error);
            await waitingMessage.edit('❌ Gặp lỗi khi tạo hình ảnh. Game sẽ tự hủy.');
            this.activeGames.delete(guildId);
        }
    }
     
    async submitAnswer(guildId, userId, userName, answerIndex) {
        const gameState = this.activeGames.get(guildId);
        // Cho phép trả lời nếu game tồn tại và người dùng chưa trả lời vòng này
        if (!gameState || gameState.currentRoundAnswers.has(userId)) return { answered: true };

        const timeTaken = Date.now() - gameState.roundStartTime;
        gameState.currentRoundAnswers.set(userId, { answerIndex, timeTaken, userName });
        return { answered: false };
    }

    async revealAnswer(guildId) {
        const gameState = this.activeGames.get(guildId);
        if (!gameState) return;

        clearTimeout(gameState.roundTimer); // Dừng bộ đếm giờ
        const channel = await global.discordClient.channels.fetch(gameState.channelId);
        const currentRound = gameState.rounds[gameState.currentRoundIndex];
        const correctAnswerText = currentRound.options[currentRound.correctAnswerIndex];

        // Vô hiệu hóa các nút bấm
        if (gameState.roundMessage) {
            try {
                const disabledRow = new ActionRowBuilder().addComponents(
                    gameState.roundMessage.components[0].components.map(button => ButtonBuilder.from(button).setDisabled(true))
                );
                await gameState.roundMessage.edit({ components: [disabledRow] });
            } catch (e) { console.warn("Không thể disable nút của vòng trước."); }
        }

        // Lọc và sắp xếp người trả lời đúng
        const correctUsers = [];
        for (const [userId, answerData] of gameState.currentRoundAnswers.entries()) {
            if (answerData.answerIndex === currentRound.correctAnswerIndex) {
                correctUsers.push({ userId, ...answerData });
            }
        }
        correctUsers.sort((a, b) => a.timeTaken - b.timeTaken);

        // Tính và cộng điểm
        correctUsers.forEach((user, index) => {
            const points = 100 - (index * 15); // Ví dụ: 100, 85, 70,...
            const finalPoints = points > 25 ? points : 25; // Điểm tối thiểu là 25

            const currentUserScore = gameState.scores.get(user.userId) || { name: user.userName, score: 0, totalTime: 0 };
            currentUserScore.score += finalPoints;
            currentUserScore.totalTime += user.timeTaken;
            gameState.scores.set(user.userId, currentUserScore);
        });

        // Tạo tin nhắn thông báo kết quả
        let revealDescription = `⏰ **HẾT GIỜ!**\nĐáp án đúng là: **${correctAnswerText}**\n\n`;
        if (correctUsers.length > 0) {
            revealDescription += '✅ **Những người trả lời đúng:**\n' + correctUsers.map((u, i) => {
                const points = 100 - (i * 15);
                const finalPoints = points > 25 ? points : 25;
                return `${i + 1}. **${u.userName}** (+${finalPoints} điểm, \`${(u.timeTaken / 1000).toFixed(2)}s\`)`;
            }).join('\n');
        } else {
            revealDescription += '❌ Không có ai trả lời đúng câu hỏi này.';
        }

        const revealEmbed = new EmbedBuilder()
            .setColor(0x32CD32)
            .setTitle(`Đáp án vòng ${gameState.currentRoundIndex + 1}`)
            .setDescription(revealDescription)
            .setTimestamp();
        await channel.send({ embeds: [revealEmbed] });

        gameState.currentRoundIndex++;
        setTimeout(() => this.sendNextRound(guildId), 5000); // Chờ 5 giây rồi sang vòng mới
    }

    async endGame(guildId) {
        const gameState = this.activeGames.get(guildId);
        if (!gameState) return;

        const channel = await global.discordClient.channels.fetch(gameState.channelId);
        
        const sortedScores = [...gameState.scores.entries()].sort(([, a], [, b]) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.totalTime - b.totalTime;
        });

        const scoreBoard = sortedScores.map(([userId, data], index) => 
            `${index + 1}. **${data.name}**: ${data.score} điểm (Tổng thời gian: \`${(data.totalTime / 1000).toFixed(2)}s\`)`
        ).join('\n') || 'Chưa có ai ghi điểm.';

        const winnerTag = sortedScores.length > 0 ? `👑 Nhà vô địch: **${sortedScores[0][1].name}**!` : 'Không có nhà vô địch trong game này.';

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🏆 Game Đã Kết Thúc!')
            .setDescription(`Bảng xếp hạng cuối cùng (Độ khó: **${gameState.difficulty}**):\n\n${scoreBoard}\n\n${winnerTag}`)
            .setTimestamp();
        await channel.send({ embeds: [embed] });

        this.activeGames.delete(guildId);
    }
}

module.exports = new CatchTheWordService();