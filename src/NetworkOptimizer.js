import { NativeModules } from 'react-native';

const { SecureHttpCryptoModule } = NativeModules;

// ---------------------------------------------------------------------------
// Tiny LRU cache — no external dependency needed
// ---------------------------------------------------------------------------
class LRUCache {
  constructor(maxSize = 200) {
    this._max = maxSize;
    this._map = new Map();
  }

  get(key) {
    if (!this._map.has(key)) return undefined;
    const value = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._max) {
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
      cacheTtl:            300,
      cacheMaxSize:        200,
      enableDeduplication: true,
      enableBatching:      true,
      batchSize:           20,
      batchTimeout:        20,
      maxRetries:          2,
      retryDelay:          100,
      probeUrl:            null,
      ...config,
    };

    this._cache     = new LRUCache(this.config.cacheMaxSize);
    this._inflight  = new Map();
    this._batchQueue = [];
    this._batchTimer = null;

    this.networkMetrics = {
      rttMs:       null,
      networkType: 'unknown',
      online:      true,
    };

    this._totalCacheHits   = 0;
    this._totalCacheMisses = 0;
    this._totalRequests    = 0;
  }

  // -------------------------------------------------------------------------
  // Network quality — real measurement only, no hardcoded values
  // -------------------------------------------------------------------------

  async detectNetworkQuality() {
    const metrics = { rttMs: null, networkType: 'unknown', online: true };

    // Try @react-native-community/netinfo (optional peer dep)
    try {
      const NetInfoModule = require('@react-native-community/netinfo');
      const state = await (NetInfoModule.default || NetInfoModule).fetch();
      if (state) {
        metrics.online      = state.isConnected !== false;
        metrics.networkType = state.type || state.effectiveType || 'unknown';
      }
    } catch (_) {
      // Not installed — not a hard failure
    }

    // Measure real RTT if a probe URL is configured
    if (this.config.probeUrl) {
      try {
        const t0 = Date.now();
        await fetch(this.config.probeUrl, {
          method: 'HEAD',
          cache:  'no-store',
          signal: this._timeoutSignal(4000),
        });
        metrics.rttMs = Date.now() - t0;
      } catch (_) {
        metrics.rttMs = null;
      }
    }

    this.networkMetrics = metrics;
    return metrics;
  }

  // -------------------------------------------------------------------------
  // Response cache
  // -------------------------------------------------------------------------

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

  setCachedResponse(key, response, ttlSeconds = null) {
    if (!this.config.enableCaching) return;
    const ttl = (ttlSeconds ?? this.config.cacheTtl) * 1000;
    this._cache.set(key, { data: response, expiresAt: Date.now() + ttl, hits: 0 });
    this._totalCacheMisses++;
  }

  buildCacheKey(requestConfig) {
    const method = (requestConfig.method || 'GET').toUpperCase();
    const url    = requestConfig.url || '';
    const body   = method !== 'GET'
      ? (requestConfig.data ? JSON.stringify(requestConfig.data) : '')
      : '';
    return `${method}:${url}:${body}`;
  }

  // -------------------------------------------------------------------------
  // In-flight deduplication (GET only)
  // -------------------------------------------------------------------------

  getInflight(key) {
    if (!this.config.enableDeduplication) return null;
    return this._inflight.get(key) || null;
  }

  trackInflight(key, promise) {
    if (!this.config.enableDeduplication) return;
    this._inflight.set(key, promise);
    promise.finally(() => this._inflight.delete(key));
  }

  // -------------------------------------------------------------------------
  // Retry with exponential backoff + jitter
  // -------------------------------------------------------------------------

  async retryWithBackoff(fn, maxRetries = null) {
    const retries = maxRetries ?? this.config.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;

        // Never retry 4xx — wrong credentials / bad request won't fix itself
        const status = err?.status ?? err?.response?.status;
        if (status >= 400 && status < 500) throw err;

        if (attempt < retries) {
          const base   = this.config.retryDelay * Math.pow(2, attempt);
          const jitter = Math.random() * 100;
          await this._sleep(base + jitter);
        }
      }
    }

    throw lastError;
  }

  // -------------------------------------------------------------------------
  // Request batching (explicit batchRequest() calls only)
  // -------------------------------------------------------------------------

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

  _prioritise(requests) {
    const order = { GET: 0, HEAD: 1, POST: 2, PUT: 3, PATCH: 4, DELETE: 5 };
    return [...requests].sort((a, b) => {
      const pa = order[(a.method || 'GET').toUpperCase()] ?? 9;
      const pb = order[(b.method || 'GET').toUpperCase()] ?? 9;
      return pa - pb;
    });
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  getOptimizationReport() {
    return {
      networkMetrics: this.networkMetrics,
      cacheStats: {
        entries:     this._cache.size,
        totalHits:   this._totalCacheHits,
        totalMisses: this._totalCacheMisses,
        hitRate: this._totalRequests > 0
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
