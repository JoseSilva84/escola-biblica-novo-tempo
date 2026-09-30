CREATE TABLE IF NOT EXISTS "WhatsAppMessageTemplate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "greeting" TEXT NOT NULL DEFAULT 'boa-noite',
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppMessageTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WhatsAppMessageTemplate_createdAt_idx" ON "WhatsAppMessageTemplate"("createdAt");
