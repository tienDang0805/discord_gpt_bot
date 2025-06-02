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
    this.imageModel = this.genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp-image-generation",
      generationConfig: GEMINI_CONFIG.generationConfig
    });
    this.MAX_HISTORY_LENGTH = 100;
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

  addToHistory(role, content) {
    // Kiểm tra trùng lặp trước khi thêm
    const lastMessage = this.chatHistory[this.chatHistory.length - 1];
    if (!lastMessage || lastMessage.role !== role || lastMessage.parts[0].text !== content) {
      this.chatHistory.push({
        role,
        parts: [{ text: content }]
      });

      // Giới hạn lịch sử chat
      if (this.chatHistory.length > this.MAX_HISTORY_LENGTH) {
        this.chatHistory = this.chatHistory.slice(-this.MAX_HISTORY_LENGTH);
      }

      this.saveChatHistory();
    }
  }

  clearHistory() {
    this.chatHistory = [];
    this.saveChatHistory();
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

  async generateResponse(message) {
    try {
      const cleanedContent = message.content.replace(/<@!?\d+>/g, '').trim();
      
      const chat = this.model.startChat({
        history: this.chatHistory
      });

      const result = await chat.sendMessage(cleanedContent);
      const response = await result.response;
      const text = response.text();
      const escapedMessage = escapeMarkdown(text);

      // Only add to history after successful response
      this.addToHistory("user", cleanedContent);
      this.addToHistory("model", escapedMessage);

      return escapedMessage;
    } catch (error) {
      this.logError(error, { type: 'generateResponse' });
      throw error;
    }
  }

  async ImageToTextAI(imageUrl, messageContent = "") {
    try {
      const response = await fetch(imageUrl);
      const imageBuffer = await response.arrayBuffer();
      
      const imageFile = {
        inlineData: {
          data: Buffer.from(imageBuffer).toString('base64'),
          mimeType: response.headers.get('content-type') || 'image/jpeg'
        }
      };

      const contents = [
        { 
          role: "user",
          parts: [
            { text: messageContent || "Mô tả hình ảnh này" },
            imageFile
          ]
        }
      ];

      const result = await this.model.generateContent({ contents });
      const responseText = result.response.text();
      const escapedText = escapeMarkdown(responseText);

      // Only add to history after successful response
      this.addToHistory("user", `[IMAGE] ${messageContent}`);
      this.addToHistory("model", escapedText);
      
      return escapedText;
    } catch (error) {
      this.logError(error, { type: 'ImageToTextAI', imageUrl });
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  async VideoToTextAI(videoUrl, caption = "") {
    try {
      const response = await fetch(videoUrl);
      const videoBuffer = await response.arrayBuffer();
      const base64Video = Buffer.from(videoBuffer).toString('base64');
      
      let mimeType = response.headers.get('content-type') || 'video/mp4';
      if (mimeType === 'application/octet-stream') {
        if (videoUrl.toLowerCase().endsWith('.mp4')) {
          mimeType = 'video/mp4';
        } else if (videoUrl.toLowerCase().endsWith('.webm')) {
          mimeType = 'video/webm';
        } else if (videoUrl.toLowerCase().endsWith('.mov')) {
          mimeType = 'video/quicktime';
        }
      }

      const contents = {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Video
              }
            },
            { text: caption || "Phân tích video này" }
          ]
        }]
      };

      const result = await this.model.generateContent(contents);
      const responseText = result.response.text();
      const escapedText = escapeMarkdown(responseText);

      // Only add to history after successful response
      this.addToHistory("user", `[VIDEO] ${caption}`);
      this.addToHistory("model", escapedText);
      
      return escapedText;
    } catch (error) {
      this.logError(error, { type: 'VideoToTextAI', videoUrl });
      throw new Error(`Failed to process video: ${error.message}`);
    }
  }

  async generateImage(prompt) {
    try {
      const response = await this.imageModel.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      });

      const result = response.response;
      
      let imageBuffer = null;
      let textResponse = "";

      for (const part of result.candidates[0].content.parts) {
        if (part.text) {
          textResponse += part.text + "\n";
        } else if (part.inlineData) {
          imageBuffer = Buffer.from(part.inlineData.data, "base64");
        }
      }

      if (!imageBuffer) {
        return {
          success: false,
          textResponse: textResponse || "Không thể tạo ảnh từ prompt này",
          error: "NO_IMAGE_GENERATED"
        };
      }

      // Only add to history after successful response
      this.addToHistory("user", `[IMAGE GENERATION] ${prompt}`);
      this.addToHistory("model", textResponse.trim());

      return {
        success: true,
        imageBuffer,
        textResponse: textResponse.trim()
      };
    } catch (error) {
      this.logError(error, { type: 'generateImage', prompt });
      return {
        success: false,
        error: error.message
      };
    }
  }

  async chatWithSearch(id, messageId, message) {
    try {
      const cleanedMessage = message.replace(/<@!?\d+>/g, '').trim();
      
      const searchModel = this.genAI.getGenerativeModel({
        model: GEMINI_CONFIG.model,
        tools: [{ googleSearch: {} }],
        generationConfig: GEMINI_CONFIG.generationConfig
      });

      const chat = searchModel.startChat({
        history: this.chatHistory
      });

      const result = await chat.sendMessage(cleanedMessage);
      const response = await result.response;
      const text = response.text();
      const escapedResponse = escapeMarkdown(text);
      
      // Only add to history after successful response
      this.addToHistory("user", cleanedMessage);
      this.addToHistory("model", escapedResponse);
      
      return {
        success: true,
        response: escapedResponse,
        metadata: response.candidates?.[0]?.groundingMetadata
      };
    } catch (error) {
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
}

module.exports = GptChatService;