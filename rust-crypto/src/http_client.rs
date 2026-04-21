use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use reqwest::{Client, ClientBuilder, Method};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::runtime::Runtime;
use dashmap::DashMap;
use lru::LruCache;
use parking_lot::RwLock;
use once_cell::sync::Lazy;
use futures::future::join_all;

// Global runtime for async operations
static RUNTIME: Lazy<Runtime> = Lazy::new(|| {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(num_cpus::get().max(4))
        .thread_name("rust-http-worker")
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime")
});

// Connection pool with advanced configuration
static CLIENT_POOL: Lazy<Arc<DashMap<String, Arc<Client>>>> = Lazy::new(|| {
    Arc::new(DashMap::new())
});

// Response cache with LRU eviction
static RESPONSE_CACHE: Lazy<Arc<RwLock<LruCache<String, CachedResponse>>>> = Lazy::new(|| {
    Arc::new(RwLock::new(LruCache::new(std::num::NonZeroUsize::new(1000).unwrap())))
});

// Request metrics and monitoring
static METRICS: Lazy<Arc<DashMap<String, RequestMetrics>>> = Lazy::new(|| {
    Arc::new(DashMap::new())
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpConfig {
    pub base_url: String,
    pub timeout_ms: u64,
    pub max_connections: usize,
    pub keep_alive: bool,
    pub http2_prior_knowledge: bool,
    pub enable_compression: bool,
    pub enable_caching: bool,
    pub cache_ttl_seconds: u64,
    pub retry_attempts: u32,
    pub retry_delay_ms: u64,
    pub user_agent: String,
    pub headers: HashMap<String, String>,
}

impl Default for HttpConfig {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            timeout_ms: 30000,
            max_connections: 100,
            keep_alive: true,
            http2_prior_knowledge: true,
            enable_compression: true,
            enable_caching: true,
            cache_ttl_seconds: 300,
            retry_attempts: 3,
            retry_delay_ms: 1000,
            user_agent: "RustSecureHttp/2.0".to_string(),
            headers: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
    pub enable_cache: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub duration_ms: u64,
    pub from_cache: bool,
    pub compressed: bool,
    pub http_version: String,
}

#[derive(Debug, Clone)]
struct CachedResponse {
    response: HttpResponse,
    cached_at: SystemTime,
    ttl: Duration,
}

#[derive(Debug, Clone, Serialize)]
struct RequestMetrics {
    total_requests: u64,
    successful_requests: u64,
    failed_requests: u64,
    avg_response_time_ms: f64,
    cache_hits: u64,
    cache_misses: u64,
    bytes_sent: u64,
    bytes_received: u64,
}

impl Default for RequestMetrics {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            avg_response_time_ms: 0.0,
            cache_hits: 0,
            cache_misses: 0,
            bytes_sent: 0,
            bytes_received: 0,
        }
    }
}

// Create optimized HTTP client with advanced features
fn create_optimized_client(config: &HttpConfig) -> Result<Client, Box<dyn std::error::Error + Send + Sync>> {
    let mut builder = ClientBuilder::new()
        .timeout(Duration::from_millis(config.timeout_ms))
        .pool_max_idle_per_host(config.max_connections)
        .pool_idle_timeout(Duration::from_secs(90))
        .tcp_keepalive(if config.keep_alive { Some(Duration::from_secs(60)) } else { None })
        .http2_prior_knowledge()
        .http2_keep_alive_interval(Some(Duration::from_secs(30)))
        .http2_keep_alive_timeout(Duration::from_secs(10))
        .http2_adaptive_window(true)
        .http2_max_frame_size(Some(16384 * 4)) // 64KB frames for better throughput
        .user_agent(&config.user_agent)
        .use_rustls_tls();

    if config.enable_compression {
        builder = builder
            .gzip(true)
            .brotli(true)
            .deflate(true);
    }

    Ok(builder.build()?)
}

// Generate cache key for request
fn generate_cache_key(request: &HttpRequest) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    request.method.hash(&mut hasher);
    request.url.hash(&mut hasher);
    request.body.hash(&mut hasher);
    
    // Include relevant headers in cache key
    let mut sorted_headers: Vec<_> = request.headers.iter().collect();
    sorted_headers.sort_by_key(|&(k, _)| k);
    for (key, value) in sorted_headers {
        if !key.to_lowercase().starts_with("authorization") && 
           !key.to_lowercase().starts_with("x-") {
            key.hash(&mut hasher);
            value.hash(&mut hasher);
        }
    }
    
    format!("{:x}", hasher.finish())
}

// Check if response is cacheable
fn is_cacheable(method: &str, status: u16) -> bool {
    method.to_uppercase() == "GET" && (200..300).contains(&status)
}

// Get cached response if valid
fn get_cached_response(cache_key: &str) -> Option<HttpResponse> {
    let cache = RESPONSE_CACHE.read();
    if let Some(cached) = cache.peek(cache_key) {
        let now = SystemTime::now();
        if now.duration_since(cached.cached_at).unwrap_or(Duration::MAX) < cached.ttl {
            let mut response = cached.response.clone();
            response.from_cache = true;
            return Some(response);
        }
    }
    None
}

// Cache response if cacheable
fn cache_response(cache_key: String, response: &HttpResponse, ttl: Duration) {
    if is_cacheable("GET", response.status) {
        let cached = CachedResponse {
            response: response.clone(),
            cached_at: SystemTime::now(),
            ttl,
        };
        
        let mut cache = RESPONSE_CACHE.write();
        cache.put(cache_key, cached);
    }
}

// Update request metrics
fn update_metrics(endpoint: &str, success: bool, duration: Duration, bytes_sent: u64, bytes_received: u64, cache_hit: bool) {
    let mut metrics = METRICS.entry(endpoint.to_string()).or_insert_with(RequestMetrics::default);
    
    metrics.total_requests += 1;
    if success {
        metrics.successful_requests += 1;
    } else {
        metrics.failed_requests += 1;
    }
    
    let duration_ms = duration.as_millis() as f64;
    metrics.avg_response_time_ms = (metrics.avg_response_time_ms * (metrics.total_requests - 1) as f64 + duration_ms) / metrics.total_requests as f64;
    
    if cache_hit {
        metrics.cache_hits += 1;
    } else {
        metrics.cache_misses += 1;
    }
    
    metrics.bytes_sent += bytes_sent;
    metrics.bytes_received += bytes_received;
}

// Execute HTTP request with advanced optimizations
async fn execute_request_internal(config: HttpConfig, request: HttpRequest) -> Result<HttpResponse, Box<dyn std::error::Error + Send + Sync>> {
    let start_time = Instant::now();
    let cache_key = if config.enable_caching && request.enable_cache {
        Some(generate_cache_key(&request))
    } else {
        None
    };
    
    // Check cache first
    if let Some(ref key) = cache_key {
        if let Some(cached_response) = get_cached_response(key) {
            update_metrics(&request.url, true, start_time.elapsed(), 0, cached_response.body.len() as u64, true);
            return Ok(cached_response);
        }
    }
    
    // Get or create client for this configuration
    let client_key = format!("{}:{}:{}", config.base_url, config.timeout_ms, config.max_connections);
    let client = if let Some(existing_client) = CLIENT_POOL.get(&client_key) {
        existing_client.clone()
    } else {
        let new_client = Arc::new(create_optimized_client(&config)?);
        CLIENT_POOL.insert(client_key, new_client.clone());
        new_client
    };
    
    // Build request
    let method = Method::from_bytes(request.method.as_bytes())?;
    let url = if request.url.starts_with("http") {
        request.url.clone()
    } else {
        format!("{}{}", config.base_url.trim_end_matches('/'), request.url)
    };
    
    let mut req_builder = client.request(method, &url);
    
    // Add headers
    for (key, value) in &config.headers {
        req_builder = req_builder.header(key, value);
    }
    for (key, value) in &request.headers {
        req_builder = req_builder.header(key, value);
    }
    
    // Add body if present
    if let Some(ref body) = request.body {
        req_builder = req_builder.body(body.clone());
    }
    
    // Set timeout
    if let Some(timeout) = request.timeout_ms {
        req_builder = req_builder.timeout(Duration::from_millis(timeout));
    }
    
    // Execute with retry logic
    let mut last_error = None;
    for attempt in 0..=config.retry_attempts {
        match req_builder.try_clone().unwrap().send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                let status_text = response.status().canonical_reason().unwrap_or("Unknown").to_string();
                let http_version = format!("{:?}", response.version());
                
                // Extract headers
                let mut headers = HashMap::new();
                for (key, value) in response.headers() {
                    if let Ok(value_str) = value.to_str() {
                        headers.insert(key.to_string(), value_str.to_string());
                    }
                }
                
                // Check if response is compressed
                let compressed = headers.get("content-encoding").is_some();
                
                // Read body
                let body_bytes = response.bytes().await?;
                let body = String::from_utf8_lossy(&body_bytes).to_string();
                
                let duration = start_time.elapsed();
                let http_response = HttpResponse {
                    status,
                    status_text,
                    headers,
                    body,
                    duration_ms: duration.as_millis() as u64,
                    from_cache: false,
                    compressed,
                    http_version,
                };
                
                // Cache successful responses
                if let Some(key) = cache_key {
                    if is_cacheable(&request.method, status) {
                        cache_response(key, &http_response, Duration::from_secs(config.cache_ttl_seconds));
                    }
                }
                
                // Update metrics
                let success = (200..300).contains(&status);
                update_metrics(&request.url, success, duration, 
                             request.body.as_ref().map(|b| b.len() as u64).unwrap_or(0),
                             body_bytes.len() as u64, false);
                
                return Ok(http_response);
            }
            Err(e) => {
                last_error = Some(e);
                if attempt < config.retry_attempts {
                    tokio::time::sleep(Duration::from_millis(config.retry_delay_ms * (attempt + 1) as u64)).await;
                }
            }
        }
    }
    
    // Update failure metrics
    update_metrics(&request.url, false, start_time.elapsed(), 
                  request.body.as_ref().map(|b| b.len() as u64).unwrap_or(0), 0, false);
    
    Err(last_error.unwrap().into())
}

// Batch request execution with parallel processing
async fn execute_batch_requests_internal(config: HttpConfig, requests: Vec<HttpRequest>) -> Vec<Result<HttpResponse, String>> {
    let futures = requests.into_iter().map(|request| {
        let config = config.clone();
        async move {
            match execute_request_internal(config, request).await {
                Ok(response) => Ok(response),
                Err(e) => Err(e.to_string()),
            }
        }
    });
    
    join_all(futures).await
}

// C FFI exports
#[no_mangle]
pub extern "C" fn http_client_init() -> bool {
    // Initialize the runtime and connection pool
    Lazy::force(&RUNTIME);
    Lazy::force(&CLIENT_POOL);
    Lazy::force(&RESPONSE_CACHE);
    Lazy::force(&METRICS);
    true
}

#[no_mangle]
pub extern "C" fn http_execute_request(
    config_json: *const c_char,
    request_json: *const c_char,
) -> *mut c_char {
    let config_str = unsafe { CStr::from_ptr(config_json).to_str().unwrap() };
    let request_str = unsafe { CStr::from_ptr(request_json).to_str().unwrap() };
    
    let config: HttpConfig = match serde_json::from_str(config_str) {
        Ok(c) => c,
        Err(_) => return std::ptr::null_mut(),
    };
    
    let request: HttpRequest = match serde_json::from_str(request_str) {
        Ok(r) => r,
        Err(_) => return std::ptr::null_mut(),
    };
    
    let result = RUNTIME.block_on(execute_request_internal(config, request));
    
    match result {
        Ok(response) => {
            let response_json = serde_json::to_string(&response).unwrap();
            CString::new(response_json).unwrap().into_raw()
        }
        Err(e) => {
            let error_response = json!({
                "error": e.to_string(),
                "status": 0,
                "status_text": "Request Failed",
                "headers": {},
                "body": "",
                "duration_ms": 0,
                "from_cache": false,
                "compressed": false,
                "http_version": "Unknown"
            });
            CString::new(error_response.to_string()).unwrap().into_raw()
        }
    }
}

#[no_mangle]
pub extern "C" fn http_execute_batch_requests(
    config_json: *const c_char,
    requests_json: *const c_char,
) -> *mut c_char {
    let config_str = unsafe { CStr::from_ptr(config_json).to_str().unwrap() };
    let requests_str = unsafe { CStr::from_ptr(requests_json).to_str().unwrap() };
    
    let config: HttpConfig = match serde_json::from_str(config_str) {
        Ok(c) => c,
        Err(_) => return std::ptr::null_mut(),
    };
    
    let requests: Vec<HttpRequest> = match serde_json::from_str(requests_str) {
        Ok(r) => r,
        Err(_) => return std::ptr::null_mut(),
    };
    
    let results = RUNTIME.block_on(execute_batch_requests_internal(config, requests));
    
    let results_json = serde_json::to_string(&results).unwrap();
    CString::new(results_json).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn http_get_metrics(endpoint: *const c_char) -> *mut c_char {
    let endpoint_str = unsafe { CStr::from_ptr(endpoint).to_str().unwrap() };
    
    if let Some(metrics) = METRICS.get(endpoint_str) {
        let metrics_json = serde_json::to_string(&*metrics).unwrap();
        CString::new(metrics_json).unwrap().into_raw()
    } else {
        std::ptr::null_mut()
    }
}

#[no_mangle]
pub extern "C" fn http_clear_cache() -> bool {
    let mut cache = RESPONSE_CACHE.write();
    cache.clear();
    true
}

#[no_mangle]
pub extern "C" fn http_get_cache_stats() -> *mut c_char {
    let cache = RESPONSE_CACHE.read();
    let stats = json!({
        "size": cache.len(),
        "capacity": cache.cap().get()
    });
    CString::new(stats.to_string()).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn http_warmup_connections(base_urls_json: *const c_char) -> bool {
    let urls_str = unsafe { CStr::from_ptr(base_urls_json).to_str().unwrap() };
    let urls: Vec<String> = match serde_json::from_str(urls_str) {
        Ok(u) => u,
        Err(_) => return false,
    };
    
    RUNTIME.spawn(async move {
        let config = HttpConfig::default();
        let futures = urls.into_iter().map(|url| {
            let config = config.clone();
            async move {
                let request = HttpRequest {
                    method: "HEAD".to_string(),
                    url: format!("{}/", url),
                    headers: HashMap::new(),
                    body: None,
                    timeout_ms: Some(5000),
                    enable_cache: false,
                };
                let _ = execute_request_internal(config, request).await;
            }
        });
        join_all(futures).await;
    });
    
    true
}

#[no_mangle]
pub extern "C" fn http_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe { let _ = CString::from_raw(s); };
    }
}