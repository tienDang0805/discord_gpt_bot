// pkGameService.js
const GptChatService = require('./gptChatService');

class PKGameService {
    constructor() {
        this.gameSession = null;
        this.gptChatService = GptChatService;
    }

    isGameActive() {
        return this.gameSession !== null && this.gameSession.status !== "ended";
    }

    startNewGame() {
        if (this.isGameActive()) {
            return { success: false, message: "❌ Hiện đang có một trận đấu PK đang diễn ra. Vui lòng đợi!" };
        }
        this.gameSession = {
            players: [],
            status: "waiting", // "waiting", "in-progress", "ended"
            turn: 0,
            log: []
        };
        return { success: true, message: "Một trận đấu PK mới đã được tạo! Hai người chơi dùng `!joinPK` để tham gia." };
    }

    joinGame(player) {
        if (!this.gameSession || this.gameSession.status !== "waiting") {
            return { success: false, message: "❌ Không có trận đấu nào đang chờ hoặc đã quá 2 người rồi." };
        }
        if (this.gameSession.players.length >= 2) {
            return { success: false, message: "❌ Đã có đủ 2 người chơi rồi." };
        }
        if (this.gameSession.players.some(p => p.id === player.id)) {
            return { success: false, message: "❌ Bạn đã tham gia rồi." };
        }

        const newPlayer = {
            id: player.id,
            name: player.globalName || player.username,
            hp: 100,
            maxHp: 100
        };
        this.gameSession.players.push(newPlayer);

        if (this.gameSession.players.length === 2) {
            this.gameSession.status = "in-progress";
                this.gameSession.turn = Math.floor(Math.random() * 2);
            const player1 = this.gameSession.players[0];
            const player2 = this.gameSession.players[1];
            return { success: true, message: `Trận đấu bắt đầu giữa ${player1.name} và ${player2.name}! Lượt của **${this.gameSession.players[this.gameSession.turn].name}**.` };
        }
        return { success: true, message: `${player.globalName || player.username} đã tham gia trận đấu! Cần thêm ${2 - this.gameSession.players.length} người nữa.` };
    }

    async processTurn(player, audioAttachment) {
        console.log("audioAttachment",audioAttachment)
        if (!this.isGameActive()) {
            return { success: false, message: "❌ Không có trận đấu nào đang diễn ra." };
        }

        const currentPlayerTurn = this.gameSession.players[this.gameSession.turn];
        if (player.id !== currentPlayerTurn.id) {
            return { success: false, message: `❌ Chưa đến lượt của bạn, ${player.globalName || player.username}. Lượt của **${currentPlayerTurn.name}**.` };
        }

        const opponentPlayer = this.gameSession.players[(this.gameSession.turn + 1) % 2];
        
        try {
            const audioTranscript = await this.gptChatService.AudioToTextAI(audioAttachment.url);
            console.log("audioTranscript", audioTranscript);
            
            const gamePrompt = `
            Bối cảnh: Trận đấu PK giữa ${currentPlayerTurn.name} (HP: ${currentPlayerTurn.hp}/${currentPlayerTurn.maxHp}) và ${opponentPlayer.name} (HP: ${opponentPlayer.hp}/${opponentPlayer.maxHp}).
            Lượt của ${currentPlayerTurn.name}.
            Hành động của ${currentPlayerTurn.name} (phân tích từ file audio): "${audioTranscript}".
            Hãy tạo một kịch bản sinh động mô tả hành động này, tính toán sát thương hợp lý (ví dụ: 10-30 HP) và mô tả phản ứng của đối thủ.
            Kết quả phải trả về dưới dạng JSON:
            {
                "description": "Mô tả sinh động về đòn đánh.",
                "damage": "Số sát thương gây ra."
            }`;
            
            const aiResponse = await this.gptChatService.generatePKResponse(gamePrompt);
            const result = JSON.parse(aiResponse);
            
            const damage = parseInt(result.damage);
            if (isNaN(damage)) {
                 throw new Error("AI response did not contain a valid damage number.");
            }
            
            opponentPlayer.hp -= damage;
            if (opponentPlayer.hp < 0) opponentPlayer.hp = 0;

            this.gameSession.log.push(result.description);
            
            this.gameSession.turn = (this.gameSession.turn + 1) % 2;
            
            const turnMessage = `
            **--- Lượt đấu ---**
            ${result.description}
            ${currentPlayerTurn.name}: ${currentPlayerTurn.hp}/${currentPlayerTurn.maxHp} HP
            ${opponentPlayer.name}: ${opponentPlayer.hp}/${opponentPlayer.maxHp} HP
            ---
            Lượt tiếp theo là của **${this.gameSession.players[this.gameSession.turn].name}**.`;

            if (opponentPlayer.hp <= 0) {
                // Sửa lỗi: return kết quả của endGame
                return this.endGame(currentPlayerTurn, opponentPlayer, turnMessage);
            }

            return { success: true, message: turnMessage };

        } catch (error) {
            console.error('Lỗi khi xử lý lượt chơi PK:', error);
            // Sửa lỗi: return kết quả của endGame nếu có lỗi
            return this.endGame(null, null, null);
        }
    }
    
    endGame(winner, loser, finalTurnMessage) {
        if (!this.gameSession) return { success: false, message: "Không có trận đấu nào đang diễn ra." };
        
        this.gameSession.status = "ended";
        
        let finalMessage = "🎉 **Trận đấu PK đã kết thúc!**\n";
        finalMessage += finalTurnMessage ? finalTurnMessage + '\n' : '';

        if (winner && loser) {
            finalMessage += `Chúc mừng **${winner.name}** đã đánh bại **${loser.name}**!`;
        } else if (!winner && !loser && !finalTurnMessage) {
            finalMessage = "Trận đấu đã kết thúc do lỗi không mong muốn.";
        }
        
        this.gameSession = null; 
        
        return { success: true, message: finalMessage };
    }
}

module.exports = new PKGameService();