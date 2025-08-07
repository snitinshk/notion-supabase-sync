-- ============================================================================
-- NOTION-SUPABASE SYNC - DATABASE SETUP
-- ============================================================================
-- Run this script in your Supabase SQL Editor to set up the database
-- This creates all necessary tables, indexes, and functions

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Main table for Notion pages
CREATE TABLE IF NOT EXISTS notion_pages (
    id BIGSERIAL PRIMARY KEY,
    notion_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_edited_time TIMESTAMP WITH TIME ZONE
);

-- Sync state tracking table
CREATE TABLE IF NOT EXISTS sync_state (
    id BIGSERIAL PRIMARY KEY,
    database_id TEXT NOT NULL,
    last_sync_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(database_id)
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Indexes for notion_pages table
CREATE INDEX IF NOT EXISTS idx_notion_pages_notion_id ON notion_pages(notion_id);
CREATE INDEX IF NOT EXISTS idx_notion_pages_created_at ON notion_pages(created_at);
CREATE INDEX IF NOT EXISTS idx_notion_pages_updated_at ON notion_pages(updated_at);
CREATE INDEX IF NOT EXISTS idx_notion_pages_last_edited_time ON notion_pages(last_edited_time);

-- Indexes for sync_state table
CREATE INDEX IF NOT EXISTS idx_sync_state_database_id ON sync_state(database_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_last_sync_time ON sync_state(last_sync_time);

-- ============================================================================
-- 3. CREATE FUNCTIONS
-- ============================================================================

-- Function to execute SQL statements (for automatic column creation)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- 4. CREATE TRIGGERS
-- ============================================================================

-- Trigger to automatically update updated_at on notion_pages
DROP TRIGGER IF EXISTS update_notion_pages_updated_at ON notion_pages;
CREATE TRIGGER update_notion_pages_updated_at
    BEFORE UPDATE ON notion_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update updated_at on sync_state
DROP TRIGGER IF EXISTS update_sync_state_updated_at ON sync_state;
CREATE TRIGGER update_sync_state_updated_at
    BEFORE UPDATE ON sync_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. GRANT PERMISSIONS (Security - RLS Enabled)
-- ============================================================================

-- Enable Row Level Security on both tables
ALTER TABLE notion_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- Create policies for notion_pages table
CREATE POLICY "Allow service role full access" ON notion_pages
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users full access" ON notion_pages
    FOR ALL USING (auth.role() = 'authenticated');

-- Create policies for sync_state table
CREATE POLICY "Allow service role full access" ON sync_state
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users full access" ON sync_state
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- NOTES:
-- ============================================================================
--
-- 1. The exec_sql function allows the script to create columns automatically
-- 2. The sync_state table tracks the last sync time for each database
-- 3. Indexes improve query performance for large datasets
-- 4. Triggers automatically update the updated_at timestamp
-- 5. RLS policies can be added for security (commented out by default)
--
-- ============================================================================ 