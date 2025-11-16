// pages/api/weather.js

export default async function handler(req, res) {
  try {
    res.setHeader("Content-Type", "application/json");

    const { q, include, forecast } = req.query;
    const includeForecast = include === "forecast" || forecast === "1";

    // Validate city
    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing city parameter (?q=city)",
      });
    }

    const API_KEY = process.env.OPENWEATHER_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Missing OPENWEATHER_KEY in environment",
      });
    }

    // Prepare URLs
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      q
    )}&units=metric&appid=${API_KEY}`;

    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
      q
    )}&units=metric&appid=${API_KEY}`;

    // Fetch current + forecast in parallel when needed
    const requests = includeForecast
      ? [fetch(currentUrl), fetch(forecastUrl)]
      : [fetch(currentUrl)];

    const responses = await Promise.all(requests);
    const data = await Promise.all(responses.map((r) => r.json()));

    const currentData = data[0];

    // Handle error for current weather
    if (!responses[0].ok) {
      return res.status(responses[0].status).json({
        success: false,
        error: currentData?.message || "Unable to fetch current weather",
      });
    }

    let forecastData = null;

    // Handle forecast only if enabled
    if (includeForecast) {
      forecastData = data[1];

      if (!responses[1].ok) {
        return res.status(responses[1].status).json({
          success: false,
          error: forecastData?.message || "Unable to fetch forecast",
        });
      }
    }

    // Final response
    return res.status(200).json({
      success: true,
      city: q,
      current: currentData,
      forecast: includeForecast ? forecastData : undefined,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Server error",
    });
  }
}
