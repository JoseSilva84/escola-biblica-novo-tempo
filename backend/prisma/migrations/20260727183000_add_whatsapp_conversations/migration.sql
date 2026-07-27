DO $$ BEGIN
  CREATE TYPE "WhatsAppDirection" AS ENUM ('INBOUND', 'OUTBOUND');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppSenderType" AS ENUM ('LEAD', 'USER', 'AI', 'AUTOMATION', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "WhatsAppConversation" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "leadId" TEXT,
  "externalLeadId" INTEGER,
  "leadName" TEXT,
  "district" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ABERTA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "leadId" TEXT,
  "externalLeadId" INTEGER,
  "direction" "WhatsAppDirection" NOT NULL,
  "senderType" "WhatsAppSenderType" NOT NULL,
  "senderName" TEXT,
  "body" TEXT NOT NULL,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "providerStatus" TEXT,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConversation_phone_key" ON "WhatsAppConversation"("phone");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_leadId_idx" ON "WhatsAppConversation"("leadId");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_externalLeadId_idx" ON "WhatsAppConversation"("externalLeadId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_conversationId_createdAt_idx" ON "WhatsAppMessage"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_leadId_idx" ON "WhatsAppMessage"("leadId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_externalLeadId_idx" ON "WhatsAppMessage"("externalLeadId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_providerMessageId_idx" ON "WhatsAppMessage"("providerMessageId");

DO $$ BEGIN
  ALTER TABLE "WhatsAppConversation"
    ADD CONSTRAINT "WhatsAppConversation_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WhatsAppMessage"
    ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WhatsAppMessage"
    ADD CONSTRAINT "WhatsAppMessage_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
