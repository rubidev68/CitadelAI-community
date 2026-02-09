-- CreateTable
CREATE TABLE IF NOT EXISTS "TestDataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "chatbotId" TEXT,
    "examples" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestDataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestDataset_ownerId_idx" ON "TestDataset"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestDataset_chatbotId_idx" ON "TestDataset"("chatbotId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'TestDataset_ownerId_fkey'
    ) THEN
        ALTER TABLE "TestDataset" ADD CONSTRAINT "TestDataset_ownerId_fkey" 
        FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'TestDataset_chatbotId_fkey'
    ) THEN
        ALTER TABLE "TestDataset" ADD CONSTRAINT "TestDataset_chatbotId_fkey" 
        FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
