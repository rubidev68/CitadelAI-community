-- Add maxMessages and maxPages columns to SubscriptionPlan table
-- Only if SubscriptionPlan table exists (skip on custom instances without paywall)
DO $$
BEGIN
    -- Check if SubscriptionPlan table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan'
    ) THEN
        -- Add maxMessages column
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan' AND column_name = 'maxMessages'
        ) THEN
            ALTER TABLE "SubscriptionPlan" ADD COLUMN "maxMessages" INTEGER;
        END IF;

        -- Add maxPages column
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan' AND column_name = 'maxPages'
        ) THEN
            ALTER TABLE "SubscriptionPlan" ADD COLUMN "maxPages" INTEGER;
        END IF;
    END IF;
END $$;

-- Update existing plans with default values
-- Only if SubscriptionPlan table exists (skip on custom instances without paywall)
DO $$
BEGIN
    -- Check if SubscriptionPlan table exists before updating
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan'
    ) THEN
        -- Set Starter plan limits
        UPDATE "SubscriptionPlan" 
        SET "maxMessages" = 1000, "maxPages" = 500 
        WHERE LOWER("name") = 'starter' AND ("maxMessages" IS NULL OR "maxPages" IS NULL);

        -- Set Professional/Pro plan limits
        UPDATE "SubscriptionPlan" 
        SET "maxMessages" = 10000, "maxPages" = 5000 
        WHERE (LOWER("name") = 'professional' OR LOWER("name") = 'pro') AND ("maxMessages" IS NULL OR "maxPages" IS NULL);

        -- Set Enterprise plan to unlimited (null)
        UPDATE "SubscriptionPlan" 
        SET "maxMessages" = NULL, "maxPages" = NULL 
        WHERE LOWER("name") = 'enterprise' AND ("maxMessages" IS NOT NULL OR "maxPages" IS NOT NULL);
    END IF;
END $$;

-- Create AICall table for tracking AI provider calls
CREATE TABLE IF NOT EXISTS "AICall" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callType" TEXT NOT NULL DEFAULT 'MESSAGE',

    CONSTRAINT "AICall_pkey" PRIMARY KEY ("id")
);

-- Create indexes for AICall
CREATE INDEX IF NOT EXISTS "AICall_adminUserId_createdAt_idx" ON "AICall"("adminUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AICall_chatbotId_idx" ON "AICall"("chatbotId");

-- Add foreign key constraints for AICall
DO $$
BEGIN
    -- Only add foreign keys if the referenced tables exist
    -- Foreign key to Chatbot (only if Chatbot table exists)
    -- Use pg_class which preserves exact identifier case (Prisma uses quoted identifiers)
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'Chatbot' AND c.relkind = 'r'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'AICall_chatbotId_fkey'
        ) THEN
            ALTER TABLE "AICall" ADD CONSTRAINT "AICall_chatbotId_fkey" 
            FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END IF;

    -- Foreign key to AdminUser (only if AdminUser table exists)
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'AdminUser' AND c.relkind = 'r'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'AICall_adminUserId_fkey'
        ) THEN
            ALTER TABLE "AICall" ADD CONSTRAINT "AICall_adminUserId_fkey" 
            FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
