ALTER TABLE "WhatsAppBroadcast"
ADD COLUMN "campaignId" TEXT;

CREATE INDEX "WhatsAppBroadcast_campaignId_idx"
ON "WhatsAppBroadcast"("campaignId");

ALTER TABLE "WhatsAppBroadcast"
ADD CONSTRAINT "WhatsAppBroadcast_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
