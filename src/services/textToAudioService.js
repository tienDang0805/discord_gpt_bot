const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class TextToAudioService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192
      }
    });
  }

  /**
   * Loại bỏ markdown từ text
   * @param {string} text 
   * @returns {string}
   */
  removeMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/#+\s*/g, '')
      .replace(/\n- /g, '\n')
      .replace(/\n\d+\. /g, '\n')
      .replace(/<\/?[^>]+(>|$)/g, '');
  }

  /**
   * Tạo audio từ text sử dụng Google TTS API
   * @param {string} text 
   * @returns {Promise<Buffer>}
   */
  async generateSpeechAudioFromText(text) {
    const cleanText = this.removeMarkdown(text);
    if (!cleanText || cleanText.length < 3) {
      throw new Error('Text quá ngắn để chuyển thành audio');
    }

    const apiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`;
    
    const requestData = {
      input: { text: cleanText },
      voice: {
        languageCode: "vi-VN",
        name: "vi-VN-Wavenet-D"
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0.0
      }
    };

    try {
      const response = await axios.post(apiUrl, requestData, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.audioContent) {
        return Buffer.from(response.data.audioContent, 'base64');
      }
      throw new Error('Không có dữ liệu audio trong response');
    } catch (error) {
      console.error('TTS Error:', error.response?.data || error.message);
      throw new Error('Lỗi khi tạo audio từ text');
    }
  }

  /**
   * Tạo response text và audio từ prompt
   * @param {string} prompt 
   * @returns {Promise<{text: string, audioBuffer: Buffer}>}
   */
  async generateResponseWithAudio(prompt) {
    const result = await this.model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    
    const response = await result.response;
    const text = response.text();
    
    const audioBuffer = await this.generateSpeechAudioFromText(text);
    
    return { text, audioBuffer };
  }
}

module.exports = TextToAudioService;