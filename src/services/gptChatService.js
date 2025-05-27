const { escapeMarkdown } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { CHAT_HISTORY_FILE, GEMINI_CONFIG } = require('../config/constants');
const { GoogleGenerativeAI } = require("@google/generative-ai");

class GptChatService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: GEMINI_CONFIG.model,
      generationConfig: GEMINI_CONFIG.generationConfig
    });
    this.chatHistory = this.loadChatHistory();
    this.ensureLogsDirectory();
  }

  ensureLogsDirectory() {
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  loadChatHistory() {
    try {
      if (fs.existsSync(CHAT_HISTORY_FILE)) {
        const data = fs.readFileSync(CHAT_HISTORY_FILE, 'utf-8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Error loading chat history:', error);
      return [];
    }
  }

  saveChatHistory() {
    try {
      fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(this.chatHistory, null, 2));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  }

  logError(error, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      context
    };
    
    fs.appendFileSync(
      path.join(__dirname, '../logs/error.log'), 
      JSON.stringify(errorLog) + '\n'
    );
  }

  // Phương thức chat thông thường (không dùng search)
  async generateResponse(message) {
    try {
      const cleanedContent = message.content.replace(/<@!?\d+>/g, '').trim();
      
      this.chatHistory.push({
        role: "user",
        parts: [{ text: cleanedContent }]
      });

      const chat = this.model.startChat({
        history: this.chatHistory
      });

      const result = await chat.sendMessage(cleanedContent);
      const response = await result.response;
      const text = response.text();
      const escapedMessage = escapeMarkdown(text);

      this.chatHistory.push({
        role: "model",
        parts: [{ text: escapedMessage }]
      });

      this.saveChatHistory();
      return escapedMessage;
    } catch (error) {
      this.logError(error, { type: 'generateResponse' });
      throw error;
    }
  }

  // Phương thức chat có tích hợp search tool
  async chatWithSearch(id, messageId, message) {
    try {
      const cleanedMessage = message.replace(/<@!?\d+>/g, '').trim();
      
      this.chatHistory.push({
        role: "user",
        parts: [{ text: cleanedMessage }]
      });

      // Tạo model với cấu hình search đơn giản như trong tài liệu
      const searchModel = this.genAI.getGenerativeModel({
        model: GEMINI_CONFIG.model,
        tools: [{ googleSearch: {} }], // Đơn giản chỉ cần truyền object rỗng
        generationConfig: GEMINI_CONFIG.generationConfig
      });

      const chat = searchModel.startChat({
        history: this.chatHistory
      });

      const result = await chat.sendMessage(cleanedMessage);
      const response = await result.response;
      const text = response.text();
      const escapedResponse = escapeMarkdown(text);
      
      // Debug: log toàn bộ response
    //   console.log('Full API response:', JSON.stringify({
    //     text: text,
    //     candidates: response.candidates,
    //     usageMetadata: response.usageMetadata,
    //     groundingMetadata: response.candidates?.[0]?.groundingMetadata
    //   }, null, 2));

      this.chatHistory.push({
        role: "model",
        parts: [{ text: escapedResponse }]
      });

      this.saveChatHistory();
      
      return {
        success: true,
        response: escapedResponse,
        metadata: response.candidates?.[0]?.groundingMetadata,
        history: this.chatHistory
      };
    } catch (error) {
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        stack: error.stack
      });
      
      this.logError(error, { 
        type: 'chatWithSearch',
        id,
        messageId
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  clearHistory() {
    this.chatHistory = [];
    this.saveChatHistory();
  }
}

module.exports = GptChatService;