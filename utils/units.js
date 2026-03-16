/**
 * Advanced Fetch JSON Utility
 */

class FetchError extends Error {
  constructor(message, { status, url, body }) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/* --------------------------------
   Helpers
-------------------------------- */

function buildUrl(url, params) {
  if (!params) return url;

  const u = new URL(url);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) {
      u.searchParams.append(k, v);
    }
  });

  return u.toString();
}

async function parseBody(res) {
  const contentType = res.headers?.get?.("content-type") || "";

  if (contentType.includes("application/json")) {
    return res.json();
  }

  return res.text();
}

/* --------------------------------
   Core Request
-------------------------------- */

async function fetchJson(url, options = {}) {

  const {
    method = "GET",
    headers = {},
    body,
    params,
    timeout = 10000,
    retries = 0
  } = options;

  const finalUrl = buildUrl(url, params);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {

    const res = await fetch(finalUrl, {
      method,
      headers: {
        "Accept": "application/json",
        ...headers
      },
      body:
        body && typeof body === "object"
          ? JSON.stringify(body)
          : body,
      signal: controller.signal
    });

    clearTimeout(timer);

    const parsedBody = await parseBody(res);

    if (!res.ok) {
      const message =
        parsedBody?.message ||
        parsedBody ||
        `Request failed (${res.status})`;

      throw new FetchError(message, {
        status: res.status,
        url: finalUrl,
        body: parsedBody
      });
    }

    return parsedBody;

  } catch (err) {

    if (retries > 0) {
      return fetchJson(url, { ...options, retries: retries - 1 });
    }

    if (err.name === "AbortError") {
      throw new FetchError("Request timeout", { url });
    }

    throw err;
  }
}

/* --------------------------------
   HTTP Helpers
-------------------------------- */

const get = (url, options = {}) =>
  fetchJson(url, { ...options, method: "GET" });

const post = (url, body, options = {}) =>
  fetchJson(url, { ...options, method: "POST", body });

const put = (url, body, options = {}) =>
  fetchJson(url, { ...options, method: "PUT", body });

const del = (url, options = {}) =>
  fetchJson(url, { ...options, method: "DELETE" });

/* --------------------------------
   Export
-------------------------------- */

module.exports = {
  fetchJson,
  get,
  post,
  put,
  del,
  FetchError
};
