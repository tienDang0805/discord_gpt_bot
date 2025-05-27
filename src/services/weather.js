// weather.js
const fetch = require('node-fetch');
require('dotenv').config();

async function getWeatherDescription() {
  const lat = 10.7751;
  const lon = 106.682;
  const apiKey = process.env.APIKEY_WEATHER;
  const url = `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=vi`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const temperature = data.main.temp;
    const description = data.weather[0].description;
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;

    const weatherDescription = `🌤️ **Thời tiết hiện tại ở TP.HCM**:\n` +
      `🌡️ Nhiệt độ: ${temperature}°C\n` +
      `🌥️ Trạng thái: ${description}\n` +
      `💧 Độ ẩm: ${humidity}%\n` +
      `💨 Gió: ${windSpeed} m/s`;

    return weatherDescription;

  } catch (error) {
    console.error('❌ Lỗi khi gọi API thời tiết:', error);
    return '⚠️ Không lấy được dữ liệu thời tiết!';
  }
}

module.exports = { getWeatherDescription };
