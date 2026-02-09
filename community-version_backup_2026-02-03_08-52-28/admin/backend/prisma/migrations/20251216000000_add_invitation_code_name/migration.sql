-- AlterTable
-- Add name field to InvitationCode table
ALTER TABLE "InvitationCode" ADD COLUMN IF NOT EXISTS "name" TEXT;
