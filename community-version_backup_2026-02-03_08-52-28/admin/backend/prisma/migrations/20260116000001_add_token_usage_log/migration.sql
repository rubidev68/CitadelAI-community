-- CreateTable
CREATE TABLE "TokenUsageLog" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestMethod" TEXT NOT NULL,
    "ipAddress" TEXT,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenUsageLog_tokenId_idx" ON "TokenUsageLog"("tokenId");

-- CreateIndex
CREATE INDEX "TokenUsageLog_timestamp_idx" ON "TokenUsageLog"("timestamp");

-- CreateIndex
CREATE INDEX "TokenUsageLog_tokenId_timestamp_idx" ON "TokenUsageLog"("tokenId", "timestamp");

-- CreateIndex
CREATE INDEX "TokenUsageLog_endpoint_idx" ON "TokenUsageLog"("endpoint");

-- AddForeignKey
ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "ApiToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
