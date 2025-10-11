-- Clear old Google supplement data collected with old grid boundaries
-- Run this in Supabase SQL Editor

-- This will remove all Google supplements so the system can recollect
-- with the new Bangkok-focused grid (13.65-13.95°N, 100.45-100.80°E)

-- Check how much data will be deleted
SELECT
    COUNT(*) as total_records,
    COUNT(DISTINCT station_uid) as stations,
    MIN(timestamp) as oldest,
    MAX(timestamp) as newest
FROM google_supplements;

-- Delete all old Google supplement data
DELETE FROM google_supplements;

-- Verify deletion
SELECT COUNT(*) as remaining_records FROM google_supplements;

-- Next step: Wait for the next Google collection run (every 60 minutes)
-- or manually trigger: curl https://clean-air-bkk.vercel.app/api/collect-google-supplements
