# ChatDVT - Technical Documentation

Tài liệu này cung cấp hướng dẫn kỹ thuật chi tiết về việc cài đặt, cấu hình và vận hành ChatDVT, một Discord bot tích hợp các mô hình ngôn ngữ và API bên ngoài.

## Table of Contents

1.  [Features](#1-features)
2.  [Command Reference](#2-command-reference)
3.  [Setup and Configuration](#3-setup-and-configuration)
      - [System Requirements](#31-system-requirements)
      - [Installation Guide](#32-installation-guide)
4.  [Operation](#4-operation)
      - [Development Environment](#41-development-environment)
      - [Production Environment](#42-production-environment)
5.  [Continuous Integration/Continuous Deployment](#5-continuous-integrationcontinuous-deployment)
6.  [License](#6-license)

-----

## 1. Features

  * **Conversational AI**: Tương tác và xử lý các cuộc hội thoại ngôn ngữ tự nhiên.
  * **Multimedia Analysis**:
      * **Image-to-Text**: Phân tích nội dung hình ảnh được người dùng đính kèm và cung cấp mô tả văn bản.
      * **Audio-to-Text**: Chuyển đổi dữ liệu giọng nói từ các tệp âm thanh thành văn bản.
      * **Video-to-Text**: Phân tích và mô tả nội dung từ các tệp video đính kèm.
  * **Image Generation**: Tạo hình ảnh từ một mô tả văn bản (`prompt`) thông qua lệnh chuyên dụng.
  * **Text-to-Speech (TTS)**: Tham gia kênh thoại (`voice channel`) và trả lời câu hỏi của người dùng.
  * **Weather Data Retrieval**: Cung cấp thông tin thời tiết thời gian thực dựa trên `API`.
  * **Real-time Search**: Thực hiện tìm kiếm bằng các công cụ bên ngoài và trả về kết quả.
  * **AI-Powered Games**: Tổ chức các trò chơi tương tác như đố vui và đuổi hình bắt chữ.
  * **Customizable Identity**: Cho phép quản trị viên xem, chỉnh sửa và đặt lại danh tính (tính cách) của bot.

-----

## 2. Command Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| **@ChatDVT** `[Prompt]` | Gửi một yêu cầu hoặc câu hỏi đến mô hình ngôn ngữ. | `@ChatDVT Analyze the pros and cons of Node.js` |
| **@ChatDVT** `[File attachment]` | Yêu cầu `bot` phân tích nội dung file đính kèm (image, audio, video). | *(Đính kèm file và đề cập đến bot)* |
| `/genimage` `[Prompt]` | Tạo một hình ảnh dựa trên mô tả văn bản. | `/genimage an oil painting of a raccoon in a library` |
| `!audio` `[Prompt]` | Yêu cầu `bot` tham gia kênh thoại của người dùng và đọc văn bản. | `!audio System reboot in five minutes.` |
| `/thoitiet` `[City Name]` | Truy vấn thông tin thời tiết hiện tại. | `/thoitiet Hanoi` |
| `/tool` `[Query]` | Thực hiện tìm kiếm thông tin bằng công cụ bên ngoài. | `/tool What is the current version of the Linux kernel?` |
| `/setting view` | Xem danh tính (`system prompt`) hiện tại của bot. | `/setting view` |
| `/setting edit` | Chỉnh sửa danh tính (`system prompt`) của bot. | `/setting edit You are a pirate.` |
| `/setting reset` | Đưa danh tính của bot về trạng thái mặc định. | `/setting reset` |
| `/quiz` | Bắt đầu một trò chơi đố vui (quiz) với AI. | `/quiz` |
| `/catchtheword` | Bắt đầu trò chơi đuổi hình bắt chữ với AI. | `/catchtheword` |

-----

## 3. Setup and Configuration

### 3.1. System Requirements

  * **Node.js**: `Version` **20.x** trở lên. Khuyến nghị sử dụng phiên bản LTS (Long Term Support) mới nhất.
  * **Git**: Bắt buộc để sao chép mã nguồn (`source code`).
  * **FFmpeg & Opus Library (Linux)**: Bắt buộc cho các chức năng liên quan đến âm thanh và kênh thoại.
      * Trên hệ thống Debian/Ubuntu: `sudo apt update && sudo apt install -y ffmpeg libopus-dev`
      * Trên hệ thống CentOS/RHEL: `sudo yum install -y epel-release && sudo yum install -y ffmpeg libopus-devel`
  * **API Keys và Credentials**:
      * Discord Bot Token, Client ID, Guild ID từ [Discord Developer Portal](https://discord.com/developers/applications).
      * API Key cho Google Gemini từ [Google AI Studio](https://aistudio.google.com/).
      * API Key từ một nhà cung cấp dịch vụ thời tiết (ví dụ: [OpenWeatherMap](https://openweathermap.org/)).
      * Chuỗi kết nối (`Connection String`) cho cơ sở dữ liệu MongoDB.

### 3.2. Installation Guide

1.  **Sao chép mã nguồn từ repository:**

    ```bash
    git clone https://github.com/tienDang0805/discord_gpt_bot.git
    cd discord_gpt_bot
    ```

2.  **Cấu hình biến môi trường (Environment Variables):**
    Tạo một file `.env` trong thư mục gốc (`root directory`) của dự án. Điền các giá trị cần thiết theo mẫu dưới đây:

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

3.  **Cài đặt các gói phụ thuộc (dependencies):**
    Sử dụng `npm ci` để đảm bảo cài đặt chính xác các phiên bản đã được định nghĩa trong `package-lock.json`, giúp tránh các xung đột không mong muốn.

    ```bash
    npm ci
    ```

    **Lưu ý quan trọng**: Nếu bạn vừa cài đặt các gói hệ thống như FFmpeg, hãy chạy lại `npm ci` để các `native modules` của Node.js (ví dụ: `@discordjs/opus`) được `compile` và `link` đúng cách.

-----

## 4. Operation

### 4.1. Development Environment

Để khởi chạy `bot` cho mục đích `debugging` hoặc `development`, sử dụng lệnh sau. Tiến trình (`process`) sẽ kết thúc khi `terminal` bị đóng.

```bash
node index.js
```

### 4.2. Production Environment

Để đảm bảo `bot` hoạt động liên tục, hãy sử dụng một trình quản lý tiến trình (`process manager`) như `pm2`.

1.  **Cài đặt `pm2` toàn cục (globally):**

    ```bash
    npm install -g pm2
    ```

2.  **Khởi động ứng dụng với `pm2`:**

    ```bash
    pm2 start index.js --name "chatdvt-bot"
    ```

3.  **Lưu cấu hình `pm2` và thiết lập khởi động cùng hệ thống (`system startup`):**

    ```bash
    pm2 save
    pm2 startup
    ```

    Thực thi lệnh được `pm2 startup` cung cấp để hoàn tất quá trình.

-----

## 5. Continuous Integration/Continuous Deployment

`Repository` này bao gồm một `workflow` của GitHub Actions tại `.github/workflows/deploy.yml` để tự động hóa việc triển khai.

Khi có một `push event` lên nhánh `main` (`main branch`), `workflow` sẽ thực hiện các tác vụ sau trên `server` được chỉ định:

1.  Kết nối qua SSH.
2.  Kéo mã nguồn mới nhất.
3.  Cài đặt `dependencies`.
4.  Khởi động lại ứng dụng thông qua `pm2`.

Để kích hoạt tính năng này, cần phải cấu hình các **GitHub Secrets** sau trong `settings` của `repository`:

  * `SERVER_HOST`
  * `SERVER_USERNAME`
  * `SSH_PRIVATE_KEY`
  * `PROJECT_PATH`
  * Toàn bộ các biến môi trường yêu cầu bởi ứng dụng (ví dụ: `DISCORD_TOKEN`, `GEMINI_API_KEY`,...).

-----

## 6. License

Dự án này được phát hành dưới Giấy phép MIT. Vui lòng tham khảo file `LICENSE` để biết thêm chi tiết.

-----

Mong rằng lần này sẽ giải quyết dứt điểm vấn đề. Một lần nữa xin lỗi bạn vì đã làm mất thời gian.
