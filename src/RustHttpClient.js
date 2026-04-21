import { NativeModules, Platform } from 'react-native';

const { SecureHttpCryptoModule } = NativeModules;

// Fallback configuration for when Rust module is unavailable
const DEFAULT_CONFIG = {
  baseURL: '',
  timeout: 30000,
  maxConnections: 100,
  keepAlive: true,
  http2PriorKnowledge: true,
  enableCompression: true,
  enableCaching: true,
  cacheTtlSeconds: 300,
  retryAttempts: 3,
  retryDelayMs: 1000,
  userAgent: 'RustSecureHttp/2.0',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

class RustHttpClient {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isRustAvailable = this._checkRustAvailability();
    this.requestQueue = [];
    this.batchSize = 10;
    this.batchTimeout = 50; // ms
    this.batchTimer = null;
    this.metrics = new Map();
    
    if (this.isRustAvailable) {
      this._initializeRustClient();
    }
  }

  _checkRustAvailability() {
    return SecureHttpCryptoModule && 
           typeof SecureHttpCryptoModule.httpExecuteRequest === 'function';
  }

  _initializeRustClient() {
    try {
      SecureHttpCryptoModule.httpClientInit();
      console.log('✅ Rust HTTP client initialized successfully');
      
      // Warmup connections for better performance
      if (this.config.baseURL) {
        this._warmupConnections([this.config.baseURL]);
      }
    } catch (error) {
      console.warn('⚠️ Rust HTTP client initialization failed:', error.message);
      this.isRustAvailable = false;
    }
  }

  _warmupConnections(urls) {
    if (!this.isRustAvailable) return;
    
    try {
      SecureHttpCryptoModule.httpWarmupConnections(JSON.stringify(urls));
    } catch (error) {
      console.warn('Connection warmup failed:', error.message);
    }
  }

  // High-performance single request execution
  async request(requestConfig) {
    const startTime = Date.now();
    
    try {
      if (this.isRustAvailable) {
        return await this._executeRustRequest(requestConfig);
      } else {
        return await this._executeFallbackRequest(requestConfig);
      }
    } catch (error) {
      this._updateMetrics(requestConfig.url || 'unknown', false, Date.now() - startTime);
      throw error;
    }
  }

  async _executeRustRequest(requestConfig) {
    const config = {
      base_url: this.config.baseURL,
      timeout_ms: requestConfig.timeout || this.config.timeout,
      max_connections: this.config.maxConnections,
      keep_alive: this.config.keepAlive,
      http2_prior_knowledge: this.config.http2PriorKnowledge,
      enable_compression: this.config.enableCompression,
      enable_caching: this.config.enableCaching,
      cache_ttl_seconds: this.config.cacheTtlSeconds,
      retry_attempts: this.config.retryAttempts,
      retry_delay_ms: this.config.retryDelayMs,
      user_agent: this.config.userAgent,
      headers: { ...this.config.headers, ...requestConfig.headers },
    };

    const request = {
      method: (requestConfig.method || 'GET').toUpperCase(),
      url: requestConfig.url || '',
      headers: requestConfig.headers || {},
      body: requestConfig.data ? JSON.stringify(requestConfig.data) : null,
      timeout_ms: requestConfig.timeout,
      enable_cache: requestConfig.enableCache !== false,
    };

    const startTime = Date.now();
    
    try {
      const responseJson = await SecureHttpCryptoModule.httpExecuteRequest(
        JSON.stringify(config),
        JSON.stringify(request)
      );
      
      const response = JSON.parse(responseJson);
      
      if (response.error) {
        throw new Error(response.error);
      }

      // Parse response body if it's JSON
      let parsedData = response.body;
      try {
        parsedData = JSON.parse(response.body);
      } catch (e) {
        // Keep as string if not valid JSON
      }

      const result = {
        data: parsedData,
        status: response.status,
        statusText: response.status_text,
        headers: response.headers,
        config: requestConfig,
        fromCache: response.from_cache,
        compressed: response.compressed,
        httpVersion: response.http_version,
        duration: response.duration_ms,
      };

      this._updateMetrics(request.url, true, response.duration_ms, response.from_cache);
      return result;
      
    } catch (error) {
      this._updateMetrics(request.url, false, Date.now() - startTime);
      throw error;
    }
  }

  async _executeFallbackRequest(requestConfig) {
    // Fallback to standard fetch with basic optimizations
    const url = this._buildURL(requestConfig.url);
    const options = {
      method: requestConfig.method || 'GET',
      headers: { ...this.config.headers, ...requestConfig.headers },
      body: requestConfig.data ? JSON.stringify(requestConfig.data) : undefined,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout || this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        config: requestConfig,
        fromCache: false,
        compressed: false,
        httpVersion: 'HTTP/1.1',
        duration: 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Ultra-fast batch request processing
  async batchRequest(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('Batch requests must be a non-empty array');
    }

    if (this.isRustAvailable && requests.length > 1) {
      return await this._executeBatchRustRequests(requests);
    } else {
      // Fallback to parallel individual requests
      return await Promise.all(requests.map(req => this.request(req)));
    }
  }

  async _executeBatchRustRequests(requests) {
    const config = {
      base_url: this.config.baseURL,
      timeout_ms: this.config.timeout,
      max_connections: this.config.maxConnections,
      keep_alive: this.config.keepAlive,
      http2_prior_knowledge: this.config.http2PriorKnowledge,
      enable_compression: this.config.enableCompression,
      enable_caching: this.config.enableCaching,
      cache_ttl_seconds: this.config.cacheTtlSeconds,
      retry_attempts: this.config.retryAttempts,
      retry_delay_ms: this.config.retryDelayMs,
      user_agent: this.config.userAgent,
      headers: this.config.headers,
    };

    const rustRequests = requests.map(req => ({
      method: (req.method || 'GET').toUpperCase(),
      url: req.url || '',
      headers: { ...this.config.headers, ...req.headers },
      body: req.data ? JSON.stringify(req.data) : null,
      timeout_ms: req.timeout,
      enable_cache: req.enableCache !== false,
    }));

    try {
      const resultsJson = await SecureHttpCryptoModule.httpExecuteBatchRequests(
        JSON.stringify(config),
        JSON.stringify(rustRequests)
      );
      
      const results = JSON.parse(resultsJson);
      
      return results.map((result, index) => {
        if (result.error) {
          throw new Error(result.error);
        }

        let parsedData = result.body;
        try {
          parsedData = JSON.parse(result.body);
        } catch (e) {
          // Keep as string if not valid JSON
        }

        return {
          data: parsedData,
          status: result.status,
          statusText: result.status_text,
          headers: result.headers,
          config: requests[index],
          fromCache: result.from_cache,
          compressed: result.compressed,
          httpVersion: result.http_version,
          duration: result.duration_ms,
        };
      });
    } catch (error) {
      throw new Error(`Batch request failed: ${error.message}`);
    }
  }

  // Smart request queuing for optimal batching
  queueRequest(requestConfig) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestConfig, resolve, reject });
      
      if (this.requestQueue.length >= this.batchSize) {
        this._processBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this._processBatch(), this.batchTimeout);
      }
    });
  }

  async _processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.requestQueue.length === 0) return;

    const batch = this.requestQueue.splice(0, this.batchSize);
    
    try {
      const requests = batch.map(item => item.requestConfig);
      const results = await this.batchRequest(requests);
      
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => {
        item.reject(error);
      });
    }
  }

  // Performance monitoring and metrics
  getMetrics(endpoint) {
    if (this.isRustAvailable && endpoint) {
      try {
        const metricsJson = SecureHttpCryptoModule.httpGetMetrics(endpoint);
        return metricsJson ? JSON.parse(metricsJson) : null;
      } catch (error) {
        console.warn('Failed to get Rust metrics:', error.message);
      }
    }
    
    return this.metrics.get(endpoint) || null;
  }

  getAllMetrics() {
    const allMetrics = {};
    
    for (const [endpoint, metrics] of this.metrics.entries()) {
      allMetrics[endpoint] = metrics;
    }
    
    return allMetrics;
  }

  _updateMetrics(endpoint, success, duration, fromCache = false) {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
      });
    }

    const metrics = this.metrics.get(endpoint);
    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    
    metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.totalRequests - 1) + duration) / metrics.totalRequests;
    
    if (fromCache) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }
  }

  // Cache management
  clearCache() {
    if (this.isRustAvailable) {
      try {
        return SecureHttpCryptoModule.httpClearCache();
      } catch (error) {
        console.warn('Failed to clear Rust cache:', error.message);
      }
    }
    return false;
  }

  getCacheStats() {
    if (this.isRustAvailable) {
      try {
        const statsJson = SecureHttpCryptoModule.httpGetCacheStats();
        return statsJson ? JSON.parse(statsJson) : null;
      } catch (error) {
        console.warn('Failed to get cache stats:', error.message);
      }
    }
    return null;
  }

  // Convenience methods with performance optimizations
  async get(url, config = {}) {
    return this.request({ ...config, url, method: 'GET' });
  }

  async post(url, data, config = {}) {
    return this.request({ ...config, url, method: 'POST', data });
  }

  async put(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PUT', data });
  }

  async delete(url, config = {}) {
    return this.request({ ...config, url, method: 'DELETE' });
  }

  async patch(url, data, config = {}) {
    return this.request({ ...config, url, method: 'PATCH', data });
  }

  // Parallel request execution for maximum throughput
  async parallel(requests) {
    if (this.isRustAvailable && requests.length > 3) {
      // Use Rust batch processing for better performance
      return this.batchRequest(requests);
    } else {
      // Use Promise.all for smaller batches
      return Promise.all(requests.map(req => this.request(req)));
    }
  }

  // Create a new instance with merged configuration
  create(config = {}) {
    return new RustHttpClient({ ...this.config, ...config });
  }

  _buildURL(url) {
    if (!url) return this.config.baseURL;
    if (url.startsWith('http')) return url;
    return `${this.config.baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }

  // Performance benchmarking
  async benchmark(url, iterations = 100) {
    const results = {
      iterations,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      successRate: 0,
      throughput: 0,
    };

    const startTime = Date.now();
    let successCount = 0;

    const requests = Array(iterations).fill().map(() => ({ url, method: 'GET' }));
    
    try {
      const responses = await this.parallel(requests);
      
      responses.forEach(response => {
        if (response.status >= 200 && response.status < 300) {
          successCount++;
        }
        
        const duration = response.duration || 0;
        results.minTime = Math.min(results.minTime, duration);
        results.maxTime = Math.max(results.maxTime, duration);
      });
      
      results.totalTime = Date.now() - startTime;
      results.avgTime = results.totalTime / iterations;
      results.successRate = (successCount / iterations) * 100;
      results.throughput = (successCount / results.totalTime) * 1000; // requests per second
      
    } catch (error) {
      console.error('Benchmark failed:', error.message);
    }

    return results;
  }
}

// Factory function for creating optimized HTTP clients
export function createRustHttpClient(config = {}) {
  return new RustHttpClient(config);
}

// Pre-configured high-performance client
export const rustHttp = new RustHttpClient({
  enableCaching: true,
  enableCompression: true,
  http2PriorKnowledge: true,
  maxConnections: 200,
  retryAttempts: 3,
});

export default RustHttpClient;