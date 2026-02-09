-- Add maxConcurrentSessions column to SubscriptionPlan table
-- Only if SubscriptionPlan table exists (skip on custom instances without paywall)
DO $$
BEGIN
    -- Check if SubscriptionPlan table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan'
    ) THEN
        -- Add maxConcurrentSessions column
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan' AND column_name = 'maxConcurrentSessions'
        ) THEN
            ALTER TABLE "SubscriptionPlan" ADD COLUMN "maxConcurrentSessions" INTEGER;
        END IF;
    END IF;
END $$;

-- Update existing plans with default values for maxConcurrentSessions
-- Only if SubscriptionPlan table exists (skip on custom instances without paywall)
DO $$
BEGIN
    -- Check if SubscriptionPlan table exists before updating
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan'
    ) THEN
        -- Set Starter plan limit (10 concurrent sessions)
        UPDATE "SubscriptionPlan" 
        SET "maxConcurrentSessions" = 10 
        WHERE LOWER("name") = 'starter' AND "maxConcurrentSessions" IS NULL;

        -- Set Professional/Pro plan limit (50 concurrent sessions)
        UPDATE "SubscriptionPlan" 
        SET "maxConcurrentSessions" = 50 
        WHERE (LOWER("name") = 'professional' OR LOWER("name") = 'pro') AND "maxConcurrentSessions" IS NULL;

        -- Set Enterprise plan to unlimited (null)
        UPDATE "SubscriptionPlan" 
        SET "maxConcurrentSessions" = NULL 
        WHERE LOWER("name") = 'enterprise' AND "maxConcurrentSessions" IS NOT NULL;
    END IF;
END $$;
