ALTER TABLE "WhatsAppBroadcast"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN "scheduledAt" TIMESTAMP(3),
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "aiReplyEnabled" BOOLEAN,
ADD COLUMN "lastError" TEXT;

CREATE INDEX "WhatsAppBroadcast_status_scheduledAt_idx"
ON "WhatsAppBroadcast"("status", "scheduledAt");
