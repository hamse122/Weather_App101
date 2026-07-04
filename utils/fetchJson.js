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
   Helpers (Enterprise)
-------------------------------- */

function buildUrl(url, params = {}, options = {}) {
    if (!params || Object.keys(params).length === 0) {
        return url;
    }

    const {
        base,
        arrayFormat = "repeat" // repeat | comma
    } = options;

    const u = new URL(url, base);

    for (const [key, value] of Object.entries(params)) {

        if (value == null) continue;

        // Arrays
        if (Array.isArray(value)) {

            if (arrayFormat === "comma") {
                u.searchParams.set(key, value.join(","));
            } else {
                for (const item of value) {
                    if (item != null) {
                        u.searchParams.append(key, String(item));
                    }
                }
            }

            continue;
        }

        // Dates
        if (value instanceof Date) {
            u.searchParams.set(key, value.toISOString());
            continue;
        }

        // Objects
        if (typeof value === "object") {
            u.searchParams.set(key, JSON.stringify(value));
            continue;
        }

        u.searchParams.set(key, String(value));
    }

    return u.toString();
}

async function parseBody(response, { throwOnError = false } = {}) {

    const contentType =
        response.headers?.get("content-type")?.toLowerCase() || "";

    let body = null;

    try {

        // No Content
        if (
            response.status === 204 ||
            response.status === 205
        ) {
            body = null;
        }

        else if (contentType.includes("application/json")) {
            body = await response.json();
        }

        else if (
            contentType.startsWith("text/") ||
            contentType.includes("xml") ||
            contentType.includes("html")
        ) {
            body = await response.text();
        }

        else if (contentType.includes("form-data")) {
            body = await response.formData();
        }

        else if (
            contentType.includes("application/octet-stream")
        ) {
            body = await response.arrayBuffer();
        }

        else {
            body = await response.blob();
        }

    } catch {
        body = null;
    }

    if (throwOnError && !response.ok) {
        const error = new Error(
            `HTTP ${response.status} ${response.statusText}`
        );

        error.status = response.status;
        error.statusText = response.statusText;
        error.body = body;
        error.response = response;

        throw error;
    }

    return body;
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
