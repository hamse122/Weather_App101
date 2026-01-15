/**
 * Advanced REST Client
 * - Interceptors (request/response/error)
 * - Retries with exponential backoff
 * - Timeouts (global + per request)
 * - Auto JSON handling
 * - AbortController support
 */

class RestClient {
    constructor(baseURL = '', options = {}) {
        this.baseURL = baseURL.replace(/\/+$/, '');
        this.fetchImpl = options.fetch || globalThis.fetch;

        if (!this.fetchImpl) {
            throw new Error('Fetch implementation not available');
        }

        this.defaultHeaders = this.normalizeHeaders(options.headers || {});
        this.timeout = options.timeout ?? 10000;

        this.retry = {
            attempts: options.retryAttempts ?? 0,
            baseDelay: options.retryDelay ?? 300,
            maxDelay: options.maxRetryDelay ?? 3000,
            retryOn: options.retryOn ?? [408, 429, 500, 502, 503, 504]
        };

        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];

        this.transformRequest = options.transformRequest ?? (cfg => cfg);
        this.transformResponse = options.transformResponse ?? (res => res);
    }

    /* ================= INTERCEPTORS ================= */

    useRequest(fn) {
        this.requestInterceptors.push(fn);
        return this;
    }

    useResponse(fn) {
        this.responseInterceptors.push(fn);
        return this;
    }

    useError(fn) {
        this.errorInterceptors.push(fn);
        return this;
    }

    /* ================= CORE REQUEST ================= */

    async request(endpoint, config = {}) {
        const controller = new AbortController();
        const timeout = config.timeout ?? this.timeout;

        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let requestConfig = {
            method: config.method || 'GET',
            headers: this.normalizeHeaders({
                ...this.defaultHeaders,
                ...config.headers
            }),
            body: config.body,
            signal: config.signal || controller.signal
        };

        requestConfig = this.transformRequest(requestConfig);

        for (const interceptor of this.requestInterceptors) {
            requestConfig = (await interceptor(requestConfig)) || requestConfig;
        }

        const url = this.buildURL(endpoint);

        const execute = async (attempt = 0) => {
            try {
                let response = await this.fetchImpl(url, requestConfig);

                for (const interceptor of this.responseInterceptors) {
                    response = (await interceptor(response)) || response;
                }

                if (!response.ok) {
                    const error = await this.createHttpError(response);
                    if (this.shouldRetry(response.status, attempt)) {
                        await this.backoff(attempt);
                        return execute(attempt + 1);
                    }
                    throw error;
                }

                return this.transformResponse(await this.parseResponse(response));

            } catch (err) {
                for (const interceptor of this.errorInterceptors) {
                    err = (await interceptor(err)) || err;
                }

                if (this.shouldRetry(err, attempt)) {
                    await this.backoff(attempt);
                    return execute(attempt + 1);
                }

                throw err;
            }
        };

        try {
            return await execute();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /* ================= HELPERS ================= */

    buildURL(endpoint) {
        if (/^https?:\/\//i.test(endpoint)) return endpoint;
        return `${this.baseURL}/${endpoint.replace(/^\/+/, '')}`;
    }

    normalizeHeaders(headers = {}) {
        const normalized = {};
        for (const key in headers) {
            normalized[key.toLowerCase()] = headers[key];
        }
        return normalized;
    }

    shouldRetry(reason, attempt) {
        if (attempt >= this.retry.attempts) return false;
        if (typeof reason === 'number') return this.retry.retryOn.includes(reason);
        if (reason?.name === 'AbortError') return true;
        return false;
    }

    async backoff(attempt) {
        const exp = Math.min(
            this.retry.baseDelay * 2 ** attempt,
            this.retry.maxDelay
        );
        const jitter = Math.random() * 100;
        await new Promise(r => setTimeout(r, exp + jitter));
    }

    async parseResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    }

    async createHttpError(response) {
        let data;
        try {
            data = await this.parseResponse(response);
        } catch {
            data = null;
        }

        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        error.headers = Object.fromEntries(response.headers.entries());
        return error;
    }

    /* ================= HTTP METHODS ================= */

    get(url, config) {
        return this.request(url, { ...config, method: 'GET' });
    }

    post(url, body, config = {}) {
        return this.request(url, {
            ...config,
            method: 'POST',
            body: this.prepareBody(body, config)
        });
    }

    put(url, body, config = {}) {
        return this.request(url, {
            ...config,
            method: 'PUT',
            body: this.prepareBody(body, config)
        });
    }

    patch(url, body, config = {}) {
        return this.request(url, {
            ...config,
            method: 'PATCH',
            body: this.prepareBody(body, config)
        });
    }

    delete(url, config) {
        return this.request(url, { ...config, method: 'DELETE' });
    }

    prepareBody(body, config) {
        if (body == null) return undefined;
        const headers = this.normalizeHeaders(config.headers || {});
        if (headers['content-type']?.includes('application/json')) {
            return JSON.stringify(body);
        }
        return body;
    }
}

module.exports = RestClient;
