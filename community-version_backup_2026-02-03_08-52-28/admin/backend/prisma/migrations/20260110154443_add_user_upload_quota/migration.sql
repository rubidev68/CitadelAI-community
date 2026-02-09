-- CreateTable
CREATE TABLE "UserUploadQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalUploadedBytes" BIGINT NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserUploadQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserUploadQuota_userId_key" ON "UserUploadQuota"("userId");

-- CreateIndex
CREATE INDEX "UserUploadQuota_userId_idx" ON "UserUploadQuota"("userId");

-- AddForeignKey
ALTER TABLE "UserUploadQuota" ADD CONSTRAINT "UserUploadQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
