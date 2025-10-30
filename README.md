# WeatherPro 2025

![AI Assistant Demo PR](https://img.shields.io/badge/PR%20by-AI%20Assistant-blueviolet)

A modern, professional weather app built with Next.js.

## Features
- City weather search with real-time API data
- Professional, mobile-friendly UI
- Shows temperature (°C), humidity, wind, weather icon, and description
- Error messages and loading states for great UX
- API key is always kept secure on the server

## Getting Started
1. **Clone this repository**
2. **Install dependencies**:
   ```
   npm install
   ```
3. **Create a `.env.local` file** in the root:
   ```
   OPENWEATHER_API_KEY=your_openweathermap_api_key_here
   ```
   - (Get a free key at https://openweathermap.org/api)
4. **Run the development server**:
   ```
   npm run dev
   ```
   - Visit [http://localhost:3000](http://localhost:3000)

## Usage
- Enter any city (e.g. London, Nairobi, New York, Tokyo)
- See live weather info in Celsius, humidity, wind, and a useful weather icon/description

## Tech Stack
- [Next.js](https://nextjs.org/)
- React
- OpenWeatherMap API
- Modern CSS (no dependencies)

---

This project is designed for learning, demos, and further extension.
