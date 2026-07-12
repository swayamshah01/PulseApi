import "dotenv/config";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const testDatabaseUrl = new URL(process.env.DATABASE_URL);
testDatabaseUrl.searchParams.set("schema", "pulseapi_test");

const admin = new PrismaClient();

try {
  await admin.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS "pulseapi_test"');
} finally {
  await admin.$disconnect();
}

const migration = spawnSync(
  process.execPath,
  [prismaCli, "migrate", "deploy"],
  {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl.toString() },
    stdio: "inherit",
  },
);

if (migration.status !== 0) {
  process.exit(migration.status ?? 1);
}
