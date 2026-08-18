CREATE TABLE "LeadGeocode" (
  "addressHash" TEXT NOT NULL,
  "externalLeadId" INTEGER,
  "leadName" TEXT,
  "address" TEXT NOT NULL,
  "district" TEXT,
  "neighborhood" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "provider" TEXT NOT NULL DEFAULT 'nominatim',
  "precision" TEXT,
  "displayName" TEXT,
  "notFound" BOOLEAN NOT NULL DEFAULT false,
  "geocodedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadGeocode_pkey" PRIMARY KEY ("addressHash")
);

CREATE INDEX "LeadGeocode_externalLeadId_idx" ON "LeadGeocode"("externalLeadId");
CREATE INDEX "LeadGeocode_district_idx" ON "LeadGeocode"("district");
CREATE INDEX "LeadGeocode_notFound_idx" ON "LeadGeocode"("notFound");
