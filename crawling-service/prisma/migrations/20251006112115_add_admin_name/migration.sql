-- AlterTable (only if column doesn't exist)
DO $$ BEGIN
    ALTER TABLE "AdminUser" ADD COLUMN "name" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- AlterTable (only if columns don't exist)
DO $$ BEGIN
    ALTER TABLE "WebsiteContext" ADD COLUMN "maxDepth" INTEGER NOT NULL DEFAULT 3;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "WebsiteContext" ADD COLUMN "recursive" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;