-- Migration: Enable Bubble Block Feature
-- This migration documents the enablement of the Bubble block feature.
-- The schema already supports FRONTEND blocks with Json properties,
-- so no schema changes are required. This migration serves as documentation.

-- No schema changes needed - Block model already supports:
-- - BlockType enum includes FRONTEND
-- - Block.properties is Json type (can store any configuration)
-- - Block.subtype is String (can store 'Bubble')

-- This migration is intentionally empty as the schema already supports
-- the Bubble block feature. The implementation is complete in:
-- - Backend: admin/backend/src/routes/widget.ts
-- - Frontend: admin/interface/src/components/editor/BlockProperties.tsx
-- - Frontend: admin/interface/src/components/editor/BlockPalette.tsx
