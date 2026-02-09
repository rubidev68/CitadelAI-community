-- AlterTable
-- Add Password Reset fields to AdminUser table
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpires" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "passwordResetRequestedAt" TIMESTAMP(3);
