-- RemoveUniqueConstraint
-- Remove unique constraint from ApiToken.blockId to allow multiple tokens per block
DROP INDEX IF EXISTS "ApiToken_blockId_key";
