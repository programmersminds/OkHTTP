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

  const instance = {
    defaults,
    interceptors,
    request,
    get:    (url, cfg = {})       => request({ ...cfg, url, method: 'GET' }),
    post:   (url, data, cfg = {}) => request({ ...cfg, url, method: 'POST',   data }),
    put:    (url, data, cfg = {}) => request({ ...cfg, url, method: 'PUT',    data }),
    patch:  (url, data, cfg = {}) => request({ ...cfg, url, method: 'PATCH',  data }),
    delete: (url, cfg = {})       => request({ ...cfg, url, method: 'DELETE' }),
    create: (cfg = {})            => createHermesClient({ ...defaults, ...cfg }),
  };

  return instance;
}

export default createHermesClient();
