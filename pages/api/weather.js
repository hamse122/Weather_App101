export default async function handler(req, res) {
  const { q } = req.query; // city name (e.g., ?q=London)
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing API key" });
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'" });

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${apiKey}&units=metric`;

  try {
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    const data = await r.json();
    // You can pick only the fields you need before returning.
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
