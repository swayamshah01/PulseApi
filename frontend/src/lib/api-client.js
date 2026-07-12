import { env } from "../config/env.js";

export class ApiError extends Error {
  constructor({ code, message, details = [] }, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export async function apiRequest(path, { accessToken, ...options } = {}) {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();

  if (response.status === 204) return null;

  if (!response.ok || !body?.success) {
    throw new ApiError(
      body.error ?? {
        code: "REQUEST_FAILED",
        message: "The request could not be completed.",
      },
      response.status,
    );
  }

  return body.meta === undefined
    ? body.data
    : { data: body.data, meta: body.meta };
}
