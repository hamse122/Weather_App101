/**
 * Environment Variable Utilities v3
 * Hardened env loader with strict validation, type-safe getters,
 * and rich error diagnostics.
 */

class EnvError extends Error {
  constructor(message, envVar, details = {}) {
    super(message);
    this.name = "EnvError";
    this.code = "ENV_VALIDATION_ERROR";
    this.envVar = envVar;
    this.details = details;
  }
}

/* --------------------------------------------------------
   Helpers
-------------------------------------------------------- */

function readEnv(name) {
  const raw = process.env[name];

  if (typeof raw !== "string") return undefined;

  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function throwMissing(name) {
  throw new EnvError(`Missing required environment variable: ${name}`, name, {
    expected: "non-empty string",
    received: "undefined or empty"
  });
}

/* --------------------------------------------------------
   Required / Optional
-------------------------------------------------------- */

function requireEnv(name) {
  const value = readEnv(name);
  if (value === undefined) throwMissing(name);
  return value;
}

function getEnv(name, defaultValue = undefined) {
  const value = readEnv(name);
  return value === undefined ? defaultValue : value;
}

/* --------------------------------------------------------
   Type Helpers
-------------------------------------------------------- */

function getInt(name, defaultValue) {
  const v = readEnv(name);
  if (v === undefined) return defaultValue;

  const n = Number(v);

  if (!Number.isInteger(n)) {
    throw new EnvError(
      `Environment variable ${name} must be an integer`,
      name,
      { expected: "integer", received: v }
    );
  }

  return n;
}

function getFloat(name, defaultValue) {
  const v = readEnv(name);
  if (v === undefined) return defaultValue;

  const n = Number(v);

  if (!Number.isFinite(n)) {
    throw new EnvError(
      `Environment variable ${name} must be a finite number`,
      name,
      { expected: "finite number", received: v }
    );
  }

  return n;
}

function getBoolean(name, defaultValue = false) {
  const v = readEnv(name);
  if (v === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function getList(name, separator = ",", defaultValue = []) {
  const v = readEnv(name);
  if (!v) return defaultValue;

  return v
    .split(separator)
    .map(x => x.trim())
    .filter(Boolean);
}

function getJson(name, defaultValue) {
  const v = readEnv(name);
  if (v === undefined) return defaultValue;

  try {
    return JSON.parse(v);
  } catch (err) {
    throw new EnvError(
      `Environment variable ${name} contains invalid JSON`,
      name,
      { received: v }
    );
  }
}

function getUrl(name, defaultValue) {
  const v = readEnv(name);
  if (v === undefined) return defaultValue;

  try {
    return new URL(v);
  } catch {
    throw new EnvError(
      `Environment variable ${name} must contain a valid URL`,
      name,
      { received: v }
    );
  }
}

/* --------------------------------------------------------
   Validators
-------------------------------------------------------- */

function requireOneOf(name, allowed) {
  const value = requireEnv(name);

  if (!allowed.includes(value)) {
    throw new EnvError(
      `Invalid value for ${name}. Allowed: ${allowed.join(", ")}`,
      name,
      { expected: allowed, received: value }
    );
  }

  return value;
}

function requireUrl(name) {
  const v = requireEnv(name);
  try {
    return new URL(v);
  } catch {
    throw new EnvError(`Invalid URL: ${name}`, name, { received: v });
  }
}

/* --------------------------------------------------------
   Debug / Inspection Tools
-------------------------------------------------------- */

function ensureAll(requiredKeys = []) {
  const missing = requiredKeys.filter(k => readEnv(k) === undefined);

  if (missing.length) {
    throw new EnvError(
      `Missing required environment variables: ${missing.join(", ")}`,
      missing,
      { expected: "all present" }
    );
  }

  return true;
}

function logLoaded(prefix = "[ENV]") {
  console.log(prefix, JSON.stringify(process.env, null, 2));
}


/* --------------------------------------------------------
 Date 
-------------------------------------------------------- */


getDate(key, defaultValue = null) {
  const value = this.get(key);

  if (!value) return defaultValue;

  const date = new Date(value);
  return isNaN(date.getTime()) ? defaultValue : date;
}

/* --------------------------------------------------------
   Export API
-------------------------------------------------------- */

module.exports = {
  // Base
  requireEnv,
  getEnv,

  // Typed Getters
  getInt,
  getFloat,
  getNumber: getFloat,
  getBoolean,
  getList,
  getJson,
  getUrl,
  getDate,

  // Validators
  requireOneOf,
  requireUrl,
  ensureAll,

  // Debug
  logLoaded,

  // Error
  EnvError
};
