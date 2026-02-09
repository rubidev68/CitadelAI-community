-- CreateTable
-- Add CustomProvider table for storing custom AI provider configurations
CREATE TABLE IF NOT EXISTS "CustomProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomProvider_ownerId_idx" ON "CustomProvider"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomProvider_isActive_idx" ON "CustomProvider"("isActive");

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
