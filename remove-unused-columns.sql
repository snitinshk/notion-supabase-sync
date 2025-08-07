-- ============================================================================
-- REMOVE UNUSED COLUMNS
-- ============================================================================
-- Run this script to clean up columns that are no longer needed
-- These columns were created during development but are not part of the final schema

-- Remove columns that were part of the base table but are now dynamically created
ALTER TABLE notion_pages DROP COLUMN IF EXISTS title;
ALTER TABLE notion_pages DROP COLUMN IF EXISTS url;
ALTER TABLE notion_pages DROP COLUMN IF EXISTS properties;
ALTER TABLE notion_pages DROP COLUMN IF EXISTS raw_data;
ALTER TABLE notion_pages DROP COLUMN IF EXISTS status;

-- Remove columns that don't exist in the current Notion database
ALTER TABLE notion_pages DROP COLUMN IF EXISTS deadline;
ALTER TABLE notion_pages DROP COLUMN IF EXISTS project;
ALTER TABLE notion_pages DROP COLUMN IF EXISTS parent_item;
ALTER TABLE notion_pages DROP COLUMN IF EXISTS sub_item;

-- ============================================================================
-- NOTES:
-- ============================================================================
--
-- 1. These columns were created during development/testing
-- 2. They don't correspond to actual Notion database properties
-- 3. Removing them will clean up the table schema
-- 4. The sync script will only create columns for actual Notion properties
--
-- ============================================================================ 