const { GoogleGenerativeAI } = require("@google/generative-ai");

class ImageGenerationService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.imageModel = "gemini-2.0-flash-exp-image-generation";
  }

  async generateImage(prompt) {
    console.log(`[GenImage] Bắt đầu tạo ảnh với prompt: "${prompt}"`);
    
    try {
      console.log('[GenImage] Khởi tạo model...');
      const model = this.genAI.getGenerativeModel({ 
        model: this.imageModel,
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      console.log('[GenImage] Đang gọi API generateContent...');
      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      });

      console.log('[GenImage] Đã nhận phản hồi từ API');
      const response = result.response;
      
      if (!response.candidates?.[0]?.content?.parts) {
        console.error('[GenImage] Lỗi: Phản hồi API không có candidates hoặc parts');
        throw new Error("Không nhận được phản hồi hợp lệ từ API");
      }

      console.log(`[GenImage] Số lượng parts: ${response.candidates[0].content.parts.length}`);
      
      let imageBuffer = null;
      let textResponse = "";

      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log('[GenImage] Phát hiện text part:', part.text.substring(0, 50) + '...');
          textResponse += part.text + "\n";
        } else if (part.inlineData) {
          console.log('[GenImage] Phát hiện image part, mimeType:', part.inlineData.mimeType);
          imageBuffer = Buffer.from(part.inlineData.data, "base64");
        }
      }

      if (!imageBuffer) {
        console.error('[GenImage] Lỗi: Không tìm thấy image data trong response');
        return {
          success: false,
          textResponse: textResponse || "Không thể tạo ảnh từ prompt này",
          error: "NO_IMAGE_GENERATED"
        };
      }

      console.log('[GenImage] Tạo ảnh thành công! Kích thước ảnh:', imageBuffer.length, 'bytes');
      return {
        success: true,
        imageBuffer,
        textResponse: textResponse.trim()
      };
    } catch (error) {
      console.error('[GenImage] Lỗi trong quá trình tạo ảnh:', {
        error: error.message,
        stack: error.stack,
        prompt: prompt
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ImageGenerationService;