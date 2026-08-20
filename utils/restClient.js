class RestClient {
    constructor(baseURL = '', options = {}) {
        this.baseURL = baseURL.replace(/\/+$/, '');
        this.fetchImpl = options.fetch ?? globalThis.fetch;

        if (typeof this.fetchImpl !== 'function') {
            throw new Error('Fetch implementation not available');
        }

        this.defaultHeaders = this.normalizeHeaders(options.headers);
        this.timeout = options.timeout ?? 10000;

        this.retry = {
            attempts: Math.max(0, options.retryAttempts ?? 0),
            baseDelay: options.retryDelay ?? 300,
            maxDelay: options.maxRetryDelay ?? 3000,
            retryOn: new Set(
                options.retryOn ?? [408, 429, 500, 502, 503, 504]
            ),
            retryFn: options.retryFn
        };

        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.errorInterceptors = [];

        this.transformRequest =
            options.transformRequest ?? (config => config);

        this.transformResponse =
            options.transformResponse ?? (response => response);
    }

    useRequest(fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('Request interceptor must be a function');
        }

        this.requestInterceptors.push(fn);
        return this;
    }

    useResponse(fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('Response interceptor must be a function');
        }

        this.responseInterceptors.push(fn);
        return this;
    }

    useError(fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('Error interceptor must be a function');
        }

        this.errorInterceptors.push(fn);
        return this;
    }

    async request(endpoint, config = {}) {
        const timeout = config.timeout ?? this.timeout;
        const timeoutController = new AbortController();

        const timeoutId =
            timeout > 0
                ? setTimeout(() => timeoutController.abort(), timeout)
                : null;

        const signal = this.mergeSignals(
            config.signal,
            timeout > 0 ? timeoutController.signal : null
        );

        let requestConfig = {
            ...config,
            method: String(config.method ?? 'GET').toUpperCase(),
            headers: this.normalizeHeaders({
                ...this.defaultHeaders,
                ...(config.headers ?? {})
            }),
            signal
        };

        requestConfig = await this.transformRequest(requestConfig);

        const url = this.buildURL(endpoint, config.params);

        for (const interceptor of this.requestInterceptors) {
            requestConfig =
                (await interceptor(requestConfig, url)) ??
                requestConfig;
        }

        const execute = async (attempt = 0) => {
            const startedAt =
                typeof performance !== 'undefined'
                    ? performance.now()
                    : Date.now();

            try {
                const response = await this.fetchImpl(
                    url,
                    requestConfig
                );

                const endedAt =
                    typeof performance !== 'undefined'
                        ? performance.now()
                        : Date.now();

                const duration = endedAt - startedAt;

                let processedResponse = response;

                for (const interceptor of this.responseInterceptors) {
                    processedResponse =
                        (await interceptor(
                            processedResponse.clone()
                        )) ?? processedResponse;
                }

                if (!processedResponse.ok) {
                    const error =
                        await this.createHttpError(processedResponse);

                    error.duration = duration;

                    if (
                        await this.shouldRetry(
                            processedResponse.status,
                            attempt,
                            error
                        )
                    ) {
                        await this.backoff(attempt);
                        return execute(attempt + 1);
                    }

                    throw error;
                }

                const result =
                    await this.parseResponse(processedResponse);

                return this.transformResponse(result, {
                    response: processedResponse,
                    url,
                    duration,
                    attempt
                });
            } catch (err) {
                let error = err;

                for (const interceptor of this.errorInterceptors) {
                    error =
                        (await interceptor(error)) ?? error;
                }

                if (
                    await this.shouldRetry(
                        error,
                        attempt
                    )
                ) {
                    await this.backoff(attempt);
                    return execute(attempt + 1);
                }

                throw error;
            }
        };

        try {
            return await execute();
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    buildURL(endpoint, params) {
        const url = /^https?:\/\//i.test(endpoint)
            ? new URL(endpoint)
            : new URL(
                  `${this.baseURL}/${String(endpoint).replace(/^\/+/, '')}`
              );

        if (params && typeof params === 'object') {
            for (const [key, value] of Object.entries(params)) {
                if (value === undefined || value === null) continue;

                if (Array.isArray(value)) {
                    value.forEach(v =>
                        url.searchParams.append(key, String(v))
                    );
                } else if (value instanceof Date) {
                    url.searchParams.append(
                        key,
                        value.toISOString()
                    );
                } else if (
                    typeof value === 'object'
                ) {
                    url.searchParams.append(
                        key,
                        JSON.stringify(value)
                    );
                } else {
                    url.searchParams.append(
                        key,
                        String(value)
                    );
                }
            }
        }

        return url.toString();
    }

    normalizeHeaders(headers = {}) {
        const normalized = {};

        if (headers instanceof Headers) {
            headers.forEach((value, key) => {
                normalized[key.toLowerCase()] = value;
            });

            return normalized;
        }

        for (const [key, value] of Object.entries(headers)) {
            if (value !== undefined && value !== null) {
                normalized[key.toLowerCase()] = String(value);
            }
        }

        return normalized;
    }

    mergeSignals(...signals) {
        const validSignals = signals.filter(Boolean);

        if (!validSignals.length) return undefined;

        const controller = new AbortController();

        const abort = () => {
            if (!controller.signal.aborted) {
                controller.abort();
            }
        };

        for (const signal of validSignals) {
            if (signal.aborted) {
                abort();
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

    async shouldRetry(reason, attempt, error) {
        if (attempt >= this.retry.attempts) {
            return false;
        }

        if (typeof this.retry.retryFn === 'function') {
            return Boolean(
                await this.retry.retryFn(
                    reason,
                    attempt,
                    error
                )
            );
        }

        if (typeof reason === 'number') {
            return this.retry.retryOn.has(reason);
        }

        if (reason?.name === 'AbortError') {
            return false;
        }

        if (reason instanceof TypeError) {
            return true;
        }

        return false;
    }

    async backoff(attempt) {
        const exponential = Math.min(
            this.retry.baseDelay * 2 ** attempt,
            this.retry.maxDelay
        );

        const jitter = Math.random() * exponential * 0.25;

        await new Promise(resolve =>
            setTimeout(
                resolve,
                exponential + jitter
            )
        );
    }

    async parseResponse(response) {
        if (response.status === 204 || response.status === 205) {
            return null;
        }

        const contentType =
            response.headers.get('content-type')?.toLowerCase() ?? '';

        if (contentType.includes('application/json')) {
            return response.json();
        }

        if (
            contentType.includes('application/octet-stream') ||
            contentType.includes('application/pdf') ||
            contentType.startsWith('image/') ||
            contentType.startsWith('audio/') ||
            contentType.startsWith('video/')
        ) {
            return response.arrayBuffer();
        }

        return response.text();
    }

    async createHttpError(response) {
        let data = null;

        try {
            data = await this.parseResponse(response);
        } catch {
            // Ignore response parsing failures.
        }

        const error = new Error(
            `HTTP ${response.status} ${response.statusText}`.trim()
        );

        error.name = 'HttpError';
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
            config.headers ?? {}
        );

        if (
            typeof body === 'object' &&
            !(body instanceof FormData) &&
            !(body instanceof Blob) &&
            !(body instanceof ArrayBuffer) &&
            !(body instanceof URLSearchParams)
        ) {
            if (!headers['content-type']) {
                headers['content-type'] =
                    'application/json';
            }

            config.headers = headers;

            return JSON.stringify(body);
        }

        return body;
    }

    get(url, config = {}) {
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

    delete(url, config = {}) {
        return this.request(url, {
            ...config,
            method: 'DELETE'
        });
    }
}

module.exports = RestClient;
