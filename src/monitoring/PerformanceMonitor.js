class PerformanceMonitor {
  constructor(telemetryClient) {
    this.telemetry = telemetryClient;
    this.metrics = new Map();
  }

  startOperation(operationId) {
    this.metrics?.set(operationId, { startTime: Date?.now() });
  }

  endOperation(operationId, success = true, metadata = {}) {
    const metric = this.metrics?.get(operationId);
    if (!metric) return;

    const duration = Date.now() - metric.startTime;
    this.metrics?.delete(operationId);

    this.telemetry?.trackMetric(`operation.${operationId}.duration`, duration, {
      success: String(success),
      ...metadata
    });

    return duration;
  }

  trackHttpRequest(config, response, error = null) {
    const duration = response?.duration || 0;
    const success = !error && response?.status >= 200 && response?.status < 400;
    
    this.telemetry?.trackRequest(
      config.method || 'GET',
      config.url,
      duration,
      response?.status || 0,
      success,
      {
        tlsVersion: response?.tlsVersion,
        errorType: error?.name,
        ...config.metadata
      }
    );

    this.telemetry?.trackDependency(
      'HTTP',
      'HTTP',
      new URL(config.url).hostname,
      duration,
      success,
      response?.status || 0,
      { method: config.method }
    );
  }
}

export default PerformanceMonitor;
