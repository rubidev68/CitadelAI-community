/*
  Warnings:

  - You are about to drop the column `crawledPagesCount` on the `Chatbot` table. All the data in the column will be lost.
  - You are about to drop the column `crawlingStatus` on the `Chatbot` table. All the data in the column will be lost.
  - You are about to drop the column `lastCrawledAt` on the `Chatbot` table. All the data in the column will be lost.

*/
-- AlterTable (only if column doesn't exist)
DO $$ BEGIN
    ALTER TABLE "AdminUser" ADD COLUMN "name" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- AlterTable
ALTER TABLE "Chatbot" DROP COLUMN IF EXISTS "crawledPagesCount",
DROP COLUMN IF EXISTS "crawlingStatus",
DROP COLUMN IF EXISTS "lastCrawledAt";

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "WebsiteContext" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "recursive" BOOLEAN NOT NULL DEFAULT false,
    "maxDepth" INTEGER NOT NULL DEFAULT 3,
    "crawlingStatus" JSONB,
    "lastCrawledAt" TIMESTAMP(3),
    "crawledPagesCount" INTEGER,

    CONSTRAINT "WebsiteContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteContext_blockId_key" ON "WebsiteContext"("blockId");

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    ALTER TABLE "WebsiteContext" ADD CONSTRAINT "WebsiteContext_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;