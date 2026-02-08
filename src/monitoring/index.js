import TelemetryClient from './TelemetryClient';
import PerformanceMonitor from './PerformanceMonitor';
import ScreenshotCapture from './ScreenshotCapture';

class MonitoringManager {
  static instance = null;

  static initialize(config = {}) {
    if (!MonitoringManager.instance) {
      MonitoringManager.instance = new MonitoringManager(config);
    }
    return MonitoringManager.instance;
  }

  static getInstance() {
    return MonitoringManager.instance;
  }

  constructor(config) {
    this.telemetry = new TelemetryClient(config);
    this.performance = new PerformanceMonitor(this.telemetry);
    this.screenshot = new ScreenshotCapture();
    this.captureScreenshotsOnError = config.captureScreenshotsOnError !== false;
  }

  createRequestInterceptor() {
    return (config) => {
      config._requestStartTime = Date.now();
      config._requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.performance.startOperation(config._requestId);
      return config;
    };
  }

  createResponseInterceptor() {
    return (response) => {
      if (response.config._requestStartTime) {
        response.duration = Date.now() - response.config._requestStartTime;
      }
      
      if (response.config._requestId) {
        this.performance.endOperation(response.config._requestId, true, {
          status: response.status,
          url: response.config.url
        });
      }

      this.performance.trackHttpRequest(response.config, response);
      return response;
    };
  }

  createErrorInterceptor() {
    return async (error) => {
      const response = error.response;
      const config = error.config || {};

      if (config._requestStartTime) {
        error.duration = Date.now() - config._requestStartTime;
      }

      if (config._requestId) {
        this.performance.endOperation(config._requestId, false, {
          status: response?.status,
          error: error.message
        });
      }

      let screenshot = null;
      if (this.captureScreenshotsOnError && this.screenshot.isAvailable()) {
        screenshot = await this.screenshot.captureScreen();
      }

      this.performance.trackHttpRequest(config, response, error);
      this.telemetry.trackException(error, {
        url: config.url,
        method: config.method,
        status: response?.status,
        screenshot
      });

      return Promise.reject(error);
    };
  }

  trackEvent(name, properties, measurements) {
    this.telemetry.trackEvent(name, properties, measurements);
  }

  trackMetric(name, value, properties) {
    this.telemetry.trackMetric(name, value, properties);
  }

  trackException(error, properties) {
    this.telemetry.trackException(error, properties);
  }

  setScreenshotView(ref) {
    this.screenshot.setViewRef(ref);
  }

  async captureScreenshot() {
    return await this.screenshot.captureScreen();
  }

  flush() {
    return this.telemetry.flush();
  }

  dispose() {
    this.telemetry.dispose();
  }
}

export default MonitoringManager;
export { TelemetryClient, PerformanceMonitor, ScreenshotCapture };
