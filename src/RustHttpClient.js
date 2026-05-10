import { NativeModules, Platform } from 'react-native';

const { SecureHttpCryptoModule, TLSSecurityModule } = NativeModules;

let _initialized = false;

// ─── TLS + native init (once) ────────────────────────────────────────────────

async function ensureTLS() {
  if (_initialized) return;
  if (Platform.OS === 'android' && TLSSecurityModule) {
    try {
      await TLSSecurityModule.updateSecurityProvider();
      await TLSSecurityModule.forceTLS13();
    } catch (e) {
      console.warn('[SecureHttp] TLS init:', e?.message);
    }
  }
  if (SecureHttpCryptoModule?.httpClientInit) {
    try {
      await SecureHttpCryptoModule.httpClientInit();
    } catch (e) {
      console.warn('[SecureHttp] native init:', e?.message);
    }
  }
  _initialized = true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildURL(baseURL, url) {
  if (!url) return baseURL || '';
  if (url.startsWith('http')) return url;
  const base = (baseURL || '').replace(/\/$/, '');
  return base ? `${base}/${url.replace(/^\//, '')}` : url;
}

function parseBody(raw) {
  try { return JSON.parse(raw); } catch (_) { return raw; }
}

// ─── Raw HTTP dispatch ───────────────────────────────────────────────────────

async function dispatch(instanceConfig, reqConfig) {
  await ensureTLS();

  const url     = buildURL(instanceConfig.baseURL, reqConfig.url);
  const method  = (reqConfig.method || 'GET').toUpperCase();
  const headers = { ...instanceConfig.headers, ...reqConfig.headers };
  const timeout = reqConfig.timeout ?? instanceConfig.timeout;
  const body    = reqConfig.data != null ? JSON.stringify(reqConfig.data) : null;

  // ── Native Rust path ──────────────────────────────────────────────────────
  if (SecureHttpCryptoModule?.httpExecuteRequest) {
    const raw = await SecureHttpCryptoModule.httpExecuteRequest(
      JSON.stringify({ base_url: instanceConfig.baseURL, timeout_ms: timeout, headers }),
      JSON.stringify({ method, url, headers, body })
    );
    const res = JSON.parse(raw);
    if (res.error) throw Object.assign(new Error(res.error), { config: reqConfig });
    return {
      data:       parseBody(res.body),
      status:     res.status,
      statusText: res.status_text,
      headers:    res.headers,
      config:     reqConfig,
    };
  }

  // ── fetch fallback ────────────────────────────────────────────────────────
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { method, headers, body, signal: ctrl.signal });
    clearTimeout(timer);
    return {
      data:       parseBody(await res.text()),
      status:     res.status,
      statusText: res.statusText,
      headers:    Object.fromEntries(res.headers.entries()),
      config:     reqConfig,
    };
  } catch (err) {
    clearTimeout(timer);
    throw Object.assign(new Error(err.message), { config: reqConfig });
  }
}

// ─── Interceptor manager ─────────────────────────────────────────────────────
// Supports both .use(fn) and .push(fn) so existing app code works as-is.

function createInterceptorManager() {
  const handlers = [];

  const add = (fn) => {
    handlers.push(typeof fn === 'function' ? { fulfilled: fn } : fn);
    return handlers.length - 1;
  };

  return {
    _handlers: handlers,
    use:  add,
    push: add,
    eject(id) { handlers[id] = null; },
  };
}

// ─── Instance factory ─────────────────────────────────────────────────────────

export function createHermesClient(config = {}) {
  if (typeof config !== 'object' || config === null) config = {};

  const defaults = {
    baseURL: '',
    timeout: 30000,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    ...config,
  };

  const interceptors = {
    request:  createInterceptorManager(),
    response: createInterceptorManager(),
  };

  async function request(reqConfig) {
    // run request interceptors
    let cfg = { ...reqConfig };
    await Promise.all(
      interceptors.request._handlers
        .filter(Boolean)
        .map(async (h) => {
          if (h.fulfilled) cfg = (await h.fulfilled(cfg)) ?? cfg;
        })
    );

    let response;
    try {
      response = await dispatch(defaults, cfg);
    } catch (err) {
      const errHandlers = interceptors.response._handlers.filter(h => h?.rejected);
      if (errHandlers.length) {
        return errHandlers[0].rejected(err);
      }
      throw err;
    }

    // run response interceptors
    await Promise.all(
      interceptors.response._handlers
        .filter(Boolean)
        .map(async (h) => {
          if (h.fulfilled) response = (await h.fulfilled(response)) ?? response;
        })
    );

    return response;
  }

  // ── Per-endpoint metrics store ────────────────────────────────────────────
  const _metrics = {};

  function _recordMetric(endpoint, durationMs, success) {
    if (!_metrics[endpoint]) {
      _metrics[endpoint] = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, totalTime: 0, avgResponseTime: 0, cacheHits: 0, cacheMisses: 0 };
    }
    const m = _metrics[endpoint];
    m.totalRequests++;
    m.totalTime += durationMs;
    m.avgResponseTime = m.totalTime / m.totalRequests;
    if (success) m.successfulRequests++; else m.failedRequests++;
  }

  async function requestWithMetrics(reqConfig) {
    const endpoint = reqConfig.url || '';
    const start = Date.now();
    try {
      const res = await request(reqConfig);
      _recordMetric(endpoint, Date.now() - start, true);
      return res;
    } catch (err) {
      _recordMetric(endpoint, Date.now() - start, false);
      throw err;
    }
  }

  const instance = {
    defaults,
    interceptors,
    request:  requestWithMetrics,
    get:      (url, cfg = {})       => requestWithMetrics({ ...cfg, url, method: 'GET' }),
    post:     (url, data, cfg = {}) => requestWithMetrics({ ...cfg, url, method: 'POST',   data }),
    put:      (url, data, cfg = {}) => requestWithMetrics({ ...cfg, url, method: 'PUT',    data }),
    patch:    (url, data, cfg = {}) => requestWithMetrics({ ...cfg, url, method: 'PATCH',  data }),
    delete:   (url, cfg = {})       => requestWithMetrics({ ...cfg, url, method: 'DELETE' }),
    create:   (cfg = {})            => createHermesClient({ ...defaults, ...cfg }),

    // ── Metrics API (matches type definitions) ──────────────────────────────
    getMetrics(endpoint) {
      if (endpoint) return _metrics[endpoint] ?? null;
      return null;
    },
    getAllMetrics() {
      return { ..._metrics };
    },

    // ── Benchmark API ───────────────────────────────────────────────────────
    async benchmark(url, iterations = 100) {
      const times = [];
      let successes = 0;
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        try {
          await requestWithMetrics({ url, method: 'GET' });
          successes++;
        } catch (_) { /* count as failure */ }
        times.push(Date.now() - start);
      }
      const total = times.reduce((a, b) => a + b, 0);
      return {
        iterations,
        totalTime:   total,
        avgTime:     total / iterations,
        minTime:     Math.min(...times),
        maxTime:     Math.max(...times),
        successRate: successes / iterations,
        throughput:  iterations / (total / 1000),
      };
    },

    // ── Cache stubs (native module handles real caching) ───────────────────
    clearCache() {
      if (SecureHttpCryptoModule?.httpClearCache) {
        SecureHttpCryptoModule.httpClearCache().catch(() => {});
      }
      return true;
    },
    getCacheStats() {
      return null;
    },

    // ── Custom headers store (used by app for authtoken) ───────────────────
    _customHeaders: {},
  };

  return instance;
}

let _defaultClient;
try {
  _defaultClient = createHermesClient();
} catch (e) {
  console.warn('[SecureHttp] Failed to create default client:', e?.message);
  // Provide a stub so callers get a clear error rather than "Cannot read property of undefined"
  _defaultClient = {
    defaults: {},
    interceptors: { request: { use() {}, push() {}, eject() {} }, response: { use() {}, push() {}, eject() {} } },
    _customHeaders: {},
    create:      (cfg) => createHermesClient(cfg),
    getMetrics:  () => null,
    getAllMetrics:() => ({}),
    clearCache:  () => true,
    getCacheStats: () => null,
    benchmark:   async () => ({ iterations: 0, totalTime: 0, avgTime: 0, minTime: 0, maxTime: 0, successRate: 0, throughput: 0 }),
    request: () => Promise.reject(new Error('[SecureHttp] Client failed to initialize')),
    get:     () => Promise.reject(new Error('[SecureHttp] Client failed to initialize')),
    post:    () => Promise.reject(new Error('[SecureHttp] Client failed to initialize')),
    put:     () => Promise.reject(new Error('[SecureHttp] Client failed to initialize')),
    patch:   () => Promise.reject(new Error('[SecureHttp] Client failed to initialize')),
    delete:  () => Promise.reject(new Error('[SecureHttp] Client failed to initialize')),
  };
}

export default _defaultClient;
