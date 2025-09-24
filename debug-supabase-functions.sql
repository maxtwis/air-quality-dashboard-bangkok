-- Debug script to check what functions exist in your Supabase database
-- Run this in your Supabase SQL Editor to diagnose the issue

-- 1. Check if the function exists at all
SELECT
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'calculate_enhanced_3h_averages'
    AND routine_schema = 'public';

-- 2. List all custom functions in the public schema
SELECT
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
    AND routine_name NOT LIKE 'pg_%'
ORDER BY routine_name;

-- 3. Check what tables/views you have available
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND (table_name LIKE '%3h%' OR table_name LIKE '%average%' OR table_name LIKE '%openweather%' OR table_name LIKE '%station%')
ORDER BY table_name;

-- 4. Test creating a simple function to check permissions
DO $$
BEGIN
    -- Try to create a test function
    EXECUTE 'CREATE OR REPLACE FUNCTION test_function_creation() RETURNS TEXT AS $func$ BEGIN RETURN ''success''; END; $func$ LANGUAGE plpgsql;';

    -- If successful, clean up
    EXECUTE 'DROP FUNCTION test_function_creation();';

    RAISE NOTICE 'Function creation test: SUCCESS - You have permission to create functions';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Function creation test: FAILED - Error: %', SQLERRM;
END
$$;

-- 5. Show any errors from the current session
SELECT message, detail, hint, context
FROM pg_stat_statements_info
WHERE message IS NOT NULL
ORDER BY calls DESC
LIMIT 5;