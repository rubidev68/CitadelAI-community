-- AlterTable
-- Add email verification fields to AdminUser table
ALTER TABLE "public"."AdminUser" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."AdminUser" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
ALTER TABLE "public"."AdminUser" ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpires" TIMESTAMP(3);
