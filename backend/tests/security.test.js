import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { isBlockedAddress } from "../src/security/ip-ranges.js";
import { secureGet } from "../src/security/secure-http-client.js";
import {
  UrlSecurityError,
  validateUrlDestination,
} from "../src/security/url-validator.js";

describe("URL security", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
  ])("blocks non-public address %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it("allows public addresses", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });

  it.each([
    "http://localhost:4000",
    "http://127.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "https://user:password@example.com",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(validateUrlDestination(url)).rejects.toBeInstanceOf(UrlSecurityError);
  });

  it("rejects hostnames when any DNS result is private", async () => {
    const dnsLookup = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ];

    await expect(
      validateUrlDestination("https://example.com", { dnsLookup }),
    ).rejects.toBeInstanceOf(UrlSecurityError);
  });

  it("returns a validated public address", async () => {
    const result = await validateUrlDestination("https://example.com/path", {
      dnsLookup: async () => [{ address: "93.184.216.34", family: 4 }],
    });

    expect(result).toMatchObject({ address: "93.184.216.34", family: 4 });
  });
});

describe("secure HTTP client", () => {
  it("performs a real GET through the validated pinned address", async () => {
    const server = createServer((request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("healthy");
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const { port } = server.address();
      const result = await secureGet(`http://public.example:${port}/health`, {
        timeoutMs: 1000,
        validateDestination: async (url) => ({
          url: new URL(url),
          address: "127.0.0.1",
          family: 4,
        }),
      });

      expect(result.statusCode).toBe(200);
      expect(result.responseSizeBytes).toBe(7);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("revalidates redirects", async () => {
    const validations = [];
    const server = createServer((request, response) => {
      if (request.url === "/start") {
        response.writeHead(302, { location: "/final" });
        response.end();
      } else {
        response.writeHead(204);
        response.end();
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const { port } = server.address();
      const result = await secureGet(`http://public.example:${port}/start`, {
        timeoutMs: 1000,
        validateDestination: async (url) => {
          validations.push(url);
          return { url: new URL(url), address: "127.0.0.1", family: 4 };
        },
      });

      expect(result.statusCode).toBe(204);
      expect(validations).toHaveLength(2);
      expect(validations[1]).toContain("/final");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("enforces the response-size limit", async () => {
    const server = createServer((_request, response) => response.end("too large"));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const { port } = server.address();
      await expect(
        secureGet(`http://public.example:${port}/`, {
          timeoutMs: 1000,
          maxResponseBytes: 3,
          validateDestination: async (url) => ({
            url: new URL(url),
            address: "127.0.0.1",
            family: 4,
          }),
        }),
      ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
