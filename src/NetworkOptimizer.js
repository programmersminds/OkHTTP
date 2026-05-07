import { NativeModules, Platform, NetInfo } from 'react-native';

const { SecureHttpCryptoModule } = NativeModules;

/**
 * NetworkOptimizer
 *
 * What this actually does:
 *  - LRU response cache with TTL (avoids redundant network round-trips)
 *  - Request deduplication (collapses identical in-flight requests into one)
 *  - Exponential backoff retry with jitter
 *  - Real network quality measurement via a timed HEAD probe
 *  - Request prioritisation and batching
 *  - JSON minification before sending (removes whitespace the server doesn't need)
 *
 * What this does NOT claim to do:
 *  - It cannot change your physical network speed or signal strength
 *  - It does not implement Brotli/LZ4/gzip in JS (those belong on the server
 *    via Accept-Encoding; the Rust native layer handles it when linked)
 */

// ---------------------------------------------------------------------------
// Tiny LRU cache — avoids pulling in a dependency
// ---------------------------------------------------------------------------
class LRUCache {
  constructor(maxSize = 200) {
    this._max = maxSize;
    this._map = new Map(); // insertion-order Map acts as LRU when we re-insert on access
  }

  get(key) {
    if (!this._map.has(key)) return undefined;
    // Move to end (most-recently-used)
    const value = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._max) {
      // Evict least-recently-used (first entry)
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, value);
  }

  delete(key) { this._map.delete(key); }
  clear()     { this._map.clear(); }
  get size()  { return this._map.size; }
}

// ---------------------------------------------------------------------------
// NetworkOptimizer
// ---------------------------------------------------------------------------
class NetworkOptimizer {
  constructor(config = {}) {
    this.config = {
      enableCaching:       true,
      cacheTtl:            300,      // seconds — 5 min default
      cacheMaxSize:        200,      // max cached responses
      enableDeduplication: true,
      enableBatching:      true,
      batchSize:           20,
      batchTimeout:        20,       // ms — short wait; explicit batchRequest() calls only
      maxRetries:          2,        // 2 retries = 3 total attempts max
      retryDelay:          100,      // ms base — first retry at ~100ms, not 500ms
      probeUrl:            null,
      ...config,
    };

    // LRU response cache: key → { data, expiresAt, hits }
    this._cache = new LRUCache(this.config.cacheMaxSize);

    // In-flight deduplication: cacheKey → Promise
    this._inflight = new Map();

    // Batch queue
    this._batchQueue  = [];
    this._batchTimer  = null;

    // Real measured network metrics (populated by measureNetworkQuality)
    this.networkMetrics = {
      rttMs:       null,   // measured round-trip time
      networkType: 'unknown',
      online:      true,
    };

    this._totalCacheHits   = 0;
    this._totalCacheMisses = 0;
    this._totalRequests    = 0;
  }

  // -------------------------------------------------------------------------
  // Network quality — real measurement, not hardcoded guesses
  // -------------------------------------------------------------------------

  /**
   * Measures actual network quality.
   * - Uses @react-native-community/netinfo if available (optional peer dep)
   * - Falls back to a timed HEAD probe against probeUrl if provided
   * - Otherwise reports what it can from the JS environment
   */
  async detectNetworkQuality() {
    const metrics = { rttMs: null, networkType: 'unknown', online: true };

    // 1. Try NetInfo (react-native built-in or community package)
    try {
      let netInfoState = null;

      // RN 0.60 removed the built-in NetInfo; try community package first
      try {
        const NetInfoModule = require('@react-native-community/netinfo');
        netInfoState = await (NetInfoModule.default || NetInfoModule).fetch();
      } catch (_) {
        // Fall back to the legacy built-in (RN < 0.60)
        if (NetInfo && typeof NetInfo.getConnectionInfo === 'function') {
          netInfoState = await NetInfo.getConnectionInfo();
        }
      }

      if (netInfoState) {
        metrics.online      = netInfoState.isConnected !== false;
        metrics.networkType = netInfoState.type || netInfoState.effectiveType || 'unknown';
      }
    } catch (_) {
      // NetInfo unavailable — not a hard failure
    }

    // 2. Measure real RTT with a timed HEAD probe
    if (this.config.probeUrl) {
      try {
        const t0 = Date.now();
        await fetch(this.config.probeUrl, {
          method: 'HEAD',
          cache:  'no-store',
          signal: this._timeoutSignal(5000),
        });
        metrics.rttMs = Date.now() - t0;
      } catch (_) {
        metrics.rttMs = null; // probe failed (offline or blocked)
      }
    }

    this.networkMetrics = metrics;
    return metrics;
  }

  // -------------------------------------------------------------------------
  // JSON minification — the one real JS-side "compression" that works
  // -------------------------------------------------------------------------

  /**
   * Strips unnecessary whitespace from a JSON payload before sending.
   * JSON.stringify with no spacing already does this; this handles the case
   * where the caller passes a pre-serialised string.
   */
  minifyPayload(data) {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      try {
        // Re-parse and re-stringify to strip whitespace
        return JSON.stringify(JSON.parse(data));
      } catch (_) {
        return data; // not JSON — leave as-is
      }
    }
    return JSON.stringify(data); // object → compact JSON string
  }

  // -------------------------------------------------------------------------
  // Response cache
  // -------------------------------------------------------------------------

  /**
   * Returns a cached response for `key`, or null if absent / expired.
   * Only GET responses should be cached.
   */
  getCachedResponse(key) {
    if (!this.config.enableCaching) return null;
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }
    entry.hits++;
    this._totalCacheHits++;
    return entry.data;
  }

  /**
   * Stores `response` under `key` with the configured TTL.
   */
  setCachedResponse(key, response, ttlSeconds = null) {
    if (!this.config.enableCaching) return;
    const ttl = (ttlSeconds ?? this.config.cacheTtl) * 1000;
    this._cache.set(key, {
      data:      response,
      expiresAt: Date.now() + ttl,
      hits:      0,
    });
    this._totalCacheMisses++;
  }

  /**
   * Builds a stable cache key from a request config.
   * Only includes method + url + sorted query-relevant headers.
   */
  buildCacheKey(requestConfig) {
    const method  = (requestConfig.method || 'GET').toUpperCase();
    const url     = requestConfig.url || '';
    // Include body for non-GET so POST dedup works too
    const body    = method !== 'GET' ? (requestConfig.data ? JSON.stringify(requestConfig.data) : '') : '';
    return `${method}:${url}:${body}`;
  }

  // -------------------------------------------------------------------------
  // In-flight deduplication
  // -------------------------------------------------------------------------

  /**
   * If an identical request is already in-flight, returns its Promise so the
   * caller shares the result instead of firing a duplicate network request.
   *
   * Usage:
   *   const key = optimizer.buildCacheKey(config);
   *   const shared = optimizer.getInflight(key);
   *   if (shared) return shared;
   *   const promise = actualFetch(config);
   *   optimizer.trackInflight(key, promise);
   *   return promise;
   */
  getInflight(key) {
    if (!this.config.enableDeduplication) return null;
    return this._inflight.get(key) || null;
  }

  trackInflight(key, promise) {
    if (!this.config.enableDeduplication) return;
    this._inflight.set(key, promise);
    // Clean up once settled
    promise.finally(() => this._inflight.delete(key));
  }

  // -------------------------------------------------------------------------
  // Retry with exponential backoff + jitter
  // -------------------------------------------------------------------------

  /**
   * Calls `fn` and retries on failure with exponential backoff.
   * Jitter prevents thundering-herd when many clients retry simultaneously.
   *
   * @param {() => Promise} fn
   * @param {number} [maxRetries]
   * @returns {Promise}
   */
  async retryWithBackoff(fn, maxRetries = null) {
    const retries = maxRetries ?? this.config.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;

        // Never retry client errors (4xx) — wrong credentials, bad request, etc.
        // Retrying these just adds delay with no chance of success.
        if (err && err.status >= 400 && err.status < 500) throw err;
        if (err && err.response && err.response.status >= 400 && err.response.status < 500) throw err;

        if (attempt < retries) {
          // First retry is fast (100ms), then backs off: 100 → 300 → 700ms + jitter
          // This recovers quickly from a single dropped packet without hammering the server
          const base  = this.config.retryDelay * Math.pow(2, attempt);
          const jitter = Math.random() * 100; // max 100ms jitter
          await this._sleep(base + jitter);
        }
      }
    }

    throw lastError;
  }

  // -------------------------------------------------------------------------
  // Request batching
  // -------------------------------------------------------------------------

  /**
   * Queues requests and resolves with the deduplicated + prioritised batch
   * once either batchSize is reached or batchTimeout elapses.
   *
   * Returns a Promise that resolves with the processed batch array.
   */
  batchRequests(requests) {
    return new Promise((resolve) => {
      this._batchQueue.push(...requests);

      if (this._batchQueue.length >= this.config.batchSize) {
        this._flushBatch(resolve);
      } else {
        if (this._batchTimer) clearTimeout(this._batchTimer);
        this._batchTimer = setTimeout(
          () => this._flushBatch(resolve),
          this.config.batchTimeout,
        );
      }
    });
  }

  _flushBatch(callback) {
    if (this._batchTimer) { clearTimeout(this._batchTimer); this._batchTimer = null; }
    const batch = this._batchQueue.splice(0, this.config.batchSize);
    callback(this._prioritise(this._deduplicate(batch)));
  }

  _deduplicate(requests) {
    const seen = new Set();
    return requests.filter((req) => {
      const key = this.buildCacheKey(req);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // GET first (read-only, safe to parallelise), then mutations
  _prioritise(requests) {
    const order = { GET: 0, HEAD: 1, POST: 2, PUT: 3, PATCH: 4, DELETE: 5 };
    return [...requests].sort((a, b) => {
      const pa = order[(a.method || 'GET').toUpperCase()] ?? 9;
      const pb = order[(b.method || 'GET').toUpperCase()] ?? 9;
      return pa - pb;
    });
  }

  // -------------------------------------------------------------------------
  // Stats / reporting
  // -------------------------------------------------------------------------

  getOptimizationReport() {
    const cacheEntries = this._cache.size;
    return {
      networkMetrics:  this.networkMetrics,
      cacheStats: {
        entries:    cacheEntries,
        totalHits:  this._totalCacheHits,
        totalMisses: this._totalCacheMisses,
        hitRate:    this._totalRequests > 0
          ? ((this._totalCacheHits / this._totalRequests) * 100).toFixed(1) + '%'
          : '0%',
      },
      queueStats: {
        pending:  this._batchQueue.length,
        inflight: this._inflight.size,
      },
    };
  }

  clearCaches() {
    this._cache.clear();
    this._inflight.clear();
    this._batchQueue = [];
    if (this._batchTimer) { clearTimeout(this._batchTimer); this._batchTimer = null; }
    this._totalCacheHits   = 0;
    this._totalCacheMisses = 0;
    this._totalRequests    = 0;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  _timeoutSignal(ms) {
    if (typeof AbortController === 'undefined') return undefined;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  }
}

export default NetworkOptimizer;
