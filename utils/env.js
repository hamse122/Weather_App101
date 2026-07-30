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

const __envCache = new Map();

function readEnv(
    name,
    {
        fallback,
        aliases = [],
        parser = v => v,
        validate = null,
        cache = true
    } = {}
) {
    const keys = [name, ...aliases];

    for (const key of keys) {
        if (cache && __envCache.has(key)) {
            return __envCache.get(key);
        }

        const raw = process.env[key];

        if (typeof raw !== "string") continue;

        const value = raw.trim();
        if (!value) continue;

        let parsed;

        try {
            parsed = parser(value);
        } catch (err) {
            throw new EnvError(
                `Invalid value for environment variable '${key}'`,
                key,
                {
                    received: value,
                    cause: err.message
                }
            );
        }

        if (validate && !validate(parsed)) {
            throw new EnvError(
                `Validation failed for environment variable '${key}'`,
                key,
                { received: parsed }
            );
        }

        if (cache) {
            __envCache.set(key, parsed);
        }

        return parsed;
    }

    return fallback;
}

function throwMissing(name, options = {}) {
    const {
        aliases = [],
        expected = "non-empty string",
        example
    } = options;

    const message = [
        `Missing required environment variable: ${name}`,
        aliases.length
            ? `Aliases checked: ${aliases.join(", ")}`
            : null,
        example
            ? `Example: ${name}=${example}`
            : null
    ]
        .filter(Boolean)
        .join("\n");

    throw new EnvError(message, name, {
        expected,
        received: "undefined, null, or empty string",
        aliases,
        example
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
