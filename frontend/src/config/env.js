const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is required. Copy .env.example to .env.");
}

try {
  new URL(apiBaseUrl);
} catch {
  throw new Error("VITE_API_BASE_URL must be a valid absolute URL.");
}

export const env = Object.freeze({
  apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
});
