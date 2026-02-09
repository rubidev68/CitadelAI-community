-- AlterTable
-- Add Two-Factor Authentication fields to AdminUser table
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "twoFactorSetupCompleted" BOOLEAN NOT NULL DEFAULT false;
