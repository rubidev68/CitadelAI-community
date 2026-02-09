-- CreateTable: CalendarActionLog
CREATE TABLE IF NOT EXISTS "CalendarActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "eventId" TEXT,
    "eventDetails" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: CalendarActionLog userId
CREATE INDEX IF NOT EXISTS "CalendarActionLog_userId_idx" ON "CalendarActionLog"("userId");

-- CreateIndex: CalendarActionLog chatbotId
CREATE INDEX IF NOT EXISTS "CalendarActionLog_chatbotId_idx" ON "CalendarActionLog"("chatbotId");

-- CreateIndex: CalendarActionLog blockId
CREATE INDEX IF NOT EXISTS "CalendarActionLog_blockId_idx" ON "CalendarActionLog"("blockId");

-- CreateIndex: CalendarActionLog timestamp
CREATE INDEX IF NOT EXISTS "CalendarActionLog_timestamp_idx" ON "CalendarActionLog"("timestamp");

-- CreateIndex: CalendarActionLog userId and timestamp (composite)
CREATE INDEX IF NOT EXISTS "CalendarActionLog_userId_timestamp_idx" ON "CalendarActionLog"("userId", "timestamp");

-- AddForeignKey: CalendarActionLog -> User
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CalendarActionLog_userId_fkey'
    ) THEN
        ALTER TABLE "CalendarActionLog" ADD CONSTRAINT "CalendarActionLog_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: CalendarActionLog -> Chatbot
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CalendarActionLog_chatbotId_fkey'
    ) THEN
        ALTER TABLE "CalendarActionLog" ADD CONSTRAINT "CalendarActionLog_chatbotId_fkey" 
        FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: CalendarActionLog -> Block
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CalendarActionLog_blockId_fkey'
    ) THEN
        ALTER TABLE "CalendarActionLog" ADD CONSTRAINT "CalendarActionLog_blockId_fkey" 
        FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
