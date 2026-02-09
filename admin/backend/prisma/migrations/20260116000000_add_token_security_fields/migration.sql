-- AlterTable
ALTER TABLE "ApiToken" ADD COLUMN "rateLimitPerMinute" INTEGER,
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "revokedBy" TEXT,
ADD COLUMN "revocationReason" TEXT,
ADD COLUMN "scheduledRevocationAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ApiToken_revokedAt_idx" ON "ApiToken"("revokedAt");

-- CreateIndex
CREATE INDEX "ApiToken_scheduledRevocationAt_idx" ON "ApiToken"("scheduledRevocationAt");
