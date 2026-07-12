import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isBlockedAddress } from "./ip-ranges.js";

const blockedHostnames = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "host.docker.internal",
  "kubernetes.default",
]);

export class UrlSecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = "UrlSecurityError";
    this.code = "URL_NOT_ALLOWED";
  }
}

function normalizedHostname(url) {
  return url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

export async function validateUrlDestination(rawUrl, { dnsLookup = lookup } = {}) {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlSecurityError("The monitor URL is invalid.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UrlSecurityError("Only HTTP and HTTPS destinations are allowed.");
  }
  if (url.username || url.password) {
    throw new UrlSecurityError("URLs containing credentials are not allowed.");
  }

  const hostname = normalizedHostname(url);
  if (
    !hostname ||
    blockedHostnames.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new UrlSecurityError("The destination hostname is not allowed.");
  }

  let addresses;
  if (isIP(hostname)) {
    addresses = [{ address: hostname, family: isIP(hostname) }];
  } else {
    addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  }

  if (!addresses.length) {
    const error = new Error("The destination hostname did not resolve.");
    error.code = "ENOTFOUND";
    throw error;
  }

  if (addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new UrlSecurityError("The destination resolves to a blocked network address.");
  }

  return {
    url,
    address: addresses[0].address,
    family: addresses[0].family,
  };
}
