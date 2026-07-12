import { UrlSecurityError } from "../../security/url-validator.js";

const timeoutCodes = new Set([
  "ABORT_ERR",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);
const dnsCodes = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL", "ENODATA"]);
const sslCodes = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_SSL_WRONG_VERSION_NUMBER",
]);
const networkCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_SOCKET",
]);

function errorChain(error) {
  const errors = [];
  let current = error;

  while (current && errors.length < 4) {
    errors.push(current);
    current = current.cause;
  }

  return errors;
}

export function classifyCheckError(error) {
  const chain = errorChain(error);

  if (chain.some((item) => item instanceof UrlSecurityError)) {
    return { errorType: "BLOCKED_URL", errorMessage: "The endpoint URL is not allowed." };
  }
  if (
    chain.some(
      (item) =>
        item.name === "AbortError" ||
        item.name === "TimeoutError" ||
        timeoutCodes.has(item.code),
    )
  ) {
    return { errorType: "TIMEOUT", errorMessage: "The endpoint did not respond before the timeout." };
  }
  if (chain.some((item) => dnsCodes.has(item.code))) {
    return { errorType: "DNS", errorMessage: "The endpoint hostname could not be resolved." };
  }
  if (chain.some((item) => sslCodes.has(item.code))) {
    return { errorType: "SSL", errorMessage: "The endpoint TLS certificate or connection is invalid." };
  }
  if (chain.some((item) => networkCodes.has(item.code))) {
    return { errorType: "NETWORK", errorMessage: "The endpoint could not be reached." };
  }

  return { errorType: "UNKNOWN", errorMessage: "The endpoint check failed unexpectedly." };
}
