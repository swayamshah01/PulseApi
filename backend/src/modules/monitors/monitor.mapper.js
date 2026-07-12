export function mapMonitor(monitor) {
  return {
    id: monitor.id,
    name: monitor.name,
    url: monitor.url,
    method: monitor.method,
    expectedStatusCode: monitor.expectedStatusCode,
    timeoutMs: monitor.timeoutMs,
    intervalSeconds: monitor.intervalSeconds,
    status: monitor.status,
    isUp: monitor.isUp,
    lastStatusCode: monitor.lastStatusCode,
    lastResponseTimeMs: monitor.lastResponseTimeMs,
    lastCheckedAt: monitor.lastCheckedAt,
    nextCheckAt: monitor.nextCheckAt,
    consecutiveFailures: monitor.consecutiveFailures,
    createdAt: monitor.createdAt,
    updatedAt: monitor.updatedAt,
  };
}
