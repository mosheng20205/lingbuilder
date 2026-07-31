CREATE TABLE "ModuleArtifact" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "arch" TEXT NOT NULL DEFAULT 'any',
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "signature" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "minimumIdeVersion" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModuleArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModuleArtifact_storageKey_key" ON "ModuleArtifact"("storageKey");
CREATE UNIQUE INDEX "ModuleArtifact_productId_version_arch_key" ON "ModuleArtifact"("productId", "version", "arch");
CREATE INDEX "ModuleArtifact_productId_enabled_createdAt_idx" ON "ModuleArtifact"("productId", "enabled", "createdAt");
ALTER TABLE "ModuleArtifact" ADD CONSTRAINT "ModuleArtifact_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ModuleProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
