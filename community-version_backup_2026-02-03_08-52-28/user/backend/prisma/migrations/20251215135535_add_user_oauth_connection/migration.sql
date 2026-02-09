-- CreateEnum (idempotent - only create if doesn't exist)
DO $$ BEGIN
    CREATE TYPE "OAuthProvider" AS ENUM (
        'GMAIL',
        'OUTLOOK_EMAIL',
        'GOOGLE_CALENDAR',
        'OUTLOOK_CALENDAR',
        'CALDAV',
        'SALESFORCE',
        'HUBSPOT',
        'PIPEDRIVE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: UserOAuthConnection
CREATE TABLE IF NOT EXISTS "UserOAuthConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "blockId" TEXT,
    "provider" "OAuthProvider" NOT NULL,
    "providerAccountId" TEXT,
    "providerAccountName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "instanceUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOAuthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: UserOAuthConnection userId
CREATE INDEX IF NOT EXISTS "UserOAuthConnection_userId_idx" ON "UserOAuthConnection"("userId");

-- CreateIndex: UserOAuthConnection chatbotId
CREATE INDEX IF NOT EXISTS "UserOAuthConnection_chatbotId_idx" ON "UserOAuthConnection"("chatbotId");

-- CreateIndex: UserOAuthConnection blockId
CREATE INDEX IF NOT EXISTS "UserOAuthConnection_blockId_idx" ON "UserOAuthConnection"("blockId");

-- CreateIndex: UserOAuthConnection provider
CREATE INDEX IF NOT EXISTS "UserOAuthConnection_provider_idx" ON "UserOAuthConnection"("provider");

-- CreateIndex: UserOAuthConnection isActive
CREATE INDEX IF NOT EXISTS "UserOAuthConnection_isActive_idx" ON "UserOAuthConnection"("isActive");

-- CreateUniqueConstraint: UserOAuthConnection unique constraint
-- PostgreSQL unique constraints allow multiple NULLs, which matches Prisma's behavior
-- This enforces uniqueness for (userId, chatbotId, blockId, provider) combinations
-- Multiple rows with blockId=NULL are allowed (one per user/chatbot/provider)
CREATE UNIQUE INDEX IF NOT EXISTS "UserOAuthConnection_userId_chatbotId_blockId_provider_key" 
ON "UserOAuthConnection"("userId", "chatbotId", "blockId", "provider");

-- AddForeignKey: UserOAuthConnection -> User
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserOAuthConnection_userId_fkey'
    ) THEN
        ALTER TABLE "UserOAuthConnection" ADD CONSTRAINT "UserOAuthConnection_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: UserOAuthConnection -> Chatbot
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserOAuthConnection_chatbotId_fkey'
    ) THEN
        ALTER TABLE "UserOAuthConnection" ADD CONSTRAINT "UserOAuthConnection_chatbotId_fkey" 
        FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: UserOAuthConnection -> Block
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserOAuthConnection_blockId_fkey'
    ) THEN
        ALTER TABLE "UserOAuthConnection" ADD CONSTRAINT "UserOAuthConnection_blockId_fkey" 
        FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
