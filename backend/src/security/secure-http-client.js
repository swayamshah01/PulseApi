import { Agent, request } from "undici";
import { validateUrlDestination } from "./url-validator.js";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export class ResponseTooLargeError extends Error {
  constructor() {
    super("The response exceeded the configured size limit.");
    this.name = "ResponseTooLargeError";
    this.code = "RESPONSE_TOO_LARGE";
  }
}

async function consumeBody(body, maxResponseBytes) {
  let size = 0;

  for await (const chunk of body) {
    size += chunk.length;
    if (size > maxResponseBytes) {
      body.destroy(new ResponseTooLargeError());
      throw new ResponseTooLargeError();
    }
  }

  return size;
}

export async function secureGet(
  rawUrl,
  {
    timeoutMs,
    maxRedirects = 3,
    maxResponseBytes = 1_048_576,
    validateDestination = validateUrlDestination,
    requestImpl = request,
  },
) {
  let currentUrl = new URL(rawUrl);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const destination = await validateDestination(currentUrl.toString());
    const dispatcher = new Agent({
      connect: {
        lookup(_hostname, _options, callback) {
          if (_options?.all) {
            callback(null, [
              { address: destination.address, family: destination.family },
            ]);
          } else {
            callback(null, destination.address, destination.family);
          }
        },
      },
    });

    try {
      const response = await requestImpl(currentUrl, {
        method: "GET",
        dispatcher,
        maxRedirections: 0,
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: "*/*",
          "user-agent": "PulseAPI-Monitor/1.0",
        },
      });
      const responseSizeBytes = await consumeBody(response.body, maxResponseBytes);

      if (redirectStatuses.has(response.statusCode) && response.headers.location) {
        if (redirectCount === maxRedirects) {
          const error = new Error("The endpoint exceeded the redirect limit.");
          error.code = "TOO_MANY_REDIRECTS";
          throw error;
        }

        currentUrl = new URL(response.headers.location, currentUrl);
        continue;
      }

      return {
        statusCode: response.statusCode,
        responseSizeBytes,
        finalUrl: currentUrl.toString(),
      };
    } finally {
      await dispatcher.close();
    }
  }

  throw new Error("The endpoint check could not be completed.");
}
