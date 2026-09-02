CREATE TABLE "WhatsAppBroadcast" (
    "id" TEXT NOT NULL,
    "broadcastKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "recipientTotal" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppBroadcastRecipient" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "leadId" TEXT,
    "externalLeadId" INTEGER,
    "leadName" TEXT,
    "phone" TEXT NOT NULL,
    "district" TEXT,
    "material" TEXT,
    "personalizedMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "deliveryStatus" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppBroadcastRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppBroadcast_broadcastKey_key" ON "WhatsAppBroadcast"("broadcastKey");
CREATE INDEX "WhatsAppBroadcast_createdAt_idx" ON "WhatsAppBroadcast"("createdAt");
CREATE INDEX "WhatsAppBroadcastRecipient_broadcastId_idx" ON "WhatsAppBroadcastRecipient"("broadcastId");
CREATE INDEX "WhatsAppBroadcastRecipient_conversationId_idx" ON "WhatsAppBroadcastRecipient"("conversationId");
CREATE UNIQUE INDEX "WhatsAppBroadcastRecipient_broadcastId_phone_key" ON "WhatsAppBroadcastRecipient"("broadcastId", "phone");

ALTER TABLE "WhatsAppBroadcastRecipient" ADD CONSTRAINT "WhatsAppBroadcastRecipient_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "WhatsAppBroadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
