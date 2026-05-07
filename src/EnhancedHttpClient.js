import { createRustHttpClient } from './RustHttpClient';
import NetworkOptimizer from './NetworkOptimizer';

/**
 * EnhancedHttpClient
 *
 * Wraps RustHttpClient (or the fetch fallback) with:
 *  - LRU response caching with TTL
 *  - In-flight request deduplication (identical concurrent requests share one fetch)
 *  - Exponential backoff retry with jitter
 *  - JSON payload minification
 *  - Real network quality measurement
 *  - Request batching and prioritisation
 *
 * It does NOT fake compression or claim to change physical network speed.
 */
class EnhancedHttpClient {
  constructor(config = {}) {
    this.config = config;

    this.rustClient = createRustHttpClient(config);

    this.optimizer = new NetworkOptimizer({
      enableCaching:       config.enableCaching       !== false,
      cacheTtl:            config.cacheTtlSeconds      ?? 300,
      cacheMaxSize:        config.cacheMaxSize         ?? 200,
      enableDeduplication: config.enableDeduplication  !== false,
      enableBatching:      config.enableBatching       !== false,
      batchSize:           config.batchSize            ?? 20,
      batchTimeout:        config.batchTimeout         ?? 20,
      maxRetries:          config.retryAttempts        ?? 2,
      retryDelay:          config.retryDelayMs         ?? 100,
      probeUrl:            config.probeUrl             ?? null,
      ...config.optimizerConfig,
    });

    // Expose interceptors at the top level — same object as rustClient.interceptors
    this.interceptors = this.rustClient.interceptors;

    this._metrics = {
      totalRequests:      0,
      successfulRequests: 0,
      failedRequests:     0,
      avgResponseTimeMs:  0,
    };

    // Kick off network measurement in the background (non-blocking)
    this.optimizer.detectNetworkQuality().catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // Core request — caching + dedup + retry
  // ---------------------------------------------------------------------------

  async request(config) {
    const method = (config.method || 'GET').toUpperCase();
    const isCacheable = method === 'GET' && this.optimizer.config.enableCaching;
    const cacheKey = this.optimizer.buildCacheKey(config);

    this._metrics.totalRequests++;
    const t0 = Date.now();

    // 1. Cache hit — GET only, instant return
    if (isCacheable) {
      const cached = this.optimizer.getCachedResponse(cacheKey);
      if (cached) return cached;
    }

    // 2. In-flight deduplication — only for GET (safe to share read results).
    //    Never deduplicate POST/PUT/PATCH/DELETE — mutations must always fire.
    if (method === 'GET') {
      const inflight = this.optimizer.getInflight(cacheKey);
      if (inflight) return inflight;
    }

    // 3. Execute — POST/auth requests go direct with no batch delay.
    //    Only retry network/server errors; never retry 4xx.
    const promise = this.optimizer
      .retryWithBackoff(() => this.rustClient.request(config), this.optimizer.config.maxRetries)
      .then((response) => {
        const elapsed = Date.now() - t0;
        this._updateMetrics(true, elapsed);

        if (isCacheable && response.status >= 200 && response.status < 300) {
          this.optimizer.setCachedResponse(cacheKey, response);
        }

        return response;
      })
      .catch((err) => {
        this._updateMetrics(false, Date.now() - t0);
        throw err;
      });

    // Only track GET requests as in-flight
    if (method === 'GET') {
      this.optimizer.trackInflight(cacheKey, promise);
    }

    return promise;
  }

  // ---------------------------------------------------------------------------
  // Batch — parallel execution via rustClient
  // ---------------------------------------------------------------------------

  async batchRequest(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('batchRequest requires a non-empty array');
    }

    // Deduplicate + prioritise before sending
    const optimised = await this.optimizer.batchRequests(requests);

    if (this.rustClient.batchRequest && optimised.length > 1) {
      return this.rustClient.batchRequest(optimised);
    }

    // Fallback: parallel individual requests
    return Promise.all(optimised.map((req) => this.request(req)));
  }

  async parallel(requests) {
    return this.batchRequest(requests);
  }

  // ---------------------------------------------------------------------------
  // Convenience methods
  // ---------------------------------------------------------------------------

  get(url, config = {})          { return this.request({ ...config, url, method: 'GET' }); }
  post(url, data, config = {})   { return this.request({ ...config, url, method: 'POST', data }); }
  put(url, data, config = {})    { return this.request({ ...config, url, method: 'PUT', data }); }
  delete(url, config = {})       { return this.request({ ...config, url, method: 'DELETE' }); }
  patch(url, data, config = {})  { return this.request({ ...config, url, method: 'PATCH', data }); }

  // ---------------------------------------------------------------------------
  // Network quality
  // ---------------------------------------------------------------------------

  async detectNetworkQuality() {
    return this.optimizer.detectNetworkQuality();
  }

  getNetworkMetrics() {
    return this.optimizer.networkMetrics;
  }

  // ---------------------------------------------------------------------------
  // Cache management
  // ---------------------------------------------------------------------------

  clearCaches() {
    this.optimizer.clearCaches();
  }

  // ---------------------------------------------------------------------------
  // Performance report
  // ---------------------------------------------------------------------------

  getPerformanceReport() {
    const optimReport = this.optimizer.getOptimizationReport();
    return {
      ...this._metrics,
      network:    optimReport.networkMetrics,
      cacheStats: optimReport.cacheStats,
      queueStats: optimReport.queueStats,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _updateMetrics(success, elapsedMs) {
    if (success) {
      this._metrics.successfulRequests++;
      const n = this._metrics.successfulRequests;
      this._metrics.avgResponseTimeMs =
        (this._metrics.avgResponseTimeMs * (n - 1) + elapsedMs) / n;
    } else {
      this._metrics.failedRequests++;
    }
  }
}

export default EnhancedHttpClient;
