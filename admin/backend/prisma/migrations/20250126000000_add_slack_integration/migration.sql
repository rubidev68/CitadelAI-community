-- CreateTable
-- Add SlackIntegration table for chatbot Slack bot deployment
CREATE TABLE IF NOT EXISTS "SlackIntegration" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "blockId" TEXT,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "signingSecret" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT,
    "accessToken" TEXT,
    "botUserId" TEXT,
    "botUserName" TEXT,
    "respondToMentions" BOOLEAN NOT NULL DEFAULT true,
    "respondInThreads" BOOLEAN NOT NULL DEFAULT true,
    "respondInDMs" BOOLEAN NOT NULL DEFAULT true,
    "respondInChannels" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "installedBy" TEXT NOT NULL,

    CONSTRAINT "SlackIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SlackIntegration_blockId_key" ON "SlackIntegration"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SlackIntegration_teamId_key" ON "SlackIntegration"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SlackIntegration_chatbotId_idx" ON "SlackIntegration"("chatbotId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SlackIntegration_blockId_idx" ON "SlackIntegration"("blockId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SlackIntegration_teamId_idx" ON "SlackIntegration"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SlackIntegration_isActive_idx" ON "SlackIntegration"("isActive");

-- AddForeignKey (only if referenced tables exist)
DO $$ BEGIN
    -- Foreign key to Chatbot (only if Chatbot table exists)
    -- Use pg_class which preserves exact identifier case (Prisma uses quoted identifiers)
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'Chatbot' AND c.relkind = 'r'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'SlackIntegration_chatbotId_fkey'
        ) THEN
            ALTER TABLE "SlackIntegration" ADD CONSTRAINT "SlackIntegration_chatbotId_fkey" 
            FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Foreign key to Block (only if Block table exists)
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'Block' AND c.relkind = 'r'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'SlackIntegration_blockId_fkey'
        ) THEN
            ALTER TABLE "SlackIntegration" ADD CONSTRAINT "SlackIntegration_blockId_fkey" 
            FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
