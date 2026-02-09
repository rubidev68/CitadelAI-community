-- CreateTable (idempotent - only create if doesn't exist)
DO $$ 
BEGIN
    -- Create table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'WebsiteContext'
    ) THEN
        CREATE TABLE "WebsiteContext" (
            "id" TEXT NOT NULL,
            "chatbotId" TEXT NOT NULL,
            "blockId" TEXT NOT NULL,
            "url" TEXT NOT NULL,
            "crawlingStatus" JSONB,
            "lastCrawledAt" TIMESTAMP(3),
            "crawledPagesCount" INTEGER,

            CONSTRAINT "WebsiteContext_pkey" PRIMARY KEY ("id")
        );
    END IF;
    
    -- Create index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'WebsiteContext_blockId_key'
    ) THEN
        CREATE UNIQUE INDEX "WebsiteContext_blockId_key" ON "WebsiteContext"("blockId");
    END IF;
    
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'WebsiteContext_chatbotId_fkey'
    ) THEN
        ALTER TABLE "WebsiteContext" ADD CONSTRAINT "WebsiteContext_chatbotId_fkey" 
        FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
