/**
 * Weather / Display Formatters v2
 */

/* --------------------------------
   Helpers
-------------------------------- */

function isValidNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, decimals = 0) {
  const d = clamp(decimals | 0, 0, 5);
  const f = 10 ** d;
  return Math.round(value * f) / f;
}

/* --------------------------------
   City
-------------------------------- */

function formatCityLabel(name, country) {
  const n = typeof name === "string" ? name.trim() : "";
  const c = typeof country === "string" ? country.trim() : "";

  if (!n && !c) return "";
  if (!c) return n;
  if (!n) return c;

  return `${n}, ${c}`;
}

/* --------------------------------
   Temperature
-------------------------------- */

function formatTemp(value, {
  unit = "C",
  decimals = 1
} = {}) {

  if (!isValidNumber(value)) return "";

  const v = round(value, decimals);

  if (unit === "F") {
    return `${v}°F`;
  }

  return `${v}°C`;
}

/* --------------------------------
   Wind
-------------------------------- */

function msToKmh(ms) {
  return ms * 3.6;
}

function getBeaufort(ms) {
  const scale = [
    0, 0.5, 1.5, 3.3, 5.5, 7.9,
    10.7, 13.8, 17.1, 20.7,
    24.4, 28.4, 32.6
  ];

  return scale.findIndex(v => ms <= v);
}

function formatWind(valueMs, {
  unit = "m/s",
  decimals = 1,
  withScale = false
} = {}) {

  if (!isValidNumber(valueMs)) return "";

  let value = valueMs;
  let label = "m/s";

  if (unit === "km/h") {
    value = msToKmh(valueMs);
    label = "km/h";
  }

  const result = `${round(value, decimals)} ${label}`;

  if (!withScale) return result;

  const scale = getBeaufort(valueMs);
  return `${result} (Bft ${scale})`;
}

/* --------------------------------
   Percentage
-------------------------------- */

function formatPercent(value, {
  decimals = 0,
  clampRange = true
} = {}) {

  if (!isValidNumber(value)) return "";

  let v = value;

  if (clampRange) {
    v = clamp(v, 0, 100);
  }

  return `${round(v, decimals)}%`;
}

/* --------------------------------
   Generic Number Formatter
-------------------------------- */

function formatNumber(value, {
  decimals = 0,
  suffix = ""
} = {}) {

  if (!isValidNumber(value)) return "";
  return `${round(value, decimals)}${suffix}`;
}

/* --------------------------------
   Export
-------------------------------- */

module.exports = {
  formatCityLabel,
  formatTemp,
  formatWind,
  formatPercent,
  formatNumber
};
