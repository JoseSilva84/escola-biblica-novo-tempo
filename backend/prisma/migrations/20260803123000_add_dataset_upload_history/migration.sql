CREATE TABLE "DatasetUploadHistory" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "associationId" TEXT,
  "associationName" TEXT,
  "uploadedById" TEXT,
  "uploadedByName" TEXT,
  "uploadedByEmail" TEXT,
  "uploadedFiles" JSONB NOT NULL,
  "summary" JSONB NOT NULL,
  "alerts" JSONB,
  "newLeads" INTEGER NOT NULL DEFAULT 0,
  "rowsBefore" INTEGER NOT NULL DEFAULT 0,
  "rowsAfter" INTEGER NOT NULL DEFAULT 0,
  "districts" JSONB,
  "ml" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DatasetUploadHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DatasetUploadHistory_createdAt_idx" ON "DatasetUploadHistory"("createdAt");
CREATE INDEX "DatasetUploadHistory_associationId_idx" ON "DatasetUploadHistory"("associationId");
