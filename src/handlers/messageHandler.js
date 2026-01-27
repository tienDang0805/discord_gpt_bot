// file: messageHandler.js
const GptChatService = require('../services/gptChatService');
const { isReplyingToBot } = require('../utils/helpers');
const discordClient = require('../config/discordClient');
const { sendLongMessage } = require('../utils/messageHelper');
const { createAudioPlayer, createAudioResource , StreamType, demuxProbe, joinVoiceChannel, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice')
const play = require('play-dl')
const fs = require('fs');
const ADMIN_IDS = [process.env.ADMIN_ID]; 
const pkGameService = require('../services/PKGameService');
module.exports = async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(discordClient.user) || 
                       (message.reference && await isReplyingToBot(message));

    const TARGET_ADMIN_ID = process.env.ADMIN_ID;
    if (message.mentions.users.has(TARGET_ADMIN_ID) && !message.author.bot) {
        try {
            await message.channel.sendTyping();
            const replyContent = await GptChatService.generateAutoReply(message.content, message.author.username);
            return message.reply(replyContent);
        } catch (error) {
            console.error("Lỗi Auto-reply:", error);
        }
    }

    if (message.content === 'hi') {
        return message.reply('hi cái lồn má mày');
    }
     if (message.content.toLowerCase() === '!pkmom') {
        const result = pkGameService.startNewGame();
        // Sửa lỗi: Chỉ gửi thuộc tính 'message' từ đối tượng trả về /
        return message.reply(result.message);
    }

    // Lệnh để tham gia game
    if (message.content.toLowerCase() === '!joinpk') {
        const result = pkGameService.joinGame(message.author);
        // Sửa lỗi: Tương tự, chỉ gửi thuộc tính 'message'.
        return message.reply(result.message);
    }
    
    if (message.attachments.size > 0 && pkGameService.gameSession?.status === "in-progress") {
        const audioAttachment = message.attachments.find(att => att.contentType?.startsWith('audio/'));
        if (audioAttachment) {
            const result = await pkGameService.processTurn(message.author, audioAttachment);
            return message.reply(result.message);
        }
    }
    const lowerCaseContent = message.content.toLowerCase();
    const cleanedContent = message.content.replace(/^\s+|\s+$/g, '');
    const banPhraseRegex = /^th[iìj1]\s*\??$/i; 
    if (banPhraseRegex.test(cleanedContent)) {
        console.log("cặc")
        // Kiểm tra nếu người dùng là admin
        if (ADMIN_IDS.includes(message.author.id)) {
            console.log(`Admin ${message.author.tag} đã dùng "Thì?" nhưng được miễn ban.`);
            return; 
        }

        try {
            await message.member.timeout(360 * 1000, 'Sử dụng cụm từ cấm "Thì?"');
            
            return message.channel.send("Thì? con cặc mày bị ban tao là bố chúng mày chúng mày là con tao ý kiến cái lồn");
        } catch (error) {
            console.error(`Không thể ban ${message.author.tag} vì "Thì?":`, error);
            return message.channel.send("Tao định ban mày đó, nhưng có vẻ Discord không cho phép. Nhưng vẫn nhớ kỹ lời tao nói!");
        }
    }
    if (message.content === 'clearLog') {
        GptChatService.clearHistory();
        return message.reply('Đã clear history');
    }
    if (lowerCaseContent.includes('phep mau') || 
        lowerCaseContent.includes('phép màu') || 
        lowerCaseContent.includes('phepmau')) { 
        return message.reply('có cái lồn phép màu làm đi thằng mọi');
    }
    if (message.content.startsWith('!sum')) {
    const userId = message.author.id; 
    const loadingMsg = await message.reply("⏳ Đang lội page hóng chuyện, đợi tí...");

        try {
            const args = message.content.split(' ');
            let limit = parseInt(args[1]) || 50;
            if (limit > 100) limit = 100; // Cap lại tránh tốn token

            const fetchedMessages = await message.channel.messages.fetch({ limit: limit });

            const transcript = Array.from(fetchedMessages.values())
                .reverse() 
                .filter(m => !m.author.bot && !m.content.startsWith('!')) 
                .map(m => `${m.author.username}: ${m.content || "[Media]"}`)
                .join('\n');

            if (!transcript.trim()) {
                await loadingMsg.delete();
                return message.reply("❌ Không có gì để tóm tắt cả.");
            }

            const summaryResponse = await GptChatService.generateSummary(transcript, userId);

            await loadingMsg.delete();
            return await sendLongMessage(
                message.reply.bind(message),
                summaryResponse, 
                { allowedMentions: { repliedUser: false } }
            );

        } catch (error) {
            console.error("Lỗi Summary:", error);
            await loadingMsg.edit("❌ Bot bị lỗi khi đọc tin nhắn.");
            return;
        }
    }
    if (message.content.startsWith('!audio')) {
        try {
            const text = message.content.replace(/^!audio\s*/i, '').trim();
            if (!text) return message.reply("Please provide text after !audio command");
    
            await message.channel.sendTyping();
            
            // 1. Đầu tiên generate response như bình thường
            const response = await GptChatService.generateResponse({
                ...message,
                content: text // Chỉ gửi text không bao gồm lệnh !audio
            });
            
            // 2. Dùng response text để generate audio
            const result = await GptChatService.generateAudioWithContext(response);
            
            if (!result.success) {
                return message.reply(`Failed to generate audio: ${result.error}`);
            }
    
            // 3. Gửi cả text response và audio file
            await message.channel.send(`🤖 Đang tham gia kênh thoại và sẽ nói: "${text.substring(0, 100)}..."`); // Hiển thị 100 ký tự đầu của phản hồi

            // Optional: Play in voice channel
            if (message.member.voice.channel) {
                await playInVoiceChannel(message.member.voice.channel, result.filePath);
            }

            // Clean up temp file
            fs.unlink(result.filePath, (err) => {
                if (err) console.error("Error deleting temp audio file:", err);
            });
    
        } catch (error) {
            console.error("Audio command error:", error);
            await message.reply("An error occurred while processing your audio request");
        }
        return;
    }
    if (isMentioned || message.content.startsWith('!gpt')) {
        try {
            await message.channel.sendTyping();
            
            // Xử lý video
            const videoAttachment = message.attachments.find(att => 
                att.contentType?.startsWith('video/') || 
                ['mp4', 'webm', 'mov'].some(ext => att.url.toLowerCase().endsWith(ext))
            );
            
            if (videoAttachment) {
                const response = await GptChatService.VideoToTextAI(
                    videoAttachment.url,
                    message.content.replace(/<@!?\d+>/g, '').trim()
                );
                return await sendLongMessage(
                    message.reply.bind(message),
                    response,
                    { allowedMentions: { repliedUser: false } }
                );
            }
            
            // Xử lý ảnh
            const imageAttachment = message.attachments.find(att => 
                att.contentType?.startsWith('image/')
            );
            
            if (imageAttachment) {
                const response = await GptChatService.ImageToTextAI(
                    imageAttachment.url,
                    message.content.replace(/<@!?\d+>/g, '').trim()
                );
                return await sendLongMessage(
                    message.reply.bind(message),
                    response,
                    { allowedMentions: { repliedUser: false } }
                );
            }
            
            // Xử lý tin nhắn thường
            const userId = message.author.id; // 👈 Lấy ID người dùng
            const response = await GptChatService.generateResponse(message,userId);
            return await sendLongMessage(
                message.reply.bind(message),
                response,
                { allowedMentions: { repliedUser: false } }
            );
        } catch (error) {
            console.error('Processing Error:', error);
            let errorMessage = 'Bot đang bị lỗi, thử lại sau nhé!';
            
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType?.startsWith('video/')) {
                    errorMessage = `❌ Lỗi xử lý video: ${error.message}`;
                } else if (attachment.contentType?.startsWith('image/')) {
                    errorMessage = `❌ Lỗi xử lý ảnh: ${error.message}`;
                }
            }
            
            await message.reply(errorMessage);
        }
    }
    
    async function playInVoiceChannel(voiceChannel, filePath) {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });
        
        const resource = createAudioResource(filePath);
        const player = createAudioPlayer();
        
        player.play(resource);
        connection.subscribe(player);
        
        return new Promise((resolve) => {
            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
                resolve();
            });
        });
    }
};