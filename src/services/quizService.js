// quizService.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GptChatService = require('./gptChatService'); // Import GptChatService

class QuizService {
    constructor() {
        
        this.activeQuizzes = new Map();
      
        this.gptChatService = GptChatService; // Sử dụng instance đã có
        this.DEFAULT_QUESTION_TIME_LIMIT_MS = 15 * 1000; // Mặc định 15 giây
    }

    /**
     * Kiểm tra xem có quiz nào đang hoạt động trong guild này không.
     * @param {string} guildId ID của guild.
     * @returns {boolean} True nếu có quiz đang hoạt động, ngược lại là False.
     */
    isQuizActive(guildId) {
        return this.activeQuizzes.has(guildId) && this.activeQuizzes.get(guildId).isActive;
    }

    /**
     * Bắt đầu một trò chơi quiz mới.
     * @param {string} guildId ID của guild.
     * @param {string} channelId ID của kênh chat.
     * @param {string} creatorId ID của người tạo quiz.
     * @param {number} numQuestions Số lượng câu hỏi.
     * @param {string} topic Chủ đề của quiz.
     * @param {number} timeLimitSeconds Thời gian giới hạn cho mỗi câu hỏi (giây).
     * @param {string} difficulty Độ khó của quiz (Dễ, Trung bình, Khó, Địa ngục).
     * @param {string} tone Giọng văn của câu hỏi (Hài hước, Nghiêm túc, Trung tính,...) // THÊM DOC VÀO ĐÂY
     * @returns {object} Kết quả của việc bắt đầu quiz.
     */
    async startQuiz(guildId, channelId, creatorId, numQuestions, topic, timeLimitSeconds, difficulty, tone) { // THÊM 'tone' VÀO ĐÂY
        if (this.isQuizActive(guildId)) {
            return { success: false, message: '❌ Hiện đang có một trò đố vui đang diễn ra trong server này.' };
        }

        const actualTimeLimitMs = (timeLimitSeconds || this.DEFAULT_QUESTION_TIME_LIMIT_MS / 1000) * 1000; // Chuyển đổi sang ms
        const finalDifficulty = difficulty || 'Trung bình'; // Đảm bảo có giá trị mặc định
        const finalTone = tone || 'Trung tính'; // Đảm bảo có giá trị mặc định

        this.activeQuizzes.set(guildId, {
            isActive: true,
            creatorId: creatorId,
            channelId: channelId,
            currentQuestionIndex: 0,
            questions: [],
            scores: {}, // { 'userId': { score: number, totalTime: number } }
            messageId: null, // ID của tin nhắn câu hỏi hiện tại để cập nhật/xóa
            topic: topic,
            numQuestions: numQuestions,
            questionTimer: null, // Timer cho câu hỏi hiện tại (setTimeout)
            questionStartTime: 0, // Thời điểm câu hỏi được gửi
            answeredUsers: new Set(), // Lưu trữ ID người dùng đã trả lời câu hỏi hiện tại (để chỉ trả lời 1 lần)
            correctlyAnsweredUsers: new Set(), // Lưu trữ ID người dùng đã trả lời đúng câu hỏi hiện tại
            timeLimit: actualTimeLimitMs, // Thời gian giới hạn cho mỗi câu (ms)
            countdownInterval: null, // Interval cho bộ đếm ngược (setInterval)
            questionMessage: null, // Đối tượng tin nhắn câu hỏi để chỉnh sửa
            difficulty: finalDifficulty, // Lưu độ khó, mặc định Trung bình
            tone: finalTone, // LƯU GIỌNG VĂN VÀO TRẠNG THÁI QUIZ
        });

        const quizState = this.activeQuizzes.get(guildId);

        try {
            // Gọi AI để tạo câu hỏi, truyền thêm độ khó VÀ GIỌNG VĂN
            const quizData = await this.gptChatService.generateQuizQuestions(numQuestions, topic, quizState.difficulty, quizState.tone);
            if (!quizData || quizData.length === 0) {
                this.activeQuizzes.delete(guildId); // Xóa trạng thái quiz nếu không tạo được câu hỏi
                return { success: false, message: '❌ Không thể tạo câu hỏi cho chủ đề này hoặc độ khó này. Vui lòng thử chủ đề/độ khó khác.' };
            }

            quizState.questions = quizData;
            
            // Gửi câu hỏi đầu tiên
            await this.sendNextQuestion(guildId);

            return { 
                success: true, 
                // CẬP NHẬT TIN NHẮN BẮT ĐẦU QUIZ ĐỂ HIỂN THỊ GIỌNG VĂN
                message: `🎉 **Racoon Quiz** về chủ đề **${topic}** (Độ khó: **${quizState.difficulty}**, Giọng văn: **${quizState.tone}**) với ${numQuestions} câu hỏi đã bắt đầu! Mỗi câu có **${quizState.timeLimit / 1000} giây** để trả lời!` 
            };

        } catch (error) {
            console.error('Lỗi khi tạo quiz:', error);
            this.activeQuizzes.delete(guildId); // Xóa trạng thái quiz nếu có lỗi
            return { success: false, message: '❌ Đã xảy ra lỗi khi tạo quiz. Vui lòng thử lại sau.' };
        }
    }

    /**
     * Gửi câu hỏi tiếp theo hoặc kết thúc quiz.
     * @param {string} guildId ID của guild.
     */
    async sendNextQuestion(guildId) {
        const quizState = this.activeQuizzes.get(guildId);
        if (!quizState || !quizState.isActive) return;

        const channel = await global.discordClient.channels.fetch(quizState.channelId);
        if (!channel) {
            console.error(`Kênh ${quizState.channelId} không tìm thấy.`);
            this.activeQuizzes.delete(guildId);
            return;
        }

        // Xóa tin nhắn câu hỏi cũ nếu có
        if (quizState.messageId) {
            try {
                const oldMessage = await channel.messages.fetch(quizState.messageId);
                await oldMessage.delete();
            } catch (error) {
                console.warn(`Không thể xóa tin nhắn cũ ${quizState.messageId}:`, error.message);
            }
        }
        
        // Clear previous timers/intervals if any
        if (quizState.questionTimer) {
            clearTimeout(quizState.questionTimer);
            quizState.questionTimer = null;
        }
        if (quizState.countdownInterval) {
            clearInterval(quizState.countdownInterval);
            quizState.countdownInterval = null;
        }

        quizState.answeredUsers.clear(); // Reset danh sách người đã trả lời cho câu hỏi mới
        quizState.correctlyAnsweredUsers.clear(); // Reset danh sách người đã trả lời đúng cho câu hỏi mới

        if (quizState.currentQuestionIndex < quizState.questions.length) {
            const questionData = quizState.questions[quizState.currentQuestionIndex];
            
            const initialEmbed = new EmbedBuilder()
                .setColor(0x0099FF) // Màu xanh dương cho câu hỏi
                .setTitle(`❓ Câu hỏi ${quizState.currentQuestionIndex + 1}/${quizState.questions.length}: ${questionData.question}`)
                .setDescription(`Chọn câu trả lời đúng dưới đây:\n\n**⏱️ Thời gian còn lại: \`${quizState.timeLimit / 1000} giây\`**`)
                .setTimestamp();

            const buttons = questionData.answers.map((answer, index) => {
                let buttonLabel = `${String.fromCharCode(65 + index)}. ${answer}`;
                if (buttonLabel.length > 80) {
                    buttonLabel = buttonLabel.substring(0, 77) + '...';
                }
                return new ButtonBuilder()
                    .setCustomId(`quiz_answer_${index}`)
                    .setLabel(buttonLabel)
                    .setStyle(ButtonStyle.Primary);
            });

            const row = new ActionRowBuilder().addComponents(buttons);

            const message = await channel.send({ embeds: [initialEmbed], components: [row] });
            quizState.questionMessage = message; // Lưu đối tượng tin nhắn
            quizState.messageId = message.id; // Lưu ID tin nhắn
            quizState.questionStartTime = Date.now(); // Ghi lại thời điểm bắt đầu câu hỏi

            // Bắt đầu bộ đếm ngược trên tin nhắn
            quizState.countdownInterval = setInterval(async () => {
                const elapsedTime = Date.now() - quizState.questionStartTime;
                let remainingTime = Math.ceil((quizState.timeLimit - elapsedTime) / 1000);

                if (remainingTime < 0) remainingTime = 0; // Đảm bảo không hiển thị số âm

                let embedColor = 0x0099FF; // Mặc định xanh dương
                if (remainingTime <= 5) {
                    embedColor = 0xFF0000; // Đỏ khi còn 5 giây trở xuống
                } else if (remainingTime <= 10) {
                    embedColor = 0xFFA500; // Cam khi còn 10 giây trở xuống
                }

                const updatedEmbed = EmbedBuilder.from(initialEmbed) // Clone embed để chỉnh sửa
                    .setDescription(`Chọn câu trả lời đúng dưới đây:\n\n**⏱️ Thời gian còn lại: \`${remainingTime} giây\`**`)
                    .setColor(embedColor);
                
                try {
                    await quizState.questionMessage.edit({ embeds: [updatedEmbed] });
                } catch (editError) {
                    console.error('Lỗi khi cập nhật bộ đếm ngược:', editError.message);
                    clearInterval(quizState.countdownInterval); // Dừng interval nếu không edit được
                }

            }, 1000); // Cập nhật mỗi giây

            // Đặt timer cho câu hỏi (khi hết giờ)
            quizState.questionTimer = setTimeout(() => {
                clearInterval(quizState.countdownInterval); // Dừng bộ đếm ngược
                this.revealAnswerAndNextQuestion(guildId);
            }, quizState.timeLimit);

            quizState.currentQuestionIndex++; // Tăng chỉ số câu hỏi
        } else {
            // Kết thúc quiz
            await this.endQuiz(guildId);
        }
    }

    /**
     * Xử lý khi người chơi gửi câu trả lời.
     * @param {string} guildId ID của guild.
     * @param {string} userId ID của người dùng.
     * @param {number} answerIndex Chỉ số của câu trả lời đã chọn.
     * @returns {object} Kết quả của việc gửi câu trả lời.
     */
    async submitAnswer(guildId, userId, answerIndex) {
        const quizState = this.activeQuizzes.get(guildId);
        if (!quizState || !quizState.isActive) {
            return { success: false, message: '❌ Không có trò đố vui nào đang diễn ra.' };
        }
        
        // Kiểm tra xem người dùng đã trả lời câu này chưa
        if (quizState.answeredUsers.has(userId)) {
            return { success: false, message: 'Bạn chỉ được trả lời một lần cho mỗi câu hỏi.' };
        }

        const currentQuestionData = quizState.questions[quizState.currentQuestionIndex - 1]; // -1 vì đã tăng index ở sendNextQuestion
        if (!currentQuestionData) {
            return { success: false, message: '❌ Không tìm thấy câu hỏi hiện tại.' };
        }

        const channel = await global.discordClient.channels.fetch(quizState.channelId);
        const user = await global.discordClient.users.fetch(userId);

        // Đánh dấu người dùng đã trả lời câu hỏi này
        quizState.answeredUsers.add(userId);
        await channel.send(`➡️ **${user.tag}** đã trả lời câu hỏi.`);

        if (answerIndex === currentQuestionData.correctAnswerIndex) {
            // Cộng điểm và ghi lại thời gian nếu trả lời đúng
            const timeTaken = Date.now() - quizState.questionStartTime;
            
            if (!quizState.scores[userId]) {
                quizState.scores[userId] = { score: 0, totalTime: 0 };
            }
            quizState.scores[userId].score += 1;
            quizState.scores[userId].totalTime += timeTaken;
            quizState.correctlyAnsweredUsers.add(userId); // Thêm vào danh sách người trả lời đúng
            
            return { success: true };
        } else {
            return { success: false, message: 'Câu trả lời của bạn không đúng.' };
        }
    }

    /**
     * Tiết lộ đáp án đúng và chuyển sang câu hỏi tiếp theo.
     * @param {string} guildId ID của guild.
     */
    async revealAnswerAndNextQuestion(guildId) {
        const quizState = this.activeQuizzes.get(guildId);
        if (!quizState || !quizState.isActive) return;

        const channel = await global.discordClient.channels.fetch(quizState.channelId);
        if (!channel) {
            console.error(`Kênh ${quizState.channelId} không tìm thấy khi tiết lộ đáp án.`);
            this.activeQuizzes.delete(guildId);
            return;
        }

        // Đảm bảo dừng bộ đếm ngược khi hết giờ
        if (quizState.countdownInterval) {
            clearInterval(quizState.countdownInterval);
            quizState.countdownInterval = null;
        }
        if (quizState.questionTimer) {
            clearTimeout(quizState.questionTimer);
            quizState.questionTimer = null;
        }

        // Vô hiệu hóa các nút trên tin nhắn câu hỏi cũ
        if (quizState.questionMessage) {
            try {
                const disabledButtons = quizState.questionMessage.components[0].components.map(button => 
                    ButtonBuilder.from(button).setDisabled(true)
                );
                const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);
                await quizState.questionMessage.edit({ components: [disabledRow] });
            } catch (error) {
                console.warn('Không thể vô hiệu hóa nút trên tin nhắn cũ:', error.message);
            }
        }

        const currentQuestionData = quizState.questions[quizState.currentQuestionIndex - 1];
        if (!currentQuestionData) {
            console.error('Không tìm thấy câu hỏi để tiết lộ đáp án.');
            this.activeQuizzes.delete(guildId);
            return;
        }

        const correctAnswerText = currentQuestionData.answers[currentQuestionData.correctAnswerIndex];

        let revealMessage = `⏰ **HẾT GIỜ!**\nĐáp án đúng là: **\`${String.fromCharCode(65 + currentQuestionData.correctAnswerIndex)}. ${correctAnswerText}\`**\n\n`;
        
        if (quizState.correctlyAnsweredUsers.size > 0) {
            revealMessage += '✅ Những người đã trả lời đúng:\n';
            for (const userId of quizState.correctlyAnsweredUsers) {
                const user = await global.discordClient.users.fetch(userId);
                revealMessage += `  - ${user.tag}\n`;
            }
        } else {
            revealMessage += '❌ Không có ai trả lời đúng câu hỏi này.\n';
        }

        // Thông báo những người trả lời sai
        const allAnsweredUsers = Array.from(quizState.answeredUsers);
        const incorrectAnsweredUsers = allAnsweredUsers.filter(userId => !quizState.correctlyAnsweredUsers.has(userId));
        
        if (incorrectAnsweredUsers.length > 0) {
            revealMessage += '\n💔 Những người đã trả lời sai:\n';
            for (const userId of incorrectAnsweredUsers) {
                const user = await global.discordClient.users.fetch(userId);
                revealMessage += `  - ${user.tag}\n`;
            }
        }

        const revealEmbed = new EmbedBuilder()
            .setColor(0x32CD32) // Màu xanh lá cây cho đáp án đúng
            .setTitle('Kết quả câu hỏi vừa rồi!')
            .setDescription(revealMessage)
            .setTimestamp();

        await channel.send({ embeds: [revealEmbed] });

        // Chuyển sang câu hỏi tiếp theo sau một khoảng thời gian ngắn
        setTimeout(() => this.sendNextQuestion(guildId), 5000); // 5 giây để người chơi đọc đáp án
    }

    /**
     * Hủy bỏ trò chơi quiz hiện tại.
     * @param {string} guildId ID của guild.
     * @param {string} userId ID của người dùng yêu cầu hủy.
     * @returns {object} Kết quả của việc hủy quiz.
     */
    async cancelQuiz(guildId, userId) {
        const quizState = this.activeQuizzes.get(guildId);

        if (!quizState || !quizState.isActive) {
            return { success: false, message: '❌ Không có trò đố vui nào đang diễn ra để hủy.' };
        }

        // Chỉ người tạo hoặc admin mới có thể hủy
        if (quizState.creatorId !== userId) {
            // Có thể thêm kiểm tra quyền admin ở đây nếu muốn
            return { success: false, message: 'Bạn không phải là người tạo quiz này nên không thể hủy.' };
        }

        // Clear timer và interval trước khi xóa trạng thái
        if (quizState.questionTimer) {
            clearTimeout(quizState.questionTimer);
            quizState.questionTimer = null;
        }
        if (quizState.countdownInterval) {
            clearInterval(quizState.countdownInterval);
            quizState.countdownInterval = null;
        }

        // Vô hiệu hóa các nút trên tin nhắn câu hỏi cũ nếu có
        if (quizState.questionMessage) {
            try {
                const disabledButtons = quizState.questionMessage.components[0].components.map(button => 
                    ButtonBuilder.from(button).setDisabled(true)
                );
                const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);
                await quizState.questionMessage.edit({ components: [disabledRow] });
            } catch (error) {
                console.warn('Không thể vô hiệu hóa nút trên tin nhắn cũ khi hủy quiz:', error.message);
            }
        }

        this.activeQuizzes.delete(guildId); // Xóa trạng thái quiz

        const channel = await global.discordClient.channels.fetch(quizState.channelId);
        if (channel) {
            // Xóa tin nhắn câu hỏi hiện tại
            if (quizState.messageId) {
                try {
                    const oldMessage = await channel.messages.fetch(quizState.messageId);
                    await oldMessage.delete();
                } catch (error) {
                    console.warn(`Không thể xóa tin nhắn cũ khi hủy quiz ${quizState.messageId}:`, error.message);
                }
            }
            await channel.send('🛑 **Racoon Quiz** đã bị hủy bởi người tạo.');
        }

        return { success: true, message: '✅ Racoon Quiz đã được hủy thành công.' };
    }

    /**
     * Kết thúc trò chơi quiz và hiển thị bảng điểm.
     * @param {string} guildId ID của guild.
     */
    async endQuiz(guildId) {
        const quizState = this.activeQuizzes.get(guildId);
        if (!quizState) return;

        const channel = await global.discordClient.channels.fetch(quizState.channelId);
        if (!channel) {
            console.error(`Kênh ${quizState.channelId} không tìm thấy khi kết thúc quiz.`);
            this.activeQuizzes.delete(guildId);
            return;
        }

        // Xóa tin nhắn câu hỏi cuối cùng
        if (quizState.messageId) {
            try {
                const oldMessage = await channel.messages.fetch(quizState.messageId);
                await oldMessage.delete();
            } catch (error) {
                console.warn(`Không thể xóa tin nhắn câu hỏi cuối cùng ${quizState.messageId}:`, error.message);
            }
        }

        const scores = quizState.scores;
        // Sắp xếp điểm: ưu tiên điểm cao hơn, nếu điểm bằng nhau thì ưu tiên tổng thời gian ít hơn
        const sortedScores = Object.entries(scores).sort(([userIdA, dataA], [userIdB, dataB]) => {
            if (dataB.score !== dataA.score) {
                return dataB.score - dataA.score; // Sắp xếp theo điểm giảm dần
            }
            return dataA.totalTime - dataB.totalTime; // Nếu điểm bằng nhau, sắp xếp theo thời gian tăng dần
        });

        let scoreBoard = '';
        let winnerTag = 'Chưa có người chiến thắng.';

        if (sortedScores.length > 0) {
            for (let i = 0; i < sortedScores.length; i++) {
                const [userId, data] = sortedScores[i];
                const user = await global.discordClient.users.fetch(userId);
                scoreBoard += `${i + 1}. **${user.tag}**: ${data.score} điểm (Thời gian: \`${(data.totalTime / 1000).toFixed(2)}s\`)\n`;
            }
            // Người chiến thắng là người có điểm cao nhất và thời gian nhanh nhất
            const winnerId = sortedScores[0][0];
            const winnerUser = await global.discordClient.users.fetch(winnerId);
            winnerTag = `👑 Người chiến thắng: **${winnerUser.tag}** với ${sortedScores[0][1].score} điểm và thời gian \`${(sortedScores[0][1].totalTime / 1000).toFixed(2)} giây\`!`;
        } else {
            scoreBoard = 'Chưa có ai ghi điểm trong quiz này.';
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFD700) // Màu vàng cho bảng điểm
            .setTitle('🏆 Racoon Quiz Đã Kết Thúc!')
            // CẬP NHẬT MÔ TẢ ĐỂ HIỂN THỊ GIỌNG VĂN
            .setDescription(`Bảng điểm cuối cùng cho chủ đề **${quizState.topic}** (Độ khó: **${quizState.difficulty}**, Giọng văn: **${quizState.tone}**):\n\n${scoreBoard}\n\n${winnerTag}`)
            .setTimestamp();

        await channel.send({ embeds: [embed] });

        this.activeQuizzes.delete(guildId); // Xóa trạng thái quiz sau khi kết thúc
    }
}

// LƯU Ý QUAN TRỌNG:
// Nếu GptChatService là một module export một instance (module.exports = new GptChatService();)
// thì dòng này sẽ là: module.exports = new QuizService(GptChatService);
// Nếu GptChatService là một class và bạn muốn tạo một instance mới ở đây, thì:
module.exports = new QuizService();