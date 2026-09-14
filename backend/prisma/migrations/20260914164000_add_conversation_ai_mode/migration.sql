ALTER TABLE "WhatsAppConversation"
ADD COLUMN "aiReplyEnabled" BOOLEAN,
ADD COLUMN "aiReplyUpdatedAt" TIMESTAMP(3),
ADD COLUMN "aiReplyUpdatedBy" TEXT;
