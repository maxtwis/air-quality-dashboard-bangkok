-- ============================================================================
-- LINE AQHI Notification Scheduler using pg_cron
-- ============================================================================
-- This sets up automated AQHI reports to LINE Official Account
-- ============================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- Schedule Option 1: Hourly Summary (Recommended)
-- ============================================================================
-- Send AQHI summary every hour at :00
-- Example: 08:00, 09:00, 10:00, etc.

SELECT cron.schedule(
    'line-aqhi-hourly-summary',
    '0 * * * *',  -- Every hour at minute 0
    $$
    SELECT
      net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-notify-aqhi',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"messageType": "summary"}'::jsonb
      ) as request_id;
    $$
);

-- ============================================================================
-- Schedule Option 2: Daily Morning Report
-- ============================================================================
-- Send detailed report every morning at 7:00 AM Bangkok time

SELECT cron.schedule(
    'line-aqhi-morning-report',
    '0 7 * * *',  -- Every day at 7:00 AM
    $$
    SELECT
      net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-notify-aqhi',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"messageType": "summary"}'::jsonb
      ) as request_id;
    $$
);

-- ============================================================================
-- Schedule Option 3: Multiple Daily Reports
-- ============================================================================
-- Send reports 3 times per day: Morning (7 AM), Noon (12 PM), Evening (6 PM)

-- Morning report at 7:00 AM
SELECT cron.schedule(
    'line-aqhi-morning',
    '0 7 * * *',
    $$
    SELECT
      net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-notify-aqhi',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"messageType": "summary"}'::jsonb
      ) as request_id;
    $$
);

-- Noon report at 12:00 PM
SELECT cron.schedule(
    'line-aqhi-noon',
    '0 12 * * *',
    $$
    SELECT
      net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-notify-aqhi',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"messageType": "summary"}'::jsonb
      ) as request_id;
    $$
);

-- Evening report at 6:00 PM
SELECT cron.schedule(
    'line-aqhi-evening',
    '0 18 * * *',
    $$
    SELECT
      net.http_post(
        url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-notify-aqhi',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
        body:='{"messageType": "summary"}'::jsonb
      ) as request_id;
    $$
);

-- ============================================================================
-- View scheduled jobs
-- ============================================================================
SELECT * FROM cron.job;

-- ============================================================================
-- Unschedule jobs (if needed)
-- ============================================================================
-- SELECT cron.unschedule('line-aqhi-hourly-summary');
-- SELECT cron.unschedule('line-aqhi-morning-report');
-- SELECT cron.unschedule('line-aqhi-morning');
-- SELECT cron.unschedule('line-aqhi-noon');
-- SELECT cron.unschedule('line-aqhi-evening');

-- ============================================================================
-- SETUP INSTRUCTIONS:
-- ============================================================================
-- 1. Replace YOUR_PROJECT_REF with your actual Supabase project reference
--    Example: abcdefghijklmnop
--
-- 2. Replace YOUR_ANON_KEY with your Supabase anon/public key
--    Found in: Project Settings > API > anon public
--
-- 3. Choose ONE of the schedule options above by uncommenting it
--    (Comment out the others you don't want)
--
-- 4. Verify cron jobs are running:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- ============================================================================
-- NOTES:
-- ============================================================================
-- - All times are in UTC. Add/subtract hours for Bangkok timezone (UTC+7)
--   For 7 AM Bangkok time, use: 0 0 * * * (0:00 UTC = 7:00 Bangkok)
--   For 12 PM Bangkok time, use: 0 5 * * * (5:00 UTC = 12:00 Bangkok)
--   For 6 PM Bangkok time, use: 0 11 * * * (11:00 UTC = 6:00 Bangkok)
--
-- - pg_cron must be enabled on your Supabase project
--   Contact Supabase support if not available
--
-- - Requires net extension for HTTP requests:
--   CREATE EXTENSION IF NOT EXISTS pg_net;
-- ============================================================================
