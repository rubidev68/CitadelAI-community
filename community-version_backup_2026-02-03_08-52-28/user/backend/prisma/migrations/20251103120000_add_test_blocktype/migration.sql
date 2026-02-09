-- Add TEST value to BlockType enum without breaking existing values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'BlockType' AND e.enumlabel = 'TEST'
  ) THEN
    ALTER TYPE "BlockType" ADD VALUE 'TEST';
  END IF;
END$$;
