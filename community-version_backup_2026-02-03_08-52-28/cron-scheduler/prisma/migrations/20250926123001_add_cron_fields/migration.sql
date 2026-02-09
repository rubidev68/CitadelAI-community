-- AlterTable (idempotent - only add columns if they don't exist)
DO $$ 
BEGIN
    -- Add cronEnabled column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'WebsiteContext' AND column_name = 'cronEnabled'
    ) THEN
        ALTER TABLE "WebsiteContext" ADD COLUMN "cronEnabled" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    -- Add cronSchedule column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'WebsiteContext' AND column_name = 'cronSchedule'
    ) THEN
        ALTER TABLE "WebsiteContext" ADD COLUMN "cronSchedule" TEXT;
    END IF;
    
    -- Add cronTimezone column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'WebsiteContext' AND column_name = 'cronTimezone'
    ) THEN
        ALTER TABLE "WebsiteContext" ADD COLUMN "cronTimezone" TEXT DEFAULT 'UTC';
    END IF;
    
    -- Add nextCrawlAt column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'WebsiteContext' AND column_name = 'nextCrawlAt'
    ) THEN
        ALTER TABLE "WebsiteContext" ADD COLUMN "nextCrawlAt" TIMESTAMP(3);
    END IF;
END $$;