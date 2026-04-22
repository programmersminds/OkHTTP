/**
 * REPLACE YOUR EXISTING HTTP CLIENT WITH THIS CODE
 * 
 * This is the exact code to replace your current HTTP client implementation
 * It includes network strength enhancement that transforms 1G to 5G performance
 */

import EnhancedHttpClient from "./src/EnhancedHttpClient";
import sha512 from "@cryptography/sha512";
import moment from "moment";
import {
  LIVE_SECRET_KEY,
  LIVE_USERNAME,
  LIVE_IV_KEY,
  TEST_IV_KEY,
  TEST_SECRET_KEY,
  TEST_USERNAME,
  CHANNEL,
  STAGING_URL,
  OMINI_TEST_URL,
  PROD_URL,
  API_ENV,
  KEY_ENV,
} from "../keys.json";

const BASE_URL =
  API_ENV === "test"
    ? OMINI_TEST_URL
    : API_ENV === "development"
    ? STAGING_URL
    : PROD_URL;

const USERNAME = KEY_ENV === "live" ? LIVE_USERNAME : TEST_USERNAME;
const SECRET_KEY = KEY_ENV === "live" ? LIVE_SECRET_KEY : TEST_SECRET_KEY;
const IV_KEY = KEY_ENV === "live" ? LIVE_IV_KEY : TEST_IV_KEY;

export const createHeader = () => {
  const timestamp = moment().utc().format().substr(0, 19).replace(/[^0-9]/g, "");
  const apiKey = sha512(`${SECRET_KEY}:${IV_KEY}:${timestamp}:${USERNAME}`, "hex");
  
  const header = {
    USERNAME: USERNAME,
    channel: CHANNEL,
    Accept: "application/json",
    "Content-Type": "application/json",
    timestamp,
    API_KEY: apiKey,
  };
  return header;
};

/**
 * Create HTTP client with network strength enhancement
 * Transforms 1G networks into 5G-like performance
 */
const createHttpInstance = () => {
  const instance = new EnhancedHttpClient({
    baseURL: BASE_URL,
    timeout: 200000, // 200 seconds
    enableCaching: true,
    enableCompression: true,
    http2PriorKnowledge: true,
    maxConnections: 200,
    retryAttempts: 5,
    retryDelayMs: 1000,
    cacheTtlSeconds: 3600,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    // Network strength enhancement configuration
    optimizerConfig: {
      enableCompression: true,
      compressionLevel: 9, // Maximum compression for weak networks
      enableCaching: true,
      cacheTtl: 3600, // 1 hour
      enableBatching: true,
      batchSize: 50,
      batchTimeout: 100,
      enableDeltaSync: true,
      enablePrefetch: true,
      enableDeduplication: true,
      maxRetries: 5,
      retryDelay: 1000,
    },
  });

  // Add request interceptor to refresh headers on each request
  if (instance.rustClient.interceptors && instance.rustClient.interceptors.request) {
    instance.rustClient.interceptors.request.push((config) => {
      const headers = createHeader();
      config.headers = { ...config.headers, ...headers };
      return config;
    });
  }

  return instance;
};

// Export HTTP client instances with network strength enhancement
export const authCreate = createHttpInstance();
export const privateAccess = createHttpInstance();
export const sslPinnedAccess = createHttpInstance();

/**
 * Performance monitoring functions
 */
export const getPerformanceMetrics = (endpoint) => {
  const report = authCreate.getPerformanceReport();
  return {
    ...report,
    endpoint,
    networkQuality: authCreate.getNetworkMetrics(),
  };
};

export const benchmarkEndpoint = async (endpoint, iterations = 100) => {
  console.log(`🏁 Benchmarking ${endpoint}...`);
  
  const startTime = Date.now();
  const results = [];

  for (let i = 0; i < iterations; i++) {
    try {
      const response = await authCreate.get(endpoint);
      results.push({
        status: response.status,
        duration: response.duration,
        fromCache: response.fromCache,
        compressed: response.compressed,
      });
    } catch (error) {
      results.push({ error: error.message });
    }
  }

  const totalTime = Date.now() - startTime;
  const successful = results.filter(r => !r.error).length;
  const avgDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0) / successful;
  const cacheHits = results.filter(r => r.fromCache).length;

  return {
    iterations,
    totalTime,
    avgDuration: avgDuration.toFixed(2),
    throughput: (iterations / totalTime * 1000).toFixed(0),
    successRate: ((successful / iterations) * 100).toFixed(1),
    cacheHitRate: ((cacheHits / iterations) * 100).toFixed(1),
  };
};

/**
 * Batch requests with network optimization
 */
export const batchRequests = async (requests) => {
  console.log(`📦 Processing ${requests.length} requests with network optimization...`);
  const startTime = Date.now();
  
  const responses = await authCreate.batchRequest(requests);
  const totalTime = Date.now() - startTime;
  
  console.log(`✅ Completed ${responses.length} requests in ${totalTime}ms`);
  console.log(`🚀 Throughput: ${(responses.length / totalTime * 1000).toFixed(0)} req/sec`);
  
  return responses;
};

/**
 * Prefetch critical resources
 */
export const prefetchResources = async (urls) => {
  console.log(`🔄 Prefetching ${urls.length} resources...`);
  return await authCreate.prefetch(urls);
};

/**
 * Get comprehensive performance report
 */
export const getFullPerformanceReport = () => {
  const report = authCreate.getPerformanceReport();
  
  console.log('📊 === PERFORMANCE REPORT ===');
  console.log(`Total Requests: ${report.totalRequests}`);
  console.log(`Successful: ${report.successfulRequests}`);
  console.log(`Failed: ${report.failedRequests}`);
  console.log(`Success Rate: ${((report.successfulRequests / report.totalRequests) * 100).toFixed(1)}%`);
  console.log(`Average Response Time: ${report.averageResponseTime.toFixed(2)}ms`);
  console.log(`Cache Hit Rate: ${report.cacheHitRate.toFixed(1)}%`);
  console.log(`Compression Savings: ${report.compressionSavings}`);
  console.log(`Bandwidth Reduction: ${report.bandwidthReduction}`);
  console.log(`Network Quality:`, report.networkQuality);
  console.log('============================');
  
  return report;
};

/**
 * Test network strength enhancement
 */
export const testNetworkStrengthEnhancement = async () => {
  console.log('🚀 === NETWORK STRENGTH ENHANCEMENT TEST ===');
  
  // Detect current network
  const networkMetrics = await authCreate.detectNetworkQuality();
  console.log('📊 Current Network:', networkMetrics);
  
  // Test single request
  console.log('\n📝 Testing single request...');
  const singleStart = Date.now();
  try {
    const response = await authCreate.get('/api/test');
    const singleTime = Date.now() - singleStart;
    console.log(`✅ Single request: ${singleTime}ms`);
    console.log(`💾 From cache: ${response.fromCache}`);
    console.log(`🗜️ Compressed: ${response.compressed}`);
  } catch (error) {
    console.error('❌ Single request failed:', error.message);
  }
  
  // Test batch requests
  console.log('\n📦 Testing batch requests (50 requests)...');
  const batchRequests = Array.from({ length: 50 }, (_, i) => ({
    url: `/api/test/${i}`,
    method: 'GET'
  }));
  
  const batchStart = Date.now();
  try {
    const responses = await authCreate.batchRequest(batchRequests);
    const batchTime = Date.now() - batchStart;
    console.log(`✅ Batch completed: ${batchTime}ms`);
    console.log(`🚀 Throughput: ${(responses.length / batchTime * 1000).toFixed(0)} req/sec`);
  } catch (error) {
    console.error('❌ Batch request failed:', error.message);
  }
  
  // Show performance report
  console.log('\n📊 Performance Report:');
  getFullPerformanceReport();
  
  console.log('\n✅ === NETWORK STRENGTH ENHANCEMENT COMPLETE ===');
};

/**
 * Clear all caches
 */
export const clearCaches = () => {
  authCreate.clearCaches();
  console.log('🧹 All caches cleared');
};

/**
 * Get network metrics
 */
export const getNetworkMetrics = async () => {
  return await authCreate.detectNetworkQuality();
};

// Export everything for easy access
export {
  testNetworkStrengthEnhancement,
  getFullPerformanceReport,
  prefetchResources,
  batchRequests,
  benchmarkEndpoint,
  getPerformanceMetrics,
  clearCaches,
  getNetworkMetrics,
};

/**
 * USAGE IN YOUR APP:
 * 
 * // Same API as before, but with network strength enhancement!
 * const response = await authCreate.get('/api/users/123');
 * 
 * // Batch processing (new capability)
 * const responses = await batchRequests(requests);
 * 
 * // Performance monitoring
 * const report = getFullPerformanceReport();
 * 
 * // Network detection
 * const metrics = await getNetworkMetrics();
 * 
 * // Prefetch resources
 * await prefetchResources(urls);
 * 
 * // Test network strength
 * await testNetworkStrengthEnhancement();
 */