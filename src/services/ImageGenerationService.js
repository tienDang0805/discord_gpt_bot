const { GoogleGenAI } = require("@google/genai");

class ImageGenerationService {
  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
   
    this.imageModel = "imagen-4.0-generate-001"; 
  }

  async generateImage(prompt) {
    console.log(`[GenImage] Bắt đầu tạo ảnh với prompt: "${prompt}"`);
    
    try {
      console.log(`[GenImage] Đang gọi model ${this.imageModel}...`);

      const response = await this.ai.models.generateImages({
        model: this.imageModel,
        prompt: prompt,
        config: {
          numberOfImages: 1, 
          
        },
      });

      console.log('[GenImage] Đã nhận phản hồi từ API');

      if (!response.generatedImages || response.generatedImages.length === 0) {
        console.error('[GenImage] Lỗi: Không nhận được generatedImages từ phản hồi');
        throw new Error("API không trả về dữ liệu ảnh");
      }

      const generatedImage = response.generatedImages[0];
      
      if (!generatedImage.image || !generatedImage.image.imageBytes) {
         console.error('[GenImage] Lỗi: Dữ liệu bytes của ảnh bị thiếu');
         throw new Error("Dữ liệu ảnh không hợp lệ");
      }

      const imageBuffer = Buffer.from(generatedImage.image.imageBytes, "base64");

      console.log('[GenImage] Tạo ảnh thành công! Kích thước ảnh:', imageBuffer.length, 'bytes');

      return {
        success: true,
        imageBuffer,
        textResponse: "Đã tạo ảnh thành công với Imagen." 
      };

    } catch (error) {
      console.error('[GenImage] Lỗi trong quá trình tạo ảnh:', {
        error: error.message,
        stack: error.stack,
        prompt: prompt
      });

      return {
        success: false,
        error: error.message,
        textResponse: "Lỗi khi tạo ảnh."
      };
    }
  }
}

module.exports = ImageGenerationService;