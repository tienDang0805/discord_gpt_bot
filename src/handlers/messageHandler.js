const GptChatService = require('../services/gptChatService');
const { isReplyingToBot } = require('../utils/helpers');
const discordClient = require('../config/discordClient');
const { sendLongMessage } = require('../utils/messageHelper');

const gptChatService = new GptChatService();

module.exports = async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(discordClient.user) || 
                       (message.reference && await isReplyingToBot(message));

    if (message.content === 'hi') {
        return message.reply('hi cái địt mẹ mày');
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
};