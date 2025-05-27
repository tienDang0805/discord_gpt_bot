const discordClient = require('../config/discordClient');

async function isReplyingToBot(message) {
  try {
    const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
    return referencedMessage.author.id === discordClient.user.id;
  } catch {
    return false;
  }
}

module.exports = {
  isReplyingToBot
};