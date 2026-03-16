import CryptoUtils from "./CryptoUtils";

var hasFetch = typeof fetch !== "undefined";

function makeError(message, config, response) {
  var err = new Error(message || "Network request failed");
  err.config = config;
  err.response = response || null;
  return err;
}

class SecureHttpClient {
  constructor(config) {
    config = config || {};
    this.baseURL = config.baseURL || "";
    this.headers = config.headers || {};
    this.timeout = config.timeout || 30000;
    this.cryptoKey = config.cryptoKey || null;
    this.enableCrypto = config.enableCrypto || false;
    this.interceptors = {
      request: [],
      response: [],
      error: [],
    };
  }

  create(config) {
    config = config || {};
    return new SecureHttpClient({
      baseURL: config.baseURL || this.baseURL,
      headers: Object.assign({}, this.headers, config.headers),
      timeout: config.timeout || this.timeout,
      cryptoKey: config.cryptoKey || this.cryptoKey,
      enableCrypto: config.enableCrypto !== undefined ? config.enableCrypto : this.enableCrypto,
    });
  }

  static isCancel(error) {
    return !!(error && (error.name === "AbortError" || (error.message && error.message.indexOf("abort") !== -1)));
  }

  async request(config) {
    if (!config) throw new Error("Request config is required");

    var url = this._buildURL(config.url);
    var headers = Object.assign({}, this.headers, config.headers);
    var method = (config.method || "GET").toUpperCase();
    var requestConfig = Object.assign({}, config, { url: url, headers: headers, method: method });

    // Apply crypto if enabled — degrade gracefully if native module unavailable
    if (this.enableCrypto && this.cryptoKey && requestConfig.data) {
      try {
        var timestamp = Math.floor(Date.now() / 1000);
        var nonce = CryptoUtils.generateNonce();
        var encrypted = await CryptoUtils.encrypt(JSON.stringify(requestConfig.data), this.cryptoKey);
        var signature = await CryptoUtils.sign(encrypted, timestamp, this.cryptoKey);
        requestConfig.data = { data: encrypted, timestamp: timestamp, signature: signature, nonce: nonce };
      } catch (e) {
        // Native Rust crypto module unavailable — send data unencrypted
      }
    }

    // Run request interceptors — single function per entry, no error handler arg
    for (var i = 0; i < this.interceptors.request.length; i++) {
      try {
        requestConfig = await this.interceptors.request[i](requestConfig);
        if (!requestConfig) throw new Error("Request interceptor returned undefined config");
      } catch (e) {
        throw makeError(e && e.message, requestConfig, null);
      }
    }

    try {
      var result = hasFetch
        ? await this._fetchRequest(requestConfig)
        : await this._xhrRequest(requestConfig);

      // Decrypt response if crypto enabled
      if (this.enableCrypto && this.cryptoKey && result.data && result.data.data) {
        try {
          var decrypted = await CryptoUtils.decrypt(result.data.data, this.cryptoKey);
          result.data = JSON.parse(decrypted);
        } catch (e) {
          // Native crypto unavailable — return raw response data
        }
      }

      return result;
    } catch (e) {
      if (e && e.response) throw e;
      throw makeError(e && e.message, requestConfig, null);
    }
  }

  async _fetchRequest(requestConfig) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function() { controller.abort(); }, requestConfig.timeout || this.timeout) : null;

    var fetchResponse;
    try {
      fetchResponse = await fetch(requestConfig.url, {
        method: requestConfig.method,
        headers: requestConfig.headers,
        body: requestConfig.data ? JSON.stringify(requestConfig.data) : undefined,
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

    // Run response interceptors
    for (var i = 0; i < this.interceptors.response.length; i++) {
      try {
        result = await this.interceptors.response[i](result);
      } catch (e) {
        // Interceptor error (e.g. SecureStorage unavailable) — continue with result
      }
    }

    if (!fetchResponse.ok) {
      var error = makeError("Request failed with status " + fetchResponse.status, requestConfig, result);
      // Run error interceptors
      for (var j = 0; j < this.interceptors.error.length; j++) {
        try {
          var handled = await this.interceptors.error[j](error);
          if (handled !== undefined) return handled;
        } catch (e) {
          throw e;
        }
      }
      throw error;
    }

    return result;
  }

  async _xhrRequest(requestConfig) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();

      var timeoutId = setTimeout(function() {
        xhr.abort();
        reject(makeError("Request timed out", requestConfig, null));
      }, requestConfig.timeout || self.timeout);

      xhr.onload = async function() {
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

        // Run response interceptors
        for (var i = 0; i < self.interceptors.response.length; i++) {
          try {
            result = await self.interceptors.response[i](result);
          } catch (e) {
            // Interceptor error — continue with result
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(result);
        } else {
          var error = makeError("Request failed with status " + xhr.status, requestConfig, result);
          for (var j = 0; j < self.interceptors.error.length; j++) {
            try {
              var handled = await self.interceptors.error[j](error);
              if (handled !== undefined) { resolve(handled); return; }
            } catch (e) {
              reject(e); return;
            }
          }
          reject(error);
        }
      };

      xhr.onerror = function() {
        clearTimeout(timeoutId);
        reject(makeError("Network error", requestConfig, null));
      };

      xhr.open(requestConfig.method, requestConfig.url);

      Object.keys(requestConfig.headers).forEach(function(key) {
        xhr.setRequestHeader(key, requestConfig.headers[key]);
      });

      xhr.send(requestConfig.data ? JSON.stringify(requestConfig.data) : undefined);
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

  _buildURL(url) {
    if (url && url.indexOf("http") === 0) return url;
    return this.baseURL + url;
  }
}

export function createSecureHttpClient(config) {
  var client = new SecureHttpClient(config);
  client.isCancel = SecureHttpClient.isCancel;
  return client;
}

export var isCancel = SecureHttpClient.isCancel;

export default createSecureHttpClient;
