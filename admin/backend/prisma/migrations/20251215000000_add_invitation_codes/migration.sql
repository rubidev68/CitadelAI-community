-- CreateTable
-- Add InvitationCode table for admin registration
CREATE TABLE IF NOT EXISTS "InvitationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InvitationCode_code_key" ON "InvitationCode"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvitationCode_code_idx" ON "InvitationCode"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvitationCode_isActive_idx" ON "InvitationCode"("isActive");
