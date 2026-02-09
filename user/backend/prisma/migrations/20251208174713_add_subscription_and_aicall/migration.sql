-- CreateEnum (idempotent - only create if doesn't exist)
DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'CANCELED', 'PAST_DUE', 'INCOMPLETE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: SubscriptionPlan
CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "maxChatbots" INTEGER,
    "maxUsers" INTEGER,
    "maxMessages" INTEGER,
    "maxPages" INTEGER,
    "maxConcurrentSessions" INTEGER,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SubscriptionPlan unique name
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- CreateIndex: SubscriptionPlan unique stripeProductId
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_stripeProductId_key" ON "SubscriptionPlan"("stripeProductId");

-- CreateIndex: SubscriptionPlan unique stripePriceId
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_stripePriceId_key" ON "SubscriptionPlan"("stripePriceId");

-- CreateTable: Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialStartDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripePaymentLinkId" TEXT,
    "paymentMethodId" TEXT,
    "lastPaymentDate" TIMESTAMP(3),
    "nextPaymentDate" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Subscription unique adminUserId
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_adminUserId_key" ON "Subscription"("adminUserId");

-- CreateIndex: Subscription unique stripeCustomerId
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex: Subscription unique stripeSubscriptionId
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- AddForeignKey: Subscription -> AdminUser
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Subscription_adminUserId_fkey'
    ) THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_adminUserId_fkey" 
        FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: Subscription -> SubscriptionPlan
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Subscription_planId_fkey'
    ) THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" 
        FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable: AICall
CREATE TABLE IF NOT EXISTS "AICall" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callType" TEXT NOT NULL DEFAULT 'MESSAGE',

    CONSTRAINT "AICall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AICall chatbotId
CREATE INDEX IF NOT EXISTS "AICall_chatbotId_idx" ON "AICall"("chatbotId");

-- CreateIndex: AICall adminUserId and createdAt (composite)
CREATE INDEX IF NOT EXISTS "AICall_adminUserId_createdAt_idx" ON "AICall"("adminUserId", "createdAt");

-- AddForeignKey: AICall -> Chatbot
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'AICall_chatbotId_fkey'
    ) THEN
        ALTER TABLE "AICall" ADD CONSTRAINT "AICall_chatbotId_fkey" 
        FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: AICall -> AdminUser
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'AICall_adminUserId_fkey'
    ) THEN
        ALTER TABLE "AICall" ADD CONSTRAINT "AICall_adminUserId_fkey" 
        FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
