export function sendSuccess(response, data, { statusCode = 200, meta } = {}) {
  const body = { success: true, data };

  if (meta !== undefined) {
    body.meta = meta;
  }

  return response.status(statusCode).json(body);
}

