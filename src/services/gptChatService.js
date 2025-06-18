const { escapeMarkdown } = require('discord.js');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { CHAT_HISTORY_COLLECTION, GEMINI_CONFIG, DB_NAME } = require('../config/constants');
const fs = require('fs');
const path = require('path');
const wav = require('wav');
const {GoogleGenAI} = require("@google/genai") ;
class GptChatService {
  constructor() {
    // Khởi tạo Gemini AI
    const safetySettings = [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE",  // Changed to BLOCK_NONE to bypass filtering
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_NONE",  // Changed to BLOCK_NONE to bypass filtering
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE",
      }
    ];
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: GEMINI_CONFIG.model,
      generationConfig: GEMINI_CONFIG.generationConfig,
      safetySettings: safetySettings 

    });
    this.imageModel = this.genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp-image-generation",
      generationConfig: GEMINI_CONFIG.generationConfig,
      safetySettings: safetySettings 
    });

    // Cấu hình chat history
    this.MAX_HISTORY_LENGTH = 200;
    this.chatHistory = [];
    
    // Khởi tạo MongoDB
    this.dbClient = null;
    this.db = null;
    this.initializeDB().catch(console.error);
  }

  /**
   * Khởi tạo kết nối MongoDB Atlas
   */
  async initializeDB() {
    try {
      this.dbClient = new MongoClient(process.env.MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        }
      });
      
      await this.dbClient.connect();
      this.db = this.dbClient.db(DB_NAME);
      
      // Tạo index để tối ưu hiệu suất
      await this.db.collection('error_logs').createIndex({ timestamp: 1 });
      await this.db.collection('error_logs').createIndex({ type: 1 });
      
      console.log('Kết nối MongoDB Atlas thành công');
    } catch (error) {
      console.error('Lỗi kết nối MongoDB:', error);
      throw error;
    }
  }

  /**
   * Tải lịch sử chat từ MongoDB
   */
  async loadChatHistory() {
    try {
      if (!this.db) await this.initializeDB();
      
      const collection = this.db.collection(CHAT_HISTORY_COLLECTION);
      const historyDoc = await collection.findOne({ type: 'global_chat_history' });
      
      this.chatHistory = historyDoc?.messages || [];
      return this.chatHistory;
    } catch (error) {
      console.error('Lỗi khi tải lịch sử chat:', error);
      return [];
    }
  }

  /**
   * Lưu lịch sử chat vào MongoDB
   */
  async saveChatHistory() {
    try {
      if (!this.db) await this.initializeDB();
      
      const collection = this.db.collection(CHAT_HISTORY_COLLECTION);
      await collection.updateOne(
        { type: 'global_chat_history' },
        { 
          $set: { 
            messages: this.chatHistory,
            updatedAt: new Date(),
            historyLength: this.chatHistory.length
          },
          $setOnInsert: {
            type: 'global_chat_history',
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Lỗi khi lưu lịch sử chat:', error);
      throw error;
    }
  }

  /**
   * Thêm tin nhắn vào lịch sử chat
   */
  async addToHistory(role, content) {
    try {
      // Kiểm tra trùng lặp trước khi thêm
      const lastMessage = this.chatHistory[this.chatHistory.length - 1];
      if (!lastMessage || lastMessage.role !== role || lastMessage.parts[0].text !== content) {
        this.chatHistory.push({
          role,
          parts: [{ text: content }],
        });

        // Giới hạn lịch sử chat
        if (this.chatHistory.length > this.MAX_HISTORY_LENGTH) {
          this.chatHistory = this.chatHistory.slice(-this.MAX_HISTORY_LENGTH);
        }

        await this.saveChatHistory();
      }
    } catch (error) {
      console.error('Lỗi khi thêm vào lịch sử:', error);
      throw error;
    }
  }

  /**
   * Xóa lịch sử chat
   */
  async clearHistory() {
    try {
      this.chatHistory = [];
      await this.saveChatHistory();
      return true;
    } catch (error) {
      console.error('Lỗi khi xóa lịch sử:', error);
      throw error;
    }
  }

  /**
   * Ghi log lỗi vào MongoDB
   */
  async logError(error, context = {}) {
    try {
      if (!this.db) await this.initializeDB();
      
      const errorLog = {
        timestamp: new Date(),
        error: error.message,
        stack: error.stack,
        context,
        type: context.type || 'unknown'
      };
      
      const collection = this.db.collection('error_logs');
      await collection.insertOne(errorLog);
    } catch (dbError) {
      console.error('Không thể ghi log lỗi vào MongoDB:', dbError);
      console.error('Lỗi gốc:', error);
    }
  }

  /**
   * Tạo phản hồi từ tin nhắn
   */
  async generateResponse(message) {
    try {
      // 1. Load history HIỆN TẠI từ DB
      await this.loadChatHistory();
      const cleanedContent = message.content.replace(/<@!?\d+>/g, '').trim();
  
      // 2. Tạo payload gửi đi (history cũ + tin nhắn mới)
      const payload = {
        contents: [
          ...this.chatHistory, // History cũ
          {
            role: "user",
            parts: [{ text: cleanedContent }]
          }
        ]
      };
  
      // 3. Gửi request THỦ CÔNG (không dùng startChat)
      const result = await this.model.generateContent(payload);
      const response = await result.response;
      const text = response.text();
      const escapedMessage = fullEscapeMarkdown(text);
  
      // 4. QUAN TRỌNG: Chỉ lưu tin nhắn MỚI vào history
      await this.saveNewMessagesOnly(cleanedContent, escapedMessage);
  
      return escapedMessage;
    } catch (error) {
      await this.logError(error);
      throw error;
    }
  }
  
  async saveNewMessagesOnly(userMsg, modelMsg) {
    // Kiểm tra duplicate theo 2 cấp độ
    const isUserMsgDuplicate = this.chatHistory.some(
      msg => msg.role === "user" && msg.parts[0].text === userMsg
    );
    
    const isModelMsgDuplicate = this.chatHistory.some(
      msg => msg.role === "model" && msg.parts[0].text === modelMsg
    );
  
    // Chỉ thêm nếu KHÔNG trùng
    if (!isUserMsgDuplicate) {
      this.chatHistory.push({
        role: "user",
        parts: [{ text: userMsg }]
      });
    }
  
    if (!isModelMsgDuplicate) {
      this.chatHistory.push({
        role: "model",
        parts: [{ text: modelMsg }]
      });
    }
  
    // Giới hạn lịch sử
    if (this.chatHistory.length > this.MAX_HISTORY_LENGTH) {
      this.chatHistory = this.chatHistory.slice(-this.MAX_HISTORY_LENGTH);
    }
  
    await this.saveChatHistory();
  }

  /**
   * Phân tích hình ảnh
   */
 /**
 * Phân tích hình ảnh và lưu cả hình ảnh + tin nhắn vào lịch sử
 */
async ImageToTextAI(imageUrl, messageContent = "") {
  try {
    // 1. Load history từ DB
    await this.loadChatHistory();
    
    // 2. Tải và chuẩn bị hình ảnh
    const response = await fetch(imageUrl);
    const imageBuffer = await response.arrayBuffer();
    
    const imageFile = {
      inlineData: {
        data: Buffer.from(imageBuffer).toString('base64'),
        mimeType: response.headers.get('content-type') || 'image/jpeg'
      }
    };

    // 3. Tạo payload với history cũ + tin nhắn mới + hình ảnh
    const payload = {
      contents: [
        ...this.chatHistory, // History cũ
        {
          role: "user",
          parts: [
            { text: messageContent || "Mô tả hình ảnh này" },
            imageFile
          ]
        }
      ]
    };

    // 4. Gửi request đến model
    const result = await this.model.generateContent(payload);
    const responseText = result.response.text();
    const escapedText = fullEscapeMarkdown(responseText);

    // 5. Lưu cả hình ảnh và tin nhắn vào history (có kiểm tra trùng lặp)
    const userMessageWithImage = {
      role: "user",
      parts: [
        { text: `[IMAGE] ${messageContent}`.trim() },
        imageFile // Giữ nguyên hình ảnh trong history
      ]
    };

    const modelResponse = {
      role: "model",
      parts: [{ text: escapedText }]
    };

    // Kiểm tra trùng lặp trước khi lưu
    const isDuplicate = this.isMessageDuplicate(userMessageWithImage, modelResponse);
    if (!isDuplicate) {
      this.chatHistory.push(userMessageWithImage);
      this.chatHistory.push(modelResponse);
      
      // Giới hạn lịch sử
      if (this.chatHistory.length > this.MAX_HISTORY_LENGTH) {
        this.chatHistory = this.chatHistory.slice(-this.MAX_HISTORY_LENGTH);
      }
      
      await this.saveChatHistory();
    }

    return escapedText;
  } catch (error) {
    await this.logError(error, { 
      type: 'ImageToTextAI', 
      imageUrl
    });
    throw new Error(`Không thể xử lý hình ảnh: ${error.message}`);
  }
}

/**
 * Kiểm tra tin nhắn trùng lặp trong lịch sử
 */
isMessageDuplicate(userMsg, modelMsg) {
  // Kiểm tra tin nhắn người dùng
  const isUserMsgDuplicate = this.chatHistory.some(msg => 
    msg.role === "user" && 
    msg.parts.some(part => 
      part.text === userMsg.parts.find(p => p.text)?.text &&
      (!part.inlineData || part.inlineData.data === userMsg.parts.find(p => p.inlineData)?.inlineData.data)
    )
  );
  
  // Kiểm tra tin nhắn model
  const isModelMsgDuplicate = this.chatHistory.some(msg => 
    msg.role === "model" && 
    msg.parts[0].text === modelMsg.parts[0].text
  );
  
  return isUserMsgDuplicate && isModelMsgDuplicate;
}

  /**
   * Phân tích video
   */
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

      await this.addToHistory("user", `[VIDEO] ${caption}`);
      await this.addToHistory("model", escapedText);
      
      return escapedText;
    } catch (error) {
      await this.logError(error, { 
        type: 'VideoToTextAI', 
        videoUrl
      });
      throw new Error(`Không thể xử lý video: ${error.message}`);
    }
  }

  /**
   * Tạo hình ảnh từ prompt
   */
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

      await this.addToHistory("user", `[IMAGE GENERATION] ${prompt}`);
      await this.addToHistory("model", textResponse.trim());

      return {
        success: true,
        imageBuffer,
        textResponse: textResponse.trim()
      };
    } catch (error) {
      await this.logError(error, { 
        type: 'generateImage', 
        prompt
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Chat với chức năng tìm kiếm
   */
  async chatWithSearch(id, messageId, message) {
    try {
      await this.loadChatHistory();
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
      
      await this.addToHistory("user", cleanedMessage);
      await this.addToHistory("model", escapedResponse);
      
      return {
        success: true,
        response: escapedResponse,
        metadata: response.candidates?.[0]?.groundingMetadata
      };
    } catch (error) {
      await this.logError(error, { 
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
  async generateAudioWithContext(text, voiceName = 'Kore') {
    try {
      // 1. Không cần load history ở đây nữa vì đã xử lý trong generateResponse
      
      // 2. Tạo audio từ text nhận được
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY});

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ 
          parts: [{ 
            text: text 
          }] 
        }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            },
          },
        },
      });
  
      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) throw new Error('Không nhận được dữ liệu audio');
  
      const audioBuffer = Buffer.from(data, 'base64');
      
      // 3. Lưu audio vào thư mục tạm
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const fileName = `audio_${Date.now()}.wav`;
      const filePath = path.join(tempDir, fileName);
      
      await new Promise((resolve, reject) => {
        const writer = new wav.FileWriter(filePath, {
          channels: 1,
          sampleRate: 24000,
          bitDepth: 16,
        });
  
        writer.on('finish', resolve);
        writer.on('error', reject);
        writer.write(audioBuffer);
        writer.end();
      });
  
      return {
        success: true,
        filePath,
        text,
        voiceName
      };
    } catch (error) {
      await this.logError(error, {
        type: 'textToAudioAI',
        text
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
  /**
   * Đóng kết nối MongoDB
   */
  async closeConnection() {
    try {
      if (this.dbClient) {
        await this.dbClient.close();
        console.log('Đã đóng kết nối MongoDB');
      }
    } catch (error) {
      console.error('Lỗi khi đóng kết nối MongoDB:', error);
    }
  }
}
function fullEscapeMarkdown(text) {
  return text
    .replace(/\\/g, '\\\\')  // escape backslash
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\|/g, '\\|')
    .replace(/\//g, '\\/')  // nếu bạn muốn escape dấu /
    .replace(/>/g, '\\>')   // blockquote
    .replace(/#/g, '\\#')   // heading
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

module.exports = GptChatService;