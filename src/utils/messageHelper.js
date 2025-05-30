/**
 * Gửi tin nhắn dài dưới dạng các chunk (đoạn) nhỏ
 * @param {Function} replyMethod - Phương thức gửi tin nhắn (reply, editReply, channel.send...)
 * @param {string} content - Nội dung cần gửi
 * @param {Object} [options] - Tuỳ chọn khi gửi tin nhắn
 */
async function sendLongMessage(replyMethod, content, options = {}) {
    const maxLength = 1900; // Giới hạn ký tự của Discord
    if (content.length <= maxLength) {
        return await replyMethod({ content, ...options });
    }

    const chunks = [];
    for (let i = 0; i < content.length; i += maxLength) {
        chunks.push(content.substring(i, i + maxLength));
    }
    
    // Gửi chunk đầu tiên với reply
    const firstChunkOptions = {
        ...options,
        content: chunks[0]
    };
    const firstMessage = await replyMethod(firstChunkOptions);

    // Lấy channel từ tin nhắn đầu tiên để gửi các chunk tiếp theo
    const channel = firstMessage.channel;

    // Gửi các chunk tiếp theo mà không reply
    for (let i = 1; i < chunks.length; i++) {
        await channel.send(chunks[i]);
    }   
}

module.exports = { sendLongMessage };