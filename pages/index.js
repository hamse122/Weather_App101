// AI Assistant Demo PR: harmless comment to trigger PR
import { useState, useRef, useEffect } from "react";

/**
 * Professional Weather App Home Page (2025)
 */
export default function Home({ initialWeather }) {
  const [city, setCity] = useState("");
  const [weather, setWeather] = useState(initialWeather);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef();

  // Auto-focus the city input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Turn 3h slices into 5 daily summaries
  function reduceToDaily(forecast) {
    const list = forecast?.list;
    if (!Array.isArray(list) || !list.length) return [];

    const byDate = {};
    for (const item of list) {
      const [dateStr] = item.dt_txt.split(" ");
      (byDate[dateStr] ||= []).push(item);
    }

    const days = Object.keys(byDate).sort().map((dateStr) => {
      const entries = byDate[dateStr];
      let min = Infinity, max = -Infinity;

      for (const e of entries) {
        if (typeof e.main?.temp_min === "number") min = Math.min(min, e.main.temp_min);
        if (typeof e.main?.temp_max === "number") max = Math.max(max, e.main.temp_max);
      }

      const noon = entries.find(e => e.dt_txt.includes("12:00:00")) || entries[Math.floor(entries.length / 2)];
      const w = noon.weather?.[0] || entries[0]?.weather?.[0] || {};

      return {
        dateStr,
        min: Number.isFinite(min) ? Math.round(min) : null,
        max: Number.isFinite(max) ? Math.round(max) : null,
        icon: w.icon,
        main: w.main,
        desc: w.description,
      };
    });

    return days.slice(0, 5);
  }

  // NOTE: Uses ?q= for city in backend now + include forecast
  async function fetchWeather(e) {
    e.preventDefault();
    setWeather(null);
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(city)}&include=forecast`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error fetching weather");
      setWeather(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const daily = reduceToDaily(weather?.forecast);

  return (
    <main style={styles.main}>
      {/* Header */}
      <header style={styles.header}>
        <img src="/logo-weather.svg" alt="WeatherPro Logo" style={styles.logo} />
        <h1 style={styles.title}>WeatherPro 2025</h1>
        <p style={styles.subtitle}>
          Modern, accurate forecasts at your fingertips.
        </p>
      </header>

      {/* Search */}
      <form onSubmit={fetchWeather} style={styles.form}>
        <input
          type="text"
          placeholder="Search for a city (e.g. Paris)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          ref={inputRef}
          style={styles.input}
          aria-label="City search"
          disabled={loading}
          required
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Getting weather..." : "Search"}
        </button>
      </form>

      {/* Errors */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Weather Card */}
      {!loading && weather?.main && (
        <section style={{ ...styles.card, animation: "fadein 0.7s" }} tabIndex={0}>
          <h2 style={styles.cardCity}>
            {weather.name}, <span style={styles.cardCountry}>{weather.sys.country}</span>
          </h2>
          <img
            src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`}
            alt={weather.weather[0].main}
            style={styles.icon}
          />
          <div style={styles.tempRow}>
            <span style={styles.temp}>{weather.main.temp.toFixed(1)}°C</span>
            <span style={styles.desc}>{weather.weather[0].description}</span>
          </div>
          <div style={styles.infoRow}>
            <div>
              <strong>Humidity</strong>
              <div>{weather.main.humidity}%</div>
            </div>
            <div>
              <strong>Feels Like</strong>
              <div>{weather.main.feels_like.toFixed(1)}°C</div>
            </div>
            <div>
              <strong>Wind</strong>
              <div>{weather.wind.speed} m/s</div>
            </div>
          </div>
        </section>
      )}

      {/* 5-Day Forecast (if backend included it) */}
      {!loading && daily?.length > 0 && (
        <section style={{ ...styles.card, ...styles.forecastCard }}>
          <h3 style={styles.forecastTitle}>5-Day Forecast</h3>
          <div style={styles.forecastGrid}>
            {daily.map((d) => (
              <article key={d.dateStr} style={styles.dayCard} aria-label={`Forecast for ${d.dateStr}`}>
                <div style={styles.dayName}>{formatDayName(d.dateStr)}</div>
                <img
                  src={`https://openweathermap.org/img/wn/${d.icon}@2x.png`}
                  alt={d.main || "weather icon"}
                  style={styles.dayIcon}
                />
                <div style={styles.dayDesc}>{d.desc}</div>
                <div style={styles.dayTemps}>
                  <span style={styles.maxTemp}>{d.max ?? "—"}°</span>
                  <span style={styles.minTemp}>{d.min ?? "—"}°</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Global styles unchanged */}
      <style jsx global>{`
        @keyframes fadein {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: none; }
        }
        body {
          margin: 0;
          background: #ededf3;
          font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        }
        @media (max-width: 600px) {
          main { padding: 0 2vw; }
          section { margin: 12px 0; padding: 16px; font-size: 16px; }
          h1 { font-size: 2rem; }
          .input, .button { width: 100%; margin: 6px 0; }
        }
      `}</style>
    </main>
  );
}

function formatDayName(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// Server-side fetch for default city (London) WITH forecast
export async function getServerSideProps() {
  let initialWeather = null;
  try {
    const res = await fetch(`http://localhost:3000/api/weather?q=London&include=forecast`);
    initialWeather = await res.json();
  } catch {
    initialWeather = null;
  }
  return { props: { initialWeather } };
}

// --- Styling ---
const theme = {
  accent: "#2a8cf9",
  card: "#fff",
  border: "#e3e8ee",
  err: "#e63946",
};
const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 0",
    background: "#ededf3",
  },
  header: { textAlign: "center", marginBottom: 32 },
  logo: { width: 64, height: 64, marginBottom: 6 },
  title: { fontSize: "2.3rem", margin: 0, fontWeight: 800, color: theme.accent, letterSpacing: "-0.03em" },
  subtitle: { fontSize: "1.05rem", color: "#66687c", margin: "4px 0 0 0" },
  form: { display: "flex", gap: 12, width: "100%", maxWidth: 380, margin: "0 auto 32px auto", justifyContent: "center" },
  input: {
    flex: 1, fontSize: "1rem", padding: "10px 12px", border: `1px solid ${theme.border}`,
    borderRadius: 6, outline: "none", minWidth: 0, transition: "border 0.2s", marginRight: 4,
  },
  button: {
    background: theme.accent, color: "#fff", border: "none", borderRadius: 6,
    padding: "10px 18px", fontSize: "1rem", cursor: "pointer", fontWeight: 600, transition: "background 0.2s",
  },
  error: {
    color: theme.err, padding: "10px 16px", background: "#fff5f6",
    border: `1px solid ${theme.err}33`, margin: "7px 0 20px 0", borderRadius: 5, fontWeight: 500,
  },
  card: {
    width: "100%", maxWidth: 400, background: theme.card, borderRadius: 12, padding: 28,
    margin: "0 auto 0 auto", boxShadow: "0 2px 12px 0 #adbeea22", display: "flex", flexDirection: "column", alignItems: "center",
  },
  cardCity: { margin: 0, fontSize: "1.4rem", fontWeight: 700, color: theme.accent },
  cardCountry: { fontWeight: 400, color: "#6374a5", fontSize: 18 },
  icon: {
    margin: "16px 0 12px 0", width: 84, height: 84, display: "block",
    background: "#f3f8ff", borderRadius: "50%", border: "1px solid #e4eaf6",
  },
  tempRow: { display: "flex", alignItems: "center", gap: 14 },
  temp: { fontSize: "2.4rem", fontWeight: 700, marginRight: 8, color: "#011b39" },
  desc: { fontSize: 20, textTransform: "capitalize", color: "#616886" },
  infoRow: { display: "flex", gap: 32, marginTop: 16, justifyContent: "center", fontSize: 17, width: "100%", textAlign: "center" },

  // Forecast styles
  forecastCard: { marginTop: 20, alignItems: "stretch" },
  forecastTitle: { margin: "0 0 16px 0", color: "#0e1f3a", fontSize: "1.1rem", fontWeight: 700 },
  forecastGrid: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 },
  dayCard: { border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12, textAlign: "center", background: "#f9fbff" },
  dayName: { fontWeight: 700, fontSize: 14, color: "#344767", marginBottom: 6 },
  dayIcon: { width: 64, height: 64, margin: "4px auto" },
  dayDesc: { fontSize: 13, color: "#5c6f92", textTransform: "capitalize", minHeight: 18 },
  dayTemps: { display: "flex", justifyContent: "center", gap: 8, marginTop: 6 },
  maxTemp: { fontWeight: 700, color: "#0f1f3c" },
  minTemp: { color: "#7183a3" },
};
