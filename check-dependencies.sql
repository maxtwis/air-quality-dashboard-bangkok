-- Check if all required dependencies exist before creating the function
-- Run this first to make sure everything is in place

-- 1. Check if required tables exist
SELECT
    'air_quality_readings' as table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'air_quality_readings'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
    'openweather_readings' as table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'openweather_readings'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
    'stations' as table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'stations'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- 2. Check if required views exist
SELECT
    'current_3h_averages' as view_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'current_3h_averages'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT
    'current_openweather_station_3h_averages' as view_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'current_openweather_station_3h_averages'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- 3. Show actual table and view structure
SELECT
    table_name,
    table_type,
    is_insertable_into
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 4. If current_openweather_station_3h_averages exists, show its columns
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'current_openweather_station_3h_averages'
ORDER BY ordinal_position;