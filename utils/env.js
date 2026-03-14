/**
 * Environment Variable Utilities v2
 * Safe environment loader for Node.js
 */

/* --------------------------------
   Error
-------------------------------- */

class EnvError extends Error {
  constructor(message, envVar) {
    super(message);
    this.name = "EnvError";
    this.code = "MISSING_ENV";
    this.envVar = envVar;
  }
}

/* --------------------------------
   Helpers
-------------------------------- */

function readEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/* --------------------------------
   Required Env
-------------------------------- */

function requireEnv(name) {
  const value = readEnv(name);

  if (value === undefined) {
    throw new EnvError(`Missing required environment variable: ${name}`, name);
  }

  return value;
}

/* --------------------------------
   Optional Env
-------------------------------- */

function getEnv(name, defaultValue = undefined) {
  const value = readEnv(name);
  return value === undefined ? defaultValue : value;
}

/* --------------------------------
   Typed Getters
-------------------------------- */

function getNumber(name, defaultValue) {
  const value = readEnv(name);

  if (value === undefined) return defaultValue;

  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new EnvError(`Environment variable ${name} must be a number`, name);
  }

  return num;
}

function getBoolean(name, defaultValue = false) {
  const value = readEnv(name);

  if (value === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getList(name, separator = ",") {
  const value = readEnv(name);
  if (!value) return [];

  return value.split(separator).map(v => v.trim()).filter(Boolean);
}

/* --------------------------------
   Validators
-------------------------------- */

function requireOneOf(name, allowed) {
  const value = requireEnv(name);

  if (!allowed.includes(value)) {
    throw new EnvError(
      `Invalid value for ${name}. Allowed: ${allowed.join(", ")}`,
      name
    );
  }

  return value;
}

/* --------------------------------
   Export
-------------------------------- */

module.exports = {
  requireEnv,
  getEnv,
  getNumber,
  getBoolean,
  getList,
  requireOneOf,
  EnvError
};
