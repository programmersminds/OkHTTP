var hasFetch = typeof fetch !== "undefined";
var METHODS_WITHOUT_BODY = { GET: true, HEAD: true };

function makeError(message, config, response) {
  var err = new Error(message || "Network request failed");
  err.config = config;
  err.response = response || null;
  return err;
}

function createInterceptorManager() {
  var handlers = [];

  return {
    use: function(fulfilled, rejected) {
      handlers.push({ fulfilled: fulfilled, rejected: rejected });
      return handlers.length - 1;
    },
    eject: function(id) {
      if (handlers[id]) handlers[id] = null;
    },
    clear: function() {
      handlers.length = 0;
    },
    forEach: function(callback) {
      handlers.filter(Boolean).forEach(callback);
    },
  };
}

function combineURLs(baseURL, relativeURL) {
  var normalizedBaseURL = (baseURL || "").replace(/\/+$/, "");
  var normalizedRelativeURL = (relativeURL || "").replace(/^\/+/, "");
  if (!normalizedBaseURL) return relativeURL || "";
  if (!normalizedRelativeURL) return normalizedBaseURL;
  return normalizedBaseURL + "/" + normalizedRelativeURL;
}

function appendParams(url, params) {
  if (!params) return url;

  var searchParams = [];
  Object.keys(params).forEach(function(key) {
    var value = params[key];
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach(function(item) {
        searchParams.push(
          encodeURIComponent(key) + "=" + encodeURIComponent(String(item))
        );
      });
      return;
    }

    searchParams.push(
      encodeURIComponent(key) + "=" + encodeURIComponent(String(value))
    );
  });

  if (!searchParams.length) return url;
  return url + (url.indexOf("?") === -1 ? "?" : "&") + searchParams.join("&");
}

function buildRequestBody(requestConfig) {
  if (METHODS_WITHOUT_BODY[requestConfig.method]) return undefined;
  if (requestConfig.data === undefined || requestConfig.data === null) return undefined;
  if (typeof requestConfig.data === "string") return requestConfig.data;
  return JSON.stringify(requestConfig.data);
}

function getActiveHandlers(manager) {
  var handlers = [];
  manager.forEach(function(handler) {
    handlers.push(handler);
  });
  return handlers;
}

function applyRequestInterceptors(manager, requestConfig) {
  return getActiveHandlers(manager).reduce(async function(configPromise, handler) {
    var currentConfig = await configPromise;

    try {
      if (!handler.fulfilled) return currentConfig;

      var nextConfig = await handler.fulfilled(currentConfig);
      if (!nextConfig) throw new Error("Request interceptor returned undefined config");
      return nextConfig;
    } catch (e) {
      if (handler.rejected) {
        return handler.rejected(e);
      }
      throw makeError(e && e.message, currentConfig, null);
    }
  }, Promise.resolve(requestConfig));
}

function applyResponseInterceptors(manager, response) {
  return getActiveHandlers(manager).reduce(async function(responsePromise, handler) {
    var currentResponse = await responsePromise;

    try {
      return handler.fulfilled ? await handler.fulfilled(currentResponse) : currentResponse;
    } catch (e) {
      return currentResponse;
    }
  }, Promise.resolve(response));
}

function applyErrorInterceptors(manager, error) {
  return getActiveHandlers(manager).reduce(async function(statePromise, handler) {
    var state = await statePromise;
    if (state.handled) return state;

    try {
      var fulfilled = handler.fulfilled || handler.rejected;
      var handled = fulfilled ? await fulfilled(state.error) : undefined;

      if (handled !== undefined) {
        return { handled: true, value: handled, error: state.error };
      }

      return state;
    } catch (e) {
      throw e;
    }
  }, Promise.resolve({ handled: false, value: undefined, error: error }));
}

function createAxiosLikeInstance(defaultConfig) {
  var context = new SecureHttpClient(defaultConfig);
  var instance = context.request.bind(context);

  instance.request = context.request.bind(context);
  instance.get = context.get.bind(context);
  instance.post = context.post.bind(context);
  instance.put = context.put.bind(context);
  instance.delete = context.delete.bind(context);
  instance.patch = context.patch.bind(context);
  instance.create = function create(config) {
    return createAxiosLikeInstance(Object.assign({}, context.defaults, config || {}));
  };
  instance.isCancel = SecureHttpClient.isCancel;
  instance.interceptors = context.interceptors;
  instance.defaults = context.defaults;
  instance.raw = context;

  return instance;
}

class SecureHttpClient {
  constructor(config) {
    config = config || {};
    this.defaults = {
      baseURL: config.baseURL || "",
      headers: config.headers || {},
      timeout: config.timeout || 30000,
    };
    this.baseURL = this.defaults.baseURL;
    this.headers = this.defaults.headers;
    this.timeout = this.defaults.timeout;
    this.interceptors = {
      request: createInterceptorManager(),
      response: createInterceptorManager(),
      error: createInterceptorManager(),
    };
  }

  create(config) {
    return createAxiosLikeInstance(Object.assign({}, this.defaults, config || {}));
  }

  static isCancel(error) {
    return !!(error && (error.name === "AbortError" || (error.message && error.message.indexOf("abort") !== -1)));
  }

  async request(config) {
    if (!config) throw new Error("Request config is required");

    var mergedConfig = Object.assign({}, this.defaults, config);
    mergedConfig.headers = Object.assign({}, this.defaults.headers, config.headers);
    var url = this._buildURL(mergedConfig.url, mergedConfig.baseURL, mergedConfig.params);
    var method = (mergedConfig.method || "GET").toUpperCase();
    var requestConfig = Object.assign({}, mergedConfig, {
      url: url,
      method: method,
      headers: mergedConfig.headers,
    });
    requestConfig = await applyRequestInterceptors(this.interceptors.request, requestConfig);

    try {
      return hasFetch
        ? await this._fetchRequest(requestConfig)
        : await this._xhrRequest(requestConfig);
    } catch (e) {
      if (e && e.response) throw e;
      throw makeError(e && e.message, requestConfig, null);
    }
  }

  async _fetchRequest(requestConfig) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function() { controller.abort(); }, requestConfig.timeout || this.timeout) : null;
    var body = buildRequestBody(requestConfig);

    var fetchResponse;
    try {
      fetchResponse = await fetch(requestConfig.url, {
        method: requestConfig.method,
        headers: requestConfig.headers,
        body: body,
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      var aborted = e && (e.name === "AbortError" || (e.message && e.message.indexOf("abort") !== -1));
      throw makeError(aborted ? "Request timed out" : (e && e.message) || "Network error", requestConfig, null);
    }

    if (timeoutId) clearTimeout(timeoutId);

    var text = await fetchResponse.text();
    var data;
    try { data = JSON.parse(text); } catch (e) { data = text; }

    var result = {
      data: data,
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers: Object.fromEntries(fetchResponse.headers.entries()),
      config: requestConfig,
    };
    result = await applyResponseInterceptors(this.interceptors.response, result);

    if (!fetchResponse.ok) {
      var error = makeError("Request failed with status " + fetchResponse.status, requestConfig, result);
      var handledError = await applyErrorInterceptors(this.interceptors.error, error);
      if (handledError.handled) {
        return handledError.value;
      }
      throw error;
    }

    return result;
  }

  async _xhrRequest(requestConfig) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      var settled = false;
      var body = buildRequestBody(requestConfig);

      var timeoutId = setTimeout(function() {
        if (settled) return;
        settled = true;
        xhr.abort();
        reject(makeError("Request timed out", requestConfig, null));
      }, requestConfig.timeout || self.timeout);

      xhr.onload = function() {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);

        var data;
        try { data = JSON.parse(xhr.responseText); } catch (e) { data = xhr.responseText; }

        var result = {
          data: data,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: self._parseHeaders(xhr.getAllResponseHeaders()),
          config: requestConfig,
        };

        Promise.resolve()
          .then(async function() {
            result = await applyResponseInterceptors(self.interceptors.response, result);

            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(result);
            } else {
              var error = makeError("Request failed with status " + xhr.status, requestConfig, result);
              var handledError = await applyErrorInterceptors(self.interceptors.error, error);
              if (handledError.handled) {
                resolve(handledError.value);
                return;
              }

              reject(error);
            }
          })
          .catch(reject);
      };

      xhr.onerror = function() {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(makeError("Network error", requestConfig, null));
      };

      xhr.ontimeout = function() {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        reject(makeError("Request timed out", requestConfig, null));
      };

      xhr.open(requestConfig.method, requestConfig.url);

      Object.keys(requestConfig.headers || {}).forEach(function(key) {
        xhr.setRequestHeader(key, requestConfig.headers[key]);
      });

      xhr.send(body);
    });
  }

  _parseHeaders(headerString) {
    var headers = {};
    if (!headerString) return headers;

    headerString.split("\r\n").forEach(function(line) {
      var idx = line.indexOf(": ");
      if (idx !== -1) {
        headers[line.substring(0, idx)] = line.substring(idx + 2);
      }
    });

    return headers;
  }

  get(url, config) {
    return this.request(Object.assign({}, config || {}, { url: url, method: "GET" }));
  }

  post(url, data, config) {
    return this.request(Object.assign({}, config || {}, { url: url, method: "POST", data: data }));
  }

  put(url, data, config) {
    return this.request(Object.assign({}, config || {}, { url: url, method: "PUT", data: data }));
  }

  delete(url, config) {
    return this.request(Object.assign({}, config || {}, { url: url, method: "DELETE" }));
  }

  patch(url, data, config) {
    return this.request(Object.assign({}, config || {}, { url: url, method: "PATCH", data: data }));
  }

  _buildURL(url, baseURL, params) {
    var finalURL = url || "";
    if (finalURL && finalURL.indexOf("http") === 0) {
      return appendParams(finalURL, params);
    }
    return appendParams(combineURLs(baseURL || this.baseURL, finalURL), params);
  }
}

export function createSecureHttpClient(config) {
  return createAxiosLikeInstance(config);
}

createSecureHttpClient.isCancel = SecureHttpClient.isCancel;

export var isCancel = SecureHttpClient.isCancel;

export default createSecureHttpClient;
