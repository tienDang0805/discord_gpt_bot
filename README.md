

-----

# Raccoon AI Bot - Tài Liệu Kỹ Thuật

Tài liệu này cung cấp hướng dẫn kỹ thuật chi tiết về việc cài đặt, cấu hình và vận hành Raccoon AI Bot, một bot Discord tích hợp các mô hình ngôn ngữ và API bên ngoài.

## Mục Lục

1.  [Tính Năng](https://www.google.com/search?q=%231-t%C3%ADnh-n%C4%83ng)
2.  [Bảng Lệnh Tham Chiếu](https://www.google.com/search?q=%232-b%E1%BA%A3ng-l%E1%BB%87nh-tham-chi%E1%BA%BFu)
3.  [Cài Đặt và Cấu Hình](https://www.google.com/search?q=%233-c%C3%A0i-%C4%91%E1%BA%B7t-v%C3%A0-c%E1%BA%A5u-h%C3%ACnh)
    1.  [Yêu Cầu Hệ Thống](https://www.google.com/search?q=%2331-y%C3%AAu-c%E1%BA%A7u-h%E1%BB%87-th%E1%BB%91ng)
    2.  [Hướng Dẫn Cài Đặt](https://www.google.com/search?q=%2332-h%C6%B0%E1%BB%9Bng-d%E1%BA%ABn-c%C3%A0i-%C4%91%E1%BA%B7t)
4.  [Vận Hành Bot](https://www.google.com/search?q=%234-v%E1%BA%ADn-h%C3%A0nh-bot)
    1.  [Môi Trường Phát Triển](https://www.google.com/search?q=%2341-m%C3%B4i-tr%C6%B0%E1%BB%9Dng-ph%C3%A1t-tri%E1%BB%83n)
    2.  [Môi Trường Production](https://www.google.com/search?q=%2342-m%C3%B4i-tr%C6%B0%E1%BB%9Dng-production)
5.  [Triển Khai Tự Động (CI/CD)](https://www.google.com/search?q=%235-tri%E1%BB%83n-khai-t%E1%BB%B1-%C4%91%E1%BB%99ng-cicd)
6.  [Giấy Phép](https://www.google.com/search?q=%236-gi%E1%BA%A5y-ph%C3%A9p)

-----

## 1\. Tính Năng

  * **Trí tuệ nhân tạo đàm thoại**: Tương tác và xử lý các cuộc hội thoại ngôn ngữ tự nhiên.
  * **Phân tích đa phương tiện**:
      * **Hình ảnh sang Văn bản**: Phân tích nội dung hình ảnh được người dùng đính kèm và cung cấp mô tả văn bản.
      * **Âm thanh sang Văn bản**: Chuyển đổi dữ liệu giọng nói từ các tệp âm thanh thành văn bản.
  * **Tạo hình ảnh**: Tạo hình ảnh từ một mô tả văn bản (prompt) thông qua lệnh chuyên dụng.
  * **Tổng hợp giọng nói**: Tham gia kênh thoại và đọc văn bản được cung cấp bởi người dùng.
  * **Truy vấn dữ liệu thời tiết**: Cung cấp thông tin thời tiết thời gian thực dựa trên API.
  * **Tìm kiếm thông tin**: Thực hiện tìm kiếm bằng các công cụ bên ngoài và trả về kết quả.

## 2\. Bảng Lệnh Tham Chiếu

| Lệnh | Mô tả | Ví dụ |
| :--- | :--- | :--- |
| **@Raccoon Bot** `[Câu hỏi]` | Gửi một yêu cầu hoặc câu hỏi đến mô hình ngôn ngữ. | `@Raccoon Bot Phân tích ưu nhược điểm của Node.js` |
| **@Raccoon Bot** `[Đính kèm ảnh]` | Yêu cầu bot phân tích nội dung của hình ảnh đính kèm. | *(Đính kèm file ảnh và đề cập đến bot)* |
| `/genimage` `[Prompt]` | Tạo một hình ảnh dựa trên mô tả văn bản. | `/genimage an oil painting of a raccoon in a library` |
| `!audio` `[Prompt]` | Yêu cầu bot tham gia kênh thoại của người dùng và đọc văn bản. | `!audio System reboot in five minutes.` |
| `/thoitiet` `[Tên thành phố]` | Truy vấn thông tin thời tiết hiện tại. | `/thoitiet Hanoi` |
| `/tool` `[Câu hỏi]` | Thực hiện tìm kiếm thông tin bằng công cụ bên ngoài. | `/tool What is the current version of the Linux kernel?` |

## 3\. Cài Đặt và Cấu Hình

### 3.1. Yêu Cầu Hệ Thống

  * **Node.js**: Phiên bản **20.x** trở lên. Khuyến nghị sử dụng phiên bản LTS (Long Term Support) mới nhất.
  * **Git**: Bắt buộc để sao chép mã nguồn.
  * **FFmpeg & Thư viện Opus (Linux)**: Bắt buộc cho các chức năng liên quan đến âm thanh và kênh thoại.
      * Trên hệ thống Debian/Ubuntu: `sudo apt update && sudo apt install -y ffmpeg libopus-dev`
      * Trên hệ thống CentOS/RHEL: `sudo yum install -y epel-release && sudo yum install -y ffmpeg libopus-devel`
  * **API Keys và Credentials**:
      * Discord Bot Token, Client ID, Guild ID từ [Discord Developer Portal](https://discord.com/developers/applications).
      * API Key cho Google Gemini từ [Google AI Studio](https://aistudio.google.com/).
      * API Key từ một nhà cung cấp dịch vụ thời tiết (ví dụ: [OpenWeatherMap](https://openweathermap.org/)).
      * Chuỗi kết nối (Connection String) cho cơ sở dữ liệu MongoDB.

### 3.2. Hướng Dẫn Cài Đặt

1.  **Sao chép mã nguồn từ repository:**

    ```bash
    git clone https://github.com/tienDang0805/discord_gpt_bot.git
    cd discord_gpt_bot
    ```

2.  **Cấu hình biến môi trường:**
    Tạo một file `.env` trong thư mục gốc của dự án. Điền các giá trị cần thiết theo mẫu dưới đây:

    ```env
    # Discord Bot Credentials
    DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
    CLIENT_ID=YOUR_BOT_CLIENT_ID
    GUILD_ID=YOUR_DISCORD_GUILD_ID

    # API Keys
    APIKEY_WEATHER=YOUR_WEATHER_API_KEY
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    GOOGLE_TTS_API_KEY=
    YOUTUBE_COOKIE=

    # Database
    MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING

    # Bot Configuration
    DISCORD_CHANNEL_ID=
    SYSTEM_PROMPT=
    CORE_RULES=
    ```

3.  **Cài đặt các gói phụ thuộc:**
    Sử dụng `npm ci` để đảm bảo cài đặt chính xác các phiên bản đã được định nghĩa trong `package-lock.json`, giúp tránh các xung đột không mong muốn.

    ```bash
    npm ci
    ```

    **Lưu ý quan trọng**: Nếu bạn vừa cài đặt các gói hệ thống như FFmpeg, hãy chạy lại `npm ci` để các module native của Node.js (ví dụ: `@discordjs/opus`) được biên dịch và liên kết đúng cách.

## 4\. Vận Hành Bot

### 4.1. Môi Trường Phát Triển

Để khởi chạy bot cho mục đích gỡ lỗi hoặc phát triển, sử dụng lệnh sau. Tiến trình sẽ kết thúc khi terminal bị đóng.

```bash
node index.js
```

### 4.2. Môi Trường Production

Để đảm bảo bot hoạt động liên tục, hãy sử dụng một trình quản lý tiến trình như `pm2`.

1.  **Cài đặt `pm2` toàn cục (nếu chưa có):**

    ```bash
    npm install -g pm2
    ```

2.  **Khởi động ứng dụng với `pm2`:**

    ```bash
    pm2 start index.js --name "raccoon-ai-bot"
    ```

3.  **Lưu cấu hình `pm2` và thiết lập khởi động cùng hệ thống:**

    ```bash
    pm2 save
    pm2 startup
    ```

    Thực thi lệnh được `pm2 startup` cung cấp để hoàn tất quá trình.

## 5\. Triển Khai Tự Động (CI/CD)

Repository này bao gồm một workflow GitHub Actions tại `.github/workflows/deploy.yml` để tự động hóa việc triển khai.

Khi có một `push` event lên nhánh `main`, workflow sẽ thực hiện các tác vụ sau trên server được chỉ định:

1.  Kết nối qua SSH.
2.  Kéo mã nguồn mới nhất.
3.  Cài đặt các gói phụ thuộc.
4.  Khởi động lại ứng dụng thông qua `pm2`.

Để kích hoạt tính năng này, cần phải cấu hình các **GitHub Secrets** sau trong settings của repository:

  * `SERVER_HOST`
  * `SERVER_USERNAME`
  * `SSH_PRIVATE_KEY`
  * `PROJECT_PATH`
  * Toàn bộ các biến môi trường yêu cầu bởi ứng dụng (ví dụ: `DISCORD_TOKEN`, `GEMINI_API_KEY`,...).

## 6\. Giấy Phép

Dự án này được phát hành dưới Giấy phép MIT. Vui lòng tham khảo file `LICENSE` để biết thêm chi tiết.