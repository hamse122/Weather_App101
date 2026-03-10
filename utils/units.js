function toCelsius(kelvin) {
  if (typeof kelvin !== "number" || !Number.isFinite(kelvin)) return null;
  return kelvin - 273.15;
}

function toFahrenheit(celsius) {
  if (typeof celsius !== "number" || !Number.isFinite(celsius)) return null;
  return (celsius * 9) / 5 + 32;
}

function msToKmh(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return ms * 3.6;
}

function round(value, decimals = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const d = Math.max(0, Math.min(10, decimals | 0));
  const factor = 10 ** d;
  return Math.round(value * factor) / factor;
}

module.exports = { toCelsius, toFahrenheit, msToKmh, round };

