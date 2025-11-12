// REST client supporting interceptors, retries, timeouts, and request/response transformation
class RestClient {
    constructor(baseURL = '', options = {}) {
        this.baseURL = baseURL.replace(/\/+$/, '');
        this.fetchImpl = options.fetch || (typeof fetch === 'function' ? fetch : null);
        if (!this.fetchImpl) {
            throw new Error('Fetch implementation not provided');
        }

        this.defaultHeaders = options.headers || {};
        this.timeout = options.timeout || 10000;
        this.retry = {
            attempts: options.retryAttempts || 0,
            delay: options.retryDelay || 300,
            retryOn: options.retryOn || [408, 429, 500, 502, 503, 504]
        };

        this.requestInterceptors = [];
        this.responseInterceptors = [];
        this.transformRequest = options.transformRequest || (config => config);
        this.transformResponse = options.transformResponse || (response => response);
    }

    useRequest(interceptor) {
        this.requestInterceptors.push(interceptor);
        return this;
    }

    useResponse(interceptor) {
        this.responseInterceptors.push(interceptor);
        return this;
    }

    async request(endpoint, config = {}) {
        let requestConfig = {
            method: 'GET',
            headers: {
                ...this.defaultHeaders,
                ...(config.headers || {})
            },
            body: config.body,
            signal: config.signal
        };

        requestConfig = this.transformRequest(requestConfig);

        for (const interceptor of this.requestInterceptors) {
            requestConfig = await interceptor(requestConfig) || requestConfig;
        }

        const url = this.buildURL(endpoint);

        const executeRequest = async (attempt = 0) => {
            const controller = !requestConfig.signal ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), this.timeout) : null;

            const fetchConfig = {
                ...requestConfig,
                signal: requestConfig.signal || (controller ? controller.signal : undefined)
            };

            try {
                const response = await this.fetchImpl(url, fetchConfig);
                let finalResponse = response;

                for (const interceptor of this.responseInterceptors) {
                    finalResponse = await interceptor(finalResponse) || finalResponse;
                }

                if (!finalResponse.ok && this.shouldRetry(finalResponse.status, attempt)) {
                    await this.delay(this.retry.delay * (attempt + 1));
                    return executeRequest(attempt + 1);
                }

                return this.transformResponse(finalResponse);
            } catch (error) {
                if (this.shouldRetry(error, attempt)) {
                    await this.delay(this.retry.delay * (attempt + 1));
                    return executeRequest(attempt + 1);
                }
                throw error;
            } finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
        };

        return executeRequest();
    }

    buildURL(endpoint) {
        if (/^https?:\/\//i.test(endpoint)) {
            return endpoint;
        }
        const trimmedEndpoint = endpoint.replace(/^\/+/, '');
        return `${this.baseURL}/${trimmedEndpoint}`.replace(/\/{2,}/g, '/');
    }

    shouldRetry(reason, attempt) {
        if (attempt >= this.retry.attempts) {
            return false;
        }
        if (typeof reason === 'number') {
            return this.retry.retryOn.includes(reason);
        }
        if (reason && reason.name === 'AbortError') {
            return true;
        }
        return false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    get(endpoint, config = {}) {
        return this.request(endpoint, { ...config, method: 'GET' });
    }

    post(endpoint, body, config = {}) {
        return this.request(endpoint, {
            ...config,
            method: 'POST',
            body: this.prepareBody(body, config)
        });
    }

    put(endpoint, body, config = {}) {
        return this.request(endpoint, {
            ...config,
            method: 'PUT',
            body: this.prepareBody(body, config)
        });
    }

    patch(endpoint, body, config = {}) {
        return this.request(endpoint, {
            ...config,
            method: 'PATCH',
            body: this.prepareBody(body, config)
        });
    }

    delete(endpoint, config = {}) {
        return this.request(endpoint, { ...config, method: 'DELETE' });
    }

    prepareBody(body, config) {
        if (!body) {
            return undefined;
        }
        const headers = config.headers || this.defaultHeaders;
        const contentType = headers['Content-Type'] || headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
            return JSON.stringify(body);
        }
        return body;
    }
}

module.exports = RestClient;

