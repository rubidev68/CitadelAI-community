-- Safe Enum Creation
DO $$ BEGIN
    CREATE TYPE "EnterpriseContactStatus" AS ENUM ('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED', 'CONVERTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProposalType" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'REVIEWED', 'NEGOTIATING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProposalPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ONE_TIME');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'COMPLETED', 'OVERDUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "InstanceStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'UPDATING', 'FAILED', 'DELETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "InstanceHealthStatus" AS ENUM ('HEALTHY', 'UNHEALTHY', 'UNKNOWN', 'MAINTENANCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "InstanceUserRole" AS ENUM ('ADMIN', 'USER', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentLinkStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'CANCELED', 'PAST_DUE', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'UNPAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create EnterpriseContactRequest
CREATE TABLE IF NOT EXISTS "EnterpriseContactRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "company" TEXT,
    "message" TEXT,
    "status" "EnterpriseContactStatus" NOT NULL DEFAULT 'PENDING',
    "adminUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnterpriseContactRequest_pkey" PRIMARY KEY ("id")
);

-- Ensure SubscriptionPlan exists
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

-- Ensure Subscription exists
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

-- Create Proposal
CREATE TABLE IF NOT EXISTS "Proposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "proposalType" "ProposalType" NOT NULL DEFAULT 'CUSTOM',
    "features" TEXT[],
    "customFeatures" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "setupFee" DOUBLE PRECISION,
    "monthlyFee" DOUBLE PRECISION,
    "annualDiscount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "validUntil" TIMESTAMP(3),
    "contractDuration" INTEGER,
    "paymentTerms" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "ProposalPriority" NOT NULL DEFAULT 'MEDIUM',
    "enterpriseRequestId" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "assignedToAdminId" TEXT,
    "billingPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "clientNotes" TEXT,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- Create BillingPlan
CREATE TABLE IF NOT EXISTS "BillingPlan" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "setupFee" DOUBLE PRECISION,
    "monthlyFee" DOUBLE PRECISION,
    "annualDiscount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "status" "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastPaymentDate" TIMESTAMP(3),
    "nextPaymentDate" TIMESTAMP(3),
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- Create DedicatedInstance
CREATE TABLE IF NOT EXISTS "DedicatedInstance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "status" "InstanceStatus" NOT NULL DEFAULT 'PROVISIONING',
    "resourceSpec" JSONB NOT NULL,
    "customConfig" JSONB,
    "databaseUrl" TEXT,
    "databaseName" TEXT,
    "weaviateUrl" TEXT,
    "weaviateApiKey" TEXT,
    "dockerComposeFile" TEXT,
    "containerPrefix" TEXT,
    "internalPorts" JSONB,
    "externalPorts" JSONB,
    "proposalId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionPlanId" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "lastHealthCheck" TIMESTAMP(3),
    "healthStatus" "InstanceHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "provisionedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "DedicatedInstance_pkey" PRIMARY KEY ("id")
);

-- Create InstanceUser
CREATE TABLE IF NOT EXISTS "InstanceUser" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "InstanceUserRole" NOT NULL DEFAULT 'USER',
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "InstanceUser_pkey" PRIMARY KEY ("id")
);

-- Create InstanceResourceTemplate
CREATE TABLE IF NOT EXISTS "InstanceResourceTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cpuCores" INTEGER NOT NULL DEFAULT 2,
    "memoryGB" INTEGER NOT NULL DEFAULT 4,
    "storageGB" INTEGER NOT NULL DEFAULT 50,
    "maxConcurrentUsers" INTEGER,
    "maxChatbots" INTEGER,
    "databaseSizeGB" INTEGER NOT NULL DEFAULT 10,
    "databaseConnections" INTEGER NOT NULL DEFAULT 20,
    "subscriptionPlanId" TEXT,
    "weaviateMemoryGB" INTEGER NOT NULL DEFAULT 2,
    "weaviateStorageGB" INTEGER NOT NULL DEFAULT 20,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceResourceTemplate_pkey" PRIMARY KEY ("id")
);

-- Create PaymentLink
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

-- Create AICall
CREATE TABLE IF NOT EXISTS "AICall" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callType" TEXT NOT NULL DEFAULT 'MESSAGE',

    CONSTRAINT "AICall_pkey" PRIMARY KEY ("id")
);

-- Indexes and Constraints (Using DO blocks to safely add if not exists)

-- SubscriptionPlan unique constraints
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'SubscriptionPlan_stripeProductId_key') THEN
        CREATE UNIQUE INDEX "SubscriptionPlan_stripeProductId_key" ON "SubscriptionPlan"("stripeProductId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'SubscriptionPlan_stripePriceId_key') THEN
        CREATE UNIQUE INDEX "SubscriptionPlan_stripePriceId_key" ON "SubscriptionPlan"("stripePriceId");
    END IF;
END $$;

-- Subscription unique constraints
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Subscription_adminUserId_key') THEN
        CREATE UNIQUE INDEX "Subscription_adminUserId_key" ON "Subscription"("adminUserId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Subscription_stripeCustomerId_key') THEN
        CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Subscription_stripeSubscriptionId_key') THEN
        CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
    END IF;
END $$;

-- BillingPlan proposalId unique
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'BillingPlan_proposalId_key') THEN
        CREATE UNIQUE INDEX "BillingPlan_proposalId_key" ON "BillingPlan"("proposalId");
    END IF;
END $$;

-- DedicatedInstance name unique
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'DedicatedInstance_name_key') THEN
        CREATE UNIQUE INDEX "DedicatedInstance_name_key" ON "DedicatedInstance"("name");
    END IF;
END $$;

-- DedicatedInstance subdomain unique
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'DedicatedInstance_subdomain_key') THEN
        CREATE UNIQUE INDEX "DedicatedInstance_subdomain_key" ON "DedicatedInstance"("subdomain");
    END IF;
END $$;

-- DedicatedInstance proposalId unique
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'DedicatedInstance_proposalId_key') THEN
        CREATE UNIQUE INDEX "DedicatedInstance_proposalId_key" ON "DedicatedInstance"("proposalId");
    END IF;
END $$;

-- InstanceUser instanceId email unique
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'InstanceUser_instanceId_email_key') THEN
        CREATE UNIQUE INDEX "InstanceUser_instanceId_email_key" ON "InstanceUser"("instanceId", "email");
    END IF;
END $$;

-- InstanceResourceTemplate name unique
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'InstanceResourceTemplate_name_key') THEN
        CREATE UNIQUE INDEX "InstanceResourceTemplate_name_key" ON "InstanceResourceTemplate"("name");
    END IF;
END $$;

-- PaymentLink proposalId unique
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PaymentLink_proposalId_key') THEN
        CREATE UNIQUE INDEX "PaymentLink_proposalId_key" ON "PaymentLink"("proposalId");
    END IF;
END $$;

-- PaymentLink stripePaymentLinkId unique
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PaymentLink_stripePaymentLinkId_key') THEN
        CREATE UNIQUE INDEX "PaymentLink_stripePaymentLinkId_key" ON "PaymentLink"("stripePaymentLinkId");
    END IF;
END $$;

-- PaymentLink indexes
CREATE INDEX IF NOT EXISTS "PaymentLink_adminUserId_idx" ON "PaymentLink"("adminUserId");
CREATE INDEX IF NOT EXISTS "PaymentLink_stripePaymentLinkId_idx" ON "PaymentLink"("stripePaymentLinkId");
CREATE INDEX IF NOT EXISTS "PaymentLink_subscriptionId_idx" ON "PaymentLink"("subscriptionId");

-- AICall indexes
CREATE INDEX IF NOT EXISTS "AICall_adminUserId_createdAt_idx" ON "AICall"("adminUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AICall_chatbotId_idx" ON "AICall"("chatbotId");

-- Foreign Keys (using DO blocks for safety)

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Proposal_enterpriseRequestId_fkey') THEN
        ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_enterpriseRequestId_fkey" FOREIGN KEY ("enterpriseRequestId") REFERENCES "EnterpriseContactRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Proposal_createdByAdminId_fkey') THEN
        ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Proposal_assignedToAdminId_fkey') THEN
        ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_assignedToAdminId_fkey" FOREIGN KEY ("assignedToAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingPlan_proposalId_fkey') THEN
        ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DedicatedInstance_proposalId_fkey') THEN
        ALTER TABLE "DedicatedInstance" ADD CONSTRAINT "DedicatedInstance_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DedicatedInstance_subscriptionId_fkey') THEN
        ALTER TABLE "DedicatedInstance" ADD CONSTRAINT "DedicatedInstance_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DedicatedInstance_subscriptionPlanId_fkey') THEN
        ALTER TABLE "DedicatedInstance" ADD CONSTRAINT "DedicatedInstance_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DedicatedInstance_createdByAdminId_fkey') THEN
        ALTER TABLE "DedicatedInstance" ADD CONSTRAINT "DedicatedInstance_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstanceUser_instanceId_fkey') THEN
        ALTER TABLE "InstanceUser" ADD CONSTRAINT "InstanceUser_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "DedicatedInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstanceResourceTemplate_subscriptionPlanId_fkey') THEN
        ALTER TABLE "InstanceResourceTemplate" ADD CONSTRAINT "InstanceResourceTemplate_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentLink_adminUserId_fkey') THEN
        ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentLink_planId_fkey') THEN
        ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentLink_subscriptionId_fkey') THEN
        ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AICall_chatbotId_fkey') THEN
        ALTER TABLE "AICall" ADD CONSTRAINT "AICall_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AICall_adminUserId_fkey') THEN
        ALTER TABLE "AICall" ADD CONSTRAINT "AICall_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
