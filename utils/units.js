/**
 * Weather / Unit Utilities
 * Small, dependency-free helpers for temperature, speed, and rounding
 */

/* ---------- CONSTANTS ---------- */

const KELVIN_OFFSET = 273.15;
const MS_TO_KMH = 3.6;
const KMH_TO_MS = 1 / 3.6;

/* ---------- INTERNAL VALIDATION ---------- */

function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/* ---------- TEMPERATURE ---------- */

/**
 * Kelvin → Celsius
 * @param {number} kelvin
 * @returns {number|null}
 */
function toCelsius(kelvin) {
  if (!isValidNumber(kelvin)) return null;
  return kelvin - KELVIN_OFFSET;
}

/**
 * Celsius → Fahrenheit
 * @param {number} celsius
 * @returns {number|null}
 */
function toFahrenheit(celsius) {
  if (!isValidNumber(celsius)) return null;
  return (celsius * 9) / 5 + 32;
}

/**
 * Kelvin → Fahrenheit
 * @param {number} kelvin
 * @returns {number|null}
 */
function kelvinToFahrenheit(kelvin) {
  if (!isValidNumber(kelvin)) return null;
  return toFahrenheit(toCelsius(kelvin));
}

/**
 * Celsius → Kelvin
 * @param {number} celsius
 * @returns {number|null}
 */
function toKelvin(celsius) {
  if (!isValidNumber(celsius)) return null;
  return celsius + KELVIN_OFFSET;
}

/* ---------- SPEED ---------- */

/**
 * m/s → km/h
 * @param {number} ms
 * @returns {number|null}
 */
function msToKmh(ms) {
  if (!isValidNumber(ms)) return null;
  return ms * MS_TO_KMH;
}

/**
 * km/h → m/s
 * @param {number} kmh
 * @returns {number|null}
 */
function kmhToMs(kmh) {
  if (!isValidNumber(kmh)) return null;
  return kmh * KMH_TO_MS;
}

/* ---------- ROUNDING ---------- */

/**
 * Round number with safe decimal limits
 * @param {number} value
 * @param {number} decimals
 * @returns {number|null}
 */
function round(value, decimals = 0) {
  if (!isValidNumber(value)) return null;

  const d = Math.max(0, Math.min(10, decimals | 0));
  const factor = 10 ** d;

  return Math.round(value * factor) / factor;
}

/**
 * Round and format number
 * @param {number} value
 * @param {number} decimals
 * @returns {string|null}
 */
function format(value, decimals = 2) {
  const r = round(value, decimals);
  return r === null ? null : r.toFixed(decimals);
}

/* ---------- EXPORTS ---------- */

module.exports = {
  // temperature
  toCelsius,
  toFahrenheit,
  toKelvin,
  kelvinToFahrenheit,

  // speed
  msToKmh,
  kmhToMs,

  // numbers
  round,
  format
};
