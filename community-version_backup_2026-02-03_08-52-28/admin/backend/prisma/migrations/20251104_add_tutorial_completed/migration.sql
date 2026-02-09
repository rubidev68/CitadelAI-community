-- AlterTable
-- Add tutorialCompleted column to AdminUser table
ALTER TABLE "public"."AdminUser" ADD COLUMN IF NOT EXISTS "tutorialCompleted" BOOLEAN NOT NULL DEFAULT false;
