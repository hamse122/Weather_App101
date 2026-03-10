function formatCityLabel(name, country) {
  const n = typeof name === "string" ? name.trim() : "";
  const c = typeof country === "string" ? country.trim() : "";
  if (!n && !c) return "";
  if (!c) return n;
  if (!n) return c;
  return `${n}, ${c}`;
}

function formatTempC(value, decimals = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const d = Math.max(0, Math.min(3, decimals | 0));
  return `${value.toFixed(d)}°C`;
}

function formatWind(valueMs) {
  if (typeof valueMs !== "number" || !Number.isFinite(valueMs)) return "";
  return `${valueMs} m/s`;
}

function formatPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return `${value}%`;
}

module.exports = { formatCityLabel, formatTempC, formatWind, formatPercent };

