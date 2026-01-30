/**
 * API Service Utilities (Upgraded)
 */

class ApiError extends Error {
    constructor(message, { status, url, body } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.url = url;
        this.body = body;
    }
}

/* =========================
   Core Request Function
========================= */

async function request(method, url, {
    data,
    params,
    headers = {},
    timeout = 10000,
    retries = 0,
    retryDelay = 300,
    token,
    beforeRequest,
    afterResponse,
    onError,
    ...fetchOptions
} = {}) {
    // Build query params
    if (params) {
        const qs = new URLSearchParams(params).toString();
        url += (url.includes('?') ? '&' : '?') + qs;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const config = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...headers
        },
        signal: controller.signal,
        ...(data && { body: JSON.stringify(data) }),
        ...fetchOptions
    };

    try {
        beforeRequest?.(config);

        const response = await fetch(url, config);
        clearTimeout(timer);

        const contentType = response.headers.get('content-type');
        const body = contentType?.includes('application/json')
            ? await response.json()
            : await response.text();

        afterResponse?.(response, body);

        if (!response.ok) {
            throw new ApiError(
                `HTTP ${response.status}`,
                { status: response.status, url, body }
            );
        }

        return body;
    } catch (err) {
        clearTimeout(timer);

        if (retries > 0 && err.name !== 'AbortError') {
            await new Promise(r =>
                setTimeout(r, retryDelay * 2)
            );
            return request(method, url, {
                data,
                params,
                headers,
                timeout,
                retries: retries - 1,
                retryDelay,
                token,
                beforeRequest,
                afterResponse,
                onError,
                ...fetchOptions
            });
        }

        onError?.(err);
        throw err;
    }
}

/* =========================
   HTTP Methods
========================= */

export const get = (url, options) =>
    request('GET', url, options);

export const post = (url, data, options = {}) =>
    request('POST', url, { ...options, data });

export const put = (url, data, options = {}) =>
    request('PUT', url, { ...options, data });

export const del = (url, options) =>
    request('DELETE', url, options);

/* =========================
   Optional Factory
========================= */

export function createApiClient(baseURL, defaults = {}) {
    return {
        get: (path, opts) =>
            get(baseURL + path, { ...defaults, ...opts }),

        post: (path, data, opts) =>
            post(baseURL + path, data, { ...defaults, ...opts }),

        put: (path, data, opts) =>
            put(baseURL + path, data, { ...defaults, ...opts }),

        del: (path, opts) =>
            del(baseURL + path, { ...defaults, ...opts })
    };
}
