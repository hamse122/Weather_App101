async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);

  let body;
  const contentType = res.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && body.message) ||
      (typeof body === "string" && body) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.url = url;
    err.body = body;
    throw err;
  }

  return body;
}

module.exports = { fetchJson };

