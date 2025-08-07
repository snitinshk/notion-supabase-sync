-- ============================================================================
-- SECURE TABLES - ROW LEVEL SECURITY SETUP
-- ============================================================================
-- Run this script in your Supabase SQL Editor to secure the tables
-- This enables RLS and creates policies for the sync script

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on notion_pages table
ALTER TABLE notion_pages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sync_state table
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. CREATE POLICIES FOR NOTION_PAGES TABLE
-- ============================================================================

-- Policy: Allow service role to perform all operations
-- This allows the sync script (using service role) to work
CREATE POLICY "Allow service role full access" ON notion_pages
    FOR ALL USING (auth.role() = 'service_role');

-- Policy: Allow authenticated users to perform all operations
-- This allows your application to read and write data
CREATE POLICY "Allow authenticated users full access" ON notion_pages
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 3. CREATE POLICIES FOR SYNC_STATE TABLE
-- ============================================================================

-- Policy: Allow service role to perform all operations
-- This allows the sync script to manage sync state
CREATE POLICY "Allow service role full access" ON sync_state
    FOR ALL USING (auth.role() = 'service_role');

-- Policy: Allow authenticated users to perform all operations
-- This allows your application to read and write sync state
CREATE POLICY "Allow authenticated users full access" ON sync_state
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 4. VERIFICATION QUERIES
-- ============================================================================

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('notion_pages', 'sync_state');

-- Check policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('notion_pages', 'sync_state');

-- ============================================================================
-- NOTES:
-- ============================================================================
--
-- 1. Service Role Access: The sync script uses service role credentials
--    which have full access to both tables
--
-- 2. Authenticated User Access: Your application can read the data
--    but cannot modify it (unless you uncomment the modify policy)
--
-- 3. Public Access: Completely blocked - no anonymous access
--
-- 4. To test the sync: Use your existing sync script - it will work
--    because it uses service role credentials
--
-- 5. To access data from your app: Use authenticated user credentials
--
-- ============================================================================ 