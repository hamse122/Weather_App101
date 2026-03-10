function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    const err = new Error(`Missing required environment variable: ${name}`);
    err.code = "MISSING_ENV";
    err.envVar = name;
    throw err;
  }
  return value;
}

function getEnv(name, defaultValue = undefined) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") return defaultValue;
  return value;
}

module.exports = { requireEnv, getEnv };

