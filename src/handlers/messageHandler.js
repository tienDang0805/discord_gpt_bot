const GptChatService = require('../services/gptChatService');
const { isReplyingToBot } = require('../utils/helpers');
const discordClient = require('../config/discordClient');
const { sendLongMessage } = require('../utils/messageHelper');
const { createAudioPlayer, createAudioResource , StreamType, demuxProbe, joinVoiceChannel, NoSubscriberBehavior, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice')
const play = require('play-dl')
const gptChatService = new GptChatService();
const fs = require('fs');

module.exports = async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(discordClient.user) || 
                       (message.reference && await isReplyingToBot(message));

    if (message.content === 'hi') {
        return message.reply('hi cái địt mẹ mày');
    }
    if (message.content === 'clearLog') {
        gptChatService.clearHistory();
        return message.reply('Đã clear history');
    }
    if (message.content.startsWith('!audio')) {
        try {
            const text = message.content.replace(/^!audio\s*/i, '').trim();
            if (!text) return message.reply("Please provide text after !audio command");
    
            await message.channel.sendTyping();
            
            // 1. Đầu tiên generate response như bình thường
            const response = await gptChatService.generateResponse({
                ...message,
                content: text // Chỉ gửi text không bao gồm lệnh !audio
            });
            
            // 2. Dùng response text để generate audio
            const result = await gptChatService.generateAudioWithContext(response);
            
            if (!result.success) {
                return message.reply(`Failed to generate audio: ${result.error}`);
            }
    
            // 3. Gửi cả text response và audio file
            await message.reply({
                content: `hi`,
                files: [result.filePath]
            });
    
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
                const response = await gptChatService.VideoToTextAI(
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
                const response = await gptChatService.ImageToTextAI(
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
            const response = await gptChatService.generateResponse(message);
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