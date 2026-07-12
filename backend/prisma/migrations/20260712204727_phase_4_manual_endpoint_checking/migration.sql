-- CreateEnum
CREATE TYPE "ErrorType" AS ENUM ('TIMEOUT', 'DNS', 'NETWORK', 'SSL', 'INVALID_STATUS', 'BLOCKED_URL', 'UNKNOWN');

-- CreateTable
CREATE TABLE "CheckResult" (
    "id" BIGSERIAL NOT NULL,
    "monitorId" UUID NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "responseTimeMs" INTEGER NOT NULL,
    "errorType" "ErrorType",
    "errorMessage" TEXT,
    "responseSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckResult_monitorId_checkedAt_idx" ON "CheckResult"("monitorId", "checkedAt" DESC);

-- AddForeignKey
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
