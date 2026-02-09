-- AlterTable
ALTER TABLE "WebsiteContext" ADD COLUMN     "cronEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cronSchedule" TEXT,
ADD COLUMN     "cronTimezone" TEXT DEFAULT 'UTC',
ADD COLUMN     "nextCrawlAt" TIMESTAMP(3);