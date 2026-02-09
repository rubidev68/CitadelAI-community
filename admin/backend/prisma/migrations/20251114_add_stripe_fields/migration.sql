-- Add Stripe fields to Subscription table (only if table exists)
DO $$
BEGIN
    -- Check if Subscription table exists before trying to alter it
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Subscription'
    ) THEN
        -- Add stripeCustomerId
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Subscription' AND column_name = 'stripeCustomerId'
        ) THEN
            ALTER TABLE "Subscription" ADD COLUMN "stripeCustomerId" TEXT;
            CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
        END IF;

        -- Add stripeSubscriptionId
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Subscription' AND column_name = 'stripeSubscriptionId'
        ) THEN
            ALTER TABLE "Subscription" ADD COLUMN "stripeSubscriptionId" TEXT;
            CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
        END IF;

        -- Add stripePriceId
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Subscription' AND column_name = 'stripePriceId'
        ) THEN
            ALTER TABLE "Subscription" ADD COLUMN "stripePriceId" TEXT;
        END IF;

        -- Add stripePaymentLinkId
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Subscription' AND column_name = 'stripePaymentLinkId'
        ) THEN
            ALTER TABLE "Subscription" ADD COLUMN "stripePaymentLinkId" TEXT;
        END IF;

        -- Add paymentMethodId
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Subscription' AND column_name = 'paymentMethodId'
        ) THEN
            ALTER TABLE "Subscription" ADD COLUMN "paymentMethodId" TEXT;
        END IF;

        -- Add lastPaymentDate
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Subscription' AND column_name = 'lastPaymentDate'
        ) THEN
            ALTER TABLE "Subscription" ADD COLUMN "lastPaymentDate" TIMESTAMP(3);
        END IF;

        -- Add nextPaymentDate
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Subscription' AND column_name = 'nextPaymentDate'
        ) THEN
            ALTER TABLE "Subscription" ADD COLUMN "nextPaymentDate" TIMESTAMP(3);
        END IF;
    ELSE
        -- Subscription table doesn't exist, skip these changes
        RAISE NOTICE 'Subscription table does not exist, skipping Stripe field additions';
    END IF;
END $$;

-- Add Stripe fields to SubscriptionPlan table (only if table exists)
DO $$
BEGIN
    -- Check if SubscriptionPlan table exists before trying to alter it
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan'
    ) THEN
        -- Add stripeProductId
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan' AND column_name = 'stripeProductId'
        ) THEN
            ALTER TABLE "SubscriptionPlan" ADD COLUMN "stripeProductId" TEXT;
            CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_stripeProductId_key" ON "SubscriptionPlan"("stripeProductId");
        END IF;

        -- Add stripePriceId
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan' AND column_name = 'stripePriceId'
        ) THEN
            ALTER TABLE "SubscriptionPlan" ADD COLUMN "stripePriceId" TEXT;
            CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_stripePriceId_key" ON "SubscriptionPlan"("stripePriceId");
        END IF;
    ELSE
        -- SubscriptionPlan table doesn't exist, skip these changes
        RAISE NOTICE 'SubscriptionPlan table does not exist, skipping Stripe field additions';
    END IF;
END $$;

-- Create PaymentLinkStatus enum
DO $$ BEGIN
    CREATE TYPE "PaymentLinkStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create PaymentLink table
CREATE TABLE IF NOT EXISTS "PaymentLink" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT,
    "stripePaymentLinkId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "status" "PaymentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- Create indexes for PaymentLink
CREATE INDEX IF NOT EXISTS "PaymentLink_adminUserId_idx" ON "PaymentLink"("adminUserId");
CREATE INDEX IF NOT EXISTS "PaymentLink_stripePaymentLinkId_idx" ON "PaymentLink"("stripePaymentLinkId");
CREATE INDEX IF NOT EXISTS "PaymentLink_subscriptionId_idx" ON "PaymentLink"("subscriptionId");

-- Create unique constraints for PaymentLink
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PaymentLink_proposalId_key'
    ) THEN
        ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_proposalId_key" UNIQUE ("proposalId");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PaymentLink_stripePaymentLinkId_key'
    ) THEN
        ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_stripePaymentLinkId_key" UNIQUE ("stripePaymentLinkId");
    END IF;
END $$;

-- Add foreign key constraints for PaymentLink (only if referenced tables exist)
DO $$
BEGIN
    -- Foreign key to AdminUser (only if AdminUser table exists)
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'AdminUser' AND c.relkind = 'r'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'PaymentLink_adminUserId_fkey'
        ) THEN
            ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_adminUserId_fkey" 
            FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END IF;

    -- Foreign key to SubscriptionPlan (only if SubscriptionPlan table exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'SubscriptionPlan'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'PaymentLink_planId_fkey'
        ) THEN
            ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_planId_fkey" 
            FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END IF;

    -- Foreign key to Subscription (only if Subscription table exists)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'Subscription'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'PaymentLink_subscriptionId_fkey'
        ) THEN
            ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_subscriptionId_fkey" 
            FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
