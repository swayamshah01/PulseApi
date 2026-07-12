export function mapCheckResult(result) {
  return {
    id: result.id.toString(),
    monitorId: result.monitorId,
    checkedAt: result.checkedAt,
    success: result.success,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    errorType: result.errorType,
    errorMessage: result.errorMessage,
    responseSizeBytes: result.responseSizeBytes,
  };
}
