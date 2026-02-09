-- CreateEnum (only if not exists)
DO $$ BEGIN
    CREATE TYPE "public"."ChatbotStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
    CREATE TYPE "public"."BlockType" AS ENUM ('CONTEXT', 'LOGIC', 'ACTION', 'FRONTEND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (only if not exists)
DO $$ BEGIN
    CREATE TYPE "public"."Direction" AS ENUM ('LEFT', 'RIGHT', 'TOP', 'BOTTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "defaultChatbotId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ARCHITECT',
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "testUserId" TEXT,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."Chatbot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."ChatbotStatus" NOT NULL DEFAULT 'INACTIVE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatbot_pkey" PRIMARY KEY ("id")
);

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."ChatSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "userId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."ChatMessage" (
    "id" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."WebsiteContext" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "recursive" BOOLEAN NOT NULL DEFAULT false,
    "maxDepth" INTEGER NOT NULL DEFAULT 3,
    "crawlingStatus" JSONB,
    "lastCrawledAt" TIMESTAMP(3),
    "crawledPagesCount" INTEGER,
    "cronEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cronSchedule" TEXT,
    "cronTimezone" TEXT DEFAULT 'UTC',
    "nextCrawlAt" TIMESTAMP(3),

    CONSTRAINT "WebsiteContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."ChatbotAccess" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."Block" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "type" "public"."BlockType" NOT NULL,
    "subtype" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "properties" JSONB NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable (only if not exists)
CREATE TABLE IF NOT EXISTS "public"."Connection" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "fromBlockId" TEXT NOT NULL,
    "toBlockId" TEXT NOT NULL,
    "fromDirection" "public"."Direction" NOT NULL,
    "toDirection" "public"."Direction" NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "public"."User"("email");

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "public"."AdminUser"("email");

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_testUserId_key" ON "public"."AdminUser"("testUserId");

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteContext_blockId_key" ON "public"."WebsiteContext"("blockId");

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "ChatbotAccess_chatbotId_userEmail_key" ON "public"."ChatbotAccess"("chatbotId", "userEmail");

-- AddForeignKey (only if not exists) - Add foreign keys after all tables are created
DO $$ BEGIN
    ALTER TABLE "public"."User" ADD CONSTRAINT "User_defaultChatbotId_fkey" FOREIGN KEY ("defaultChatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "public"."ChatSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Chatbot" ADD CONSTRAINT "Chatbot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."WebsiteContext" ADD CONSTRAINT "WebsiteContext_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."ChatbotAccess" ADD CONSTRAINT "ChatbotAccess_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."ChatbotAccess" ADD CONSTRAINT "ChatbotAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Connection" ADD CONSTRAINT "Connection_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Connection" ADD CONSTRAINT "Connection_fromBlockId_fkey" FOREIGN KEY ("fromBlockId") REFERENCES "public"."Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "public"."Connection" ADD CONSTRAINT "Connection_toBlockId_fkey" FOREIGN KEY ("toBlockId") REFERENCES "public"."Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;