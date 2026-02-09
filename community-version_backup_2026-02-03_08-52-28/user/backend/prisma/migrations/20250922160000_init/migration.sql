-- CreateEnum (idempotent - only create if doesn't exist)
DO $$ BEGIN
    CREATE TYPE "ChatbotStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (idempotent - only create if doesn't exist)
DO $$ BEGIN
    CREATE TYPE "BlockType" AS ENUM ('CONTEXT', 'LOGIC', 'ACTION', 'FRONTEND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (idempotent - only create if doesn't exist)
DO $$ BEGIN
    CREATE TYPE "Direction" AS ENUM ('LEFT', 'RIGHT', 'TOP', 'BOTTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "defaultChatbotId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "ChatSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "userId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ARCHITECT',
    "company" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "testUserId" TEXT,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "Chatbot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ChatbotStatus" NOT NULL DEFAULT 'INACTIVE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chatbot_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "ChatbotAccess" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "Block" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "type" "BlockType" NOT NULL,
    "subtype" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "properties" JSONB NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent - only create if doesn't exist)
CREATE TABLE IF NOT EXISTS "Connection" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "fromBlockId" TEXT NOT NULL,
    "toBlockId" TEXT NOT NULL,
    "fromDirection" "Direction" NOT NULL,
    "toDirection" "Direction" NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent - only create if doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex (idempotent - only create if doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex (idempotent - only create if doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_testUserId_key" ON "AdminUser"("testUserId");

-- CreateIndex (idempotent - only create if doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "ChatbotAccess_chatbotId_userEmail_key" ON "ChatbotAccess"("chatbotId", "userEmail");

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "User" ADD CONSTRAINT "User_defaultChatbotId_fkey" FOREIGN KEY ("defaultChatbotId") REFERENCES "Chatbot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "Chatbot" ADD CONSTRAINT "Chatbot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "ChatbotAccess" ADD CONSTRAINT "ChatbotAccess_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "ChatbotAccess" ADD CONSTRAINT "ChatbotAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "Block" ADD CONSTRAINT "Block_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "Connection" ADD CONSTRAINT "Connection_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "Connection" ADD CONSTRAINT "Connection_fromBlockId_fkey" FOREIGN KEY ("fromBlockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey (idempotent - only add if doesn't exist)
DO $$ BEGIN
    ALTER TABLE "Connection" ADD CONSTRAINT "Connection_toBlockId_fkey" FOREIGN KEY ("toBlockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
