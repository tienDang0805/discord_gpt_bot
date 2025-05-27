const GptChatService = require('../services/gptChatService');
const { isReplyingToBot } = require('../utils/helpers');
const discordClient = require('../config/discordClient');

// Khởi tạo instance
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
      const response = await gptChatService.generateResponse(message);
      await message.reply({
        content: response,
        allowedMentions: { repliedUser: false }
      });
    } catch (error) {
      console.error('GPT Chat Error:', error);
      await message.reply('Bot đang bị lỗi, thử lại sau nhé!');
    }
  }
};