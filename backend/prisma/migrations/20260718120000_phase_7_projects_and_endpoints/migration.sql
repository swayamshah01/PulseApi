-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- Add the project reference as nullable while existing endpoints are backfilled.
ALTER TABLE "Monitor" ADD COLUMN "projectId" UUID;

-- Preserve every existing endpoint and its check history under one project per owner.
INSERT INTO "Project" ("id", "userId", "name", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "userId", 'Imported endpoints',
       'Endpoints created before project grouping was introduced.',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Monitor"
GROUP BY "userId";

UPDATE "Monitor" AS monitor
SET "projectId" = project."id"
FROM "Project" AS project
WHERE project."userId" = monitor."userId"
  AND project."name" = 'Imported endpoints';

ALTER TABLE "Monitor" ALTER COLUMN "projectId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_name_key" ON "Project"("userId", "name");
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt" DESC);
CREATE INDEX "Monitor_projectId_idx" ON "Monitor"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
