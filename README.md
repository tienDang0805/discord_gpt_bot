
-----

# 🤖 Raccoon 8D Bot - Technical Readme

This document provides technical details for setting up and running the Raccoon 8D Bot, a Discord bot with AI-powered features.

-----

## 🚀 Key Features

The bot offers a range of functionalities, leveraging various AI models and external APIs:

  * **Text-to-Text Conversational AI**: Engages in natural language conversations with users.
  * **Multimedia Analysis (Image/Video/Audio to Text)**:
      * **Image to Text**: Attaching an image and mentioning the bot allows it to analyze and describe the image content.
      * **Video to Text**: Similar to images, the bot can process attached videos and transcribe their content.
      * **Audio to Text**: Converts speech from attached audio files into text.
  * **Image Generation**: Utilizes the `/genimage [Prompt]` command to create images based on user prompts.
  * **Text-to-Audio (Voice Channel Narration)**: The `!audio [Prompt]` command instructs the bot to join the user's voice channel and narrate the provided text.
  * **Current Weather Information**: The `/thoitiet` command provides real-time weather data.
  * **Real-time Search**: The `/tool [Prompt]` command performs real-time searches using external tools and returns the results.

-----

## ⚙️ Setup and Configuration

To get the Raccoon 8D Bot running, you need to create a `.env` file in the project's root directory and populate it with the following environment variables:

```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
CLIENT_ID=YOUR_BOT_CLIENT_ID
GUILD_ID=YOUR_DISCORD_GUILD_ID
APIKEY_WEATHER=YOUR_WEATHER_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
```

  * **`DISCORD_TOKEN`**: Your Discord bot's authentication token, obtainable from the [Discord Developer Portal](https://discord.com/developers/applications).
  * **`CLIENT_ID`**: The Application ID (Client ID) for your Discord bot.
  * **`GUILD_ID`**: The ID of the specific Discord server (guild) where you intend to deploy and use the bot.
  * **`APIKEY_WEATHER`**: An API key for a weather service (e.g., [OpenWeatherMap](https://openweathermap.org/)).
  * **`GEMINI_API_KEY`**: An API key for accessing Google's Gemini models via [Google AI Studio](https://aistudio.google.com/).
  * **`MONGODB_URI`**: The connection string for your MongoDB database, used for data storage (e.g., chat history).

### Node.js Version

This project requires **Node.js version 20 or higher**.

**Recommendations:**

  * **Minimum Recommended:** Node.js **20**

Using an LTS (Long Term Support) version is always preferable for production environments as it provides stability and ongoing support. You can check your Node.js version using `node -v`. If you need to update, consider using a Node Version Manager like `nvm`.

-----

## 🚀 Installation and Usage

Follow these steps to set up and run the bot:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/tienDang0805/discord_gpt_bot.git
    cd racoon_8d_bot # Navigate to your project directory
    ```

2.  **Install Node.js dependencies:**

    ```bash
    npm install
    ```

    **Critical Note for Linux Servers (Voice Functionality):**
    For the voice features to work correctly, **FFmpeg** and the **Opus development library** must be installed on your system.

      * **For Debian/Ubuntu-based systems:**
        ```bash
        sudo apt update
        sudo apt install ffmpeg libopus-dev
        ```
      * **For CentOS/RHEL-based systems:**
        ```bash
        sudo yum install epel-release # if not already installed
        sudo yum install ffmpeg libopus-devel
        ```

    After installing these system packages, it is crucial to run `npm install` again to ensure that Node.js native modules (like `@discordjs/opus`) are compiled correctly against the newly available libraries.

3.  **Start the Bot:**
    You can start the bot directly:

    ```bash
    node index.js
    ```

    For persistent background operation, it's recommended to use a process manager like `pm2`:

    ```bash
    npm install -g pm2 # Install pm2 globally if you haven't already
    pm2 start index.js --name "racoon-8d-bot"
    pm2 save
    pm2 startup # Follow instructions to enable pm2 on system startup
    ```

-----
