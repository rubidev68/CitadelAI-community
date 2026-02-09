-- AlterTable
ALTER TABLE "Chatbot" ADD COLUMN     "crawledPagesCount" INTEGER,
ADD COLUMN     "crawlingStatus" JSONB,
ADD COLUMN     "lastCrawledAt" TIMESTAMP(3);
