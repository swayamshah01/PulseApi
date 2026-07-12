import "dotenv/config";
import { defineConfig } from "vitest/config";

function getTestDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", "pulseapi_test");
  return url.toString();
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = getTestDatabaseUrl(process.env.DATABASE_URL);
process.env.JWT_ACCESS_SECRET = "test-access-secret-with-at-least-thirty-two-characters";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-at-least-thirty-two-characters";
process.env.ACCESS_TOKEN_TTL = "15m";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";
process.env.BCRYPT_ROUNDS = "4";
process.env.LOG_LEVEL = "silent";

export default defineConfig({
  test: {
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
