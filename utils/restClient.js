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
            retryOn: options.retryOn ?? [408, 429, 500, 502, 503, 504],
            retryFn: options.retryFn
        };

        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];

        this.transformRequest =
            options.transformRequest ?? (cfg => cfg);

        this.transformResponse =
            options.transformResponse ?? (res => res);
    }

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

    async request(endpoint, config = {}) {
        const timeout = config.timeout ?? this.timeout;

        const timeoutController = new AbortController();

        const timeoutId = setTimeout(
            () => timeoutController.abort(),
            timeout
        );

        const signal = this.mergeSignals(
            config.signal,
            timeoutController.signal
        );

        let requestConfig = {
            method: config.method || 'GET',
            headers: this.normalizeHeaders({
                ...this.defaultHeaders,
                ...config.headers
            }),
            body: config.body,
            signal
        };

        requestConfig = this.transformRequest(requestConfig);

        const url = this.buildURL(endpoint, config.params);

        for (const interceptor of this.requestInterceptors) {
            requestConfig =
                (await interceptor(requestConfig, url)) ||
                requestConfig;
        }

        const execute = async (attempt = 0) => {
            const start = performance.now();

            try {
                let response = await this.fetchImpl(
                    url,
                    requestConfig
                );

                response.duration =
                    performance.now() - start;

                for (const interceptor of this.responseInterceptors) {
                    response =
                        (await interceptor(response.clone())) ||
                        response;
                }

                if (!response.ok) {
                    const error =
                        await this.createHttpError(response);

                    if (
                        this.shouldRetry(
                            response.status,
                            attempt,
                            error
                        )
                    ) {
                        await this.backoff(attempt);
                        return execute(attempt + 1);
                    }

                    throw error;
                }

                return this.transformResponse(
                    await this.parseResponse(response)
                );
            } catch (err) {
                for (const interceptor of this.errorInterceptors) {
                    err =
                        (await interceptor(err)) || err;
                }

                if (
                    this.shouldRetry(
                        err,
                        attempt
                    )
                ) {
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

    buildURL(endpoint, params) {
        const url = /^https?:\/\//i.test(endpoint)
            ? new URL(endpoint)
            : new URL(
                  `${this.baseURL}/${endpoint.replace(/^\/+/, '')}`
              );

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    url.searchParams.append(k, v);
                }
            });
        }

        return url.toString();
    }

    normalizeHeaders(headers = {}) {
        const normalized = {};

        for (const key in headers) {
            normalized[key.toLowerCase()] = headers[key];
        }

        return normalized;
    }

    mergeSignals(...signals) {
        const controller = new AbortController();

        const abort = () => controller.abort();

        for (const signal of signals) {
            if (!signal) continue;

            if (signal.aborted) {
                controller.abort();
                break;
            }

            signal.addEventListener(
                'abort',
                abort,
                { once: true }
            );
        }

        return controller.signal;
    }

    shouldRetry(reason, attempt, error) {
        if (attempt >= this.retry.attempts)
            return false;

        if (typeof this.retry.retryFn === 'function') {
            return this.retry.retryFn(
                reason,
                attempt,
                error
            );
        }

        if (typeof reason === 'number') {
            return this.retry.retryOn.includes(reason);
        }

        if (reason?.name === 'AbortError') {
            return true;
        }

        if (reason instanceof TypeError) {
            return true;
        }

        return false;
    }

    async backoff(attempt) {
        const delay = Math.min(
            this.retry.baseDelay * 2 ** attempt,
            this.retry.maxDelay
        );

        const jitter = Math.random() * delay * 0.25;

        await new Promise(resolve =>
            setTimeout(resolve, delay + jitter)
        );
    }

    async parseResponse(response) {
        const contentType =
            response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            return response.json();
        }

        if (
            contentType.includes('application/octet-stream')
        ) {
            return response.arrayBuffer();
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

        const error = new Error(
            `HTTP ${response.status} ${response.statusText}`
        );

        error.status = response.status;
        error.statusText = response.statusText;
        error.data = data;
        error.headers = Object.fromEntries(
            response.headers.entries()
        );

        return error;
    }

    prepareBody(body, config = {}) {
        if (body == null) return undefined;

        const headers = this.normalizeHeaders(
            config.headers || {}
        );

        if (
            typeof body === 'object' &&
            !(body instanceof FormData) &&
            !(body instanceof Blob)
        ) {
            if (!headers['content-type']) {
                headers['content-type'] =
                    'application/json';
                config.headers = headers;
            }

            return JSON.stringify(body);
        }

        return body;
    }

    get(url, config) {
        return this.request(url, {
            ...config,
            method: 'GET'
        });
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
        return this.request(url, {
            ...config,
            method: 'DELETE'
        });
    }
}

module.exports = RestClient;
