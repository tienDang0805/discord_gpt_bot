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
  async ImageToTextAI(imageUrl, messageContent = "") {
    try {
      // Tải hình ảnh
      const response = await fetch(imageUrl);
      const imageBuffer = await response.arrayBuffer();
      
      // Tạo đối tượng file từ buffer
      const imageFile = {
        inlineData: {
          data: Buffer.from(imageBuffer).toString('base64'),
          mimeType: response.headers.get('content-type') || 'image/jpeg'
        }
      };

      // Tạo nội dung gửi đến model
      const contents = [
        { 
          role: "user",
          parts: [
            { text: messageContent || "Mô tả hình ảnh này" },
            imageFile
          ]
        }
      ];

      // Gọi model
      const result = await this.model.generateContent({
        contents: contents,
      });
      
      const responseText = result.response.text();
      const escapedText = escapeMarkdown(responseText);

      // Cập nhật lịch sử chat
      this.chatHistory.push({
        role: "user",
        parts: [
          { text: `[IMAGE] ${messageContent}` }
        ]
      });
      
      this.chatHistory.push({
        role: "model",
        parts: [{ text: escapedText }]
      });
      
      this.saveChatHistory();
      
      return escapedText;
    } catch (error) {
      this.logError(error, { type: 'ImageToTextAI', imageUrl });
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }
  async VideoToTextAI(videoUrl, caption = "") {
    try {
      // Tải video từ URL
      const response = await fetch(videoUrl);
      const videoBuffer = await response.arrayBuffer();
      const base64Video = Buffer.from(videoBuffer).toString('base64');
      
      // Xác định MIME type
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

      // Kiểm tra kích thước video (tối đa 20MB)
      // const maxSize = 20 * 1024 * 1024; // 20MB
      // if (videoBuffer.byteLength > maxSize) {
      //   throw new Error(`Video quá lớn (tối đa ${maxSize/1024/1024}MB)`);
      // }

      // Tạo nội dung gửi đến model
      const contents = {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Video
              }
            },
            { text: caption || "Phân tích video này" }
          ]
        }]
      };

      // Gọi API Gemini
      const result = await this.model.generateContent(contents);
      const responseText = result.response.text();
      const escapedText = escapeMarkdown(responseText);

      // Cập nhật lịch sử chat
      this.chatHistory.push({
        role: "user",
        parts: [
          { text: `[VIDEO] ${caption}` }
        ]
      });
      
      this.chatHistory.push({
        role: "model",
        parts: [{ text: escapedText }]
      });
      
      this.saveChatHistory();
      
      return escapedText;
    } catch (error) {
      this.logError(error, { type: 'VideoToTextAI', videoUrl });
      throw new Error(`Failed to process video: ${error.message}`);
    }
  }
  async generateImage(prompt) {
    try {
      const response = await this.genAI.getGenerativeModel({ 
        model: this.imageModel,
        generationConfig: this.generationConfig
      }).generateContent({
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

      return {
        success: true,
        imageBuffer,
        textResponse: textResponse.trim()
      };
    } catch (error) {
      console.error('Image Generation Error:', error);
      return {
        success: false,
        error: error.message
      };
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