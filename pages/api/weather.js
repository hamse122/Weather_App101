// pages/api/weather.js  (or your existing file)
export default async function handler(req, res) {
  try {
    const q = req.query.q;
    const includeForecast =
      req.query.include === "forecast" || req.query.forecast === "1";

    if (!q) return res.status(400).json({ error: "Missing city ?q=" });

    const API_KEY = process.env.OPENWEATHER_KEY;
    if (!API_KEY) return res.status(500).json({ error: "Missing OPENWEATHER_KEY" });

    // Current weather
    const currentUrl =
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&units=metric&appid=${API_KEY}`;
    const currentRes = await fetch(currentUrl);
    const currentData = await currentRes.json();
    if (!currentRes.ok) {
      return res.status(currentRes.status).json({ error: currentData?.message || "Weather fetch failed" });
    }

    // Optionally pull 5-day forecast
    let forecastData = null;
    if (includeForecast) {
      const forecastUrl =
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(q)}&units=metric&appid=${API_KEY}`;
      const fRes = await fetch(forecastUrl);
      forecastData = await fRes.json();
      if (!fRes.ok) {
        return res.status(fRes.status).json({ error: forecastData?.message || "Forecast fetch failed" });
      }
    }

    // Return current + optional forecast
    return res.status(200).json(
      includeForecast
        ? { ...currentData, forecast: forecastData }
        : currentData
    );
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
