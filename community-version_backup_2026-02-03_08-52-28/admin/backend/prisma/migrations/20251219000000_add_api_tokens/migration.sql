-- CreateEnum
-- Add ApiTokenType enum
CREATE TYPE "ApiTokenType" AS ENUM ('DURATION', 'USAGE', 'PERMANENT');

-- CreateTable
-- Add ApiToken table for chatbot API access
CREATE TABLE IF NOT EXISTS "ApiToken" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "blockId" TEXT,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenType" "ApiTokenType" NOT NULL DEFAULT 'DURATION',
    "expiresAt" TIMESTAMP(3),
    "maxUsage" INTEGER,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiToken_blockId_key" ON "ApiToken"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiToken_token_key" ON "ApiToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApiToken_chatbotId_idx" ON "ApiToken"("chatbotId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApiToken_blockId_idx" ON "ApiToken"("blockId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApiToken_token_idx" ON "ApiToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApiToken_isActive_idx" ON "ApiToken"("isActive");

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
