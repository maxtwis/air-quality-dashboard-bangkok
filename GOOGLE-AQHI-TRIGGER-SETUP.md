# Google AQHI Automatic Trigger Setup

This solution uses a Supabase database trigger to automatically calculate AQHI when data is inserted, making the collection endpoint fast enough for Vercel free tier (10-second timeout).

## Architecture

```
cron-job.org (every hour at :00)
    ↓
/api/google-collect-only (Vercel)
    ↓
Insert data → google_aqhi_hourly table (Supabase)
    ↓
TRIGGER automatically fires
    ↓
calculate_3h_averages_and_aqhi() (Supabase)
    ↓
AQHI calculated and stored
```

## Step 1: Run the Trigger SQL in Supabase

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click **SQL Editor**
3. Copy and paste the contents of `supabase/auto-calculate-aqhi-trigger.sql`
4. Click **Run**

This creates:
- `auto_calculate_aqhi_on_insert()` function
- `trigger_auto_calculate_aqhi` trigger that fires after each insert

## Step 2: Verify the Trigger Works

Test the trigger in Supabase SQL Editor:

```sql
-- Insert test data
INSERT INTO google_aqhi_hourly (location_id, hour_timestamp, pm25, o3, no2)
VALUES (1, NOW(), 25.5, 45.2, 20.1)
ON CONFLICT (location_id, hour_timestamp)
DO UPDATE SET pm25 = EXCLUDED.pm25;

-- Check if AQHI was automatically calculated
SELECT
  location_id,
  hour_timestamp,
  pm25,
  o3,
  no2,
  pm25_3h_avg,
  o3_3h_avg,
  no2_3h_avg,
  aqhi,
  aqhi_category
FROM google_aqhi_hourly
WHERE location_id = 1
ORDER BY hour_timestamp DESC
LIMIT 1;
```

You should see `aqhi` and `aqhi_category` populated automatically!

## Step 3: Set Up cron-job.org

### Create Cronjob

1. Go to https://cron-job.org
2. Log in to your account
3. Click **Create cronjob**

### Configuration

- **Title**: `Google AQHI Hourly Collection`
- **URL**: `https://clean-air-bkk.vercel.app/api/google-collect-only`
- **Schedule**:
  - Pattern: `0 * * * *` (every hour at minute 0)
  - Or use the visual editor: Hour `*`, Minute `0`
- **Request Method**: `GET`
- **Timeout**: 30 seconds (if available)
- **Notifications**: Enable if you want email alerts on failures

### Save and Test

1. Click **Create**
2. Click **Run cronjob** to test immediately
3. Check the execution log for success message

Expected response:
```json
{
  "success": true,
  "collected": 15,
  "failed": 0,
  "duration_ms": 4500,
  "timestamp": "2025-11-04T08:00:00.000Z"
}
```

## Step 4: Verify Data Collection

After the cron job runs, check Supabase:

```sql
-- See latest data for all locations
SELECT
  location_id,
  hour_timestamp,
  pm25,
  o3,
  no2,
  aqhi,
  aqhi_category,
  data_quality
FROM google_aqhi_hourly
ORDER BY hour_timestamp DESC, location_id
LIMIT 15;

-- See AQHI distribution
SELECT
  aqhi_category,
  COUNT(*) as count,
  ROUND(AVG(aqhi), 1) as avg_aqhi
FROM google_aqhi_hourly
WHERE hour_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY aqhi_category
ORDER BY
  CASE aqhi_category
    WHEN 'LOW' THEN 1
    WHEN 'MODERATE' THEN 2
    WHEN 'HIGH' THEN 3
    WHEN 'VERY_HIGH' THEN 4
  END;
```

## How It Works

### Without Trigger (OLD - Too Slow)
1. Collect data from Google API (5-6 seconds)
2. Insert into database (500ms)
3. Calculate AQHI for each location sequentially (6-8 seconds)
4. **Total: 12-15 seconds** ❌ Exceeds Vercel free tier timeout

### With Trigger (NEW - Fast!)
1. Collect data from Google API (5-6 seconds)
2. Insert into database (500ms)
3. **Trigger fires automatically in background**
4. **Total API response: 6-7 seconds** ✅ Within Vercel free tier timeout

## Troubleshooting

### Cron job returns 500 error
- Check Vercel deployment logs
- Verify Google API key is set in Vercel environment variables
- Test the endpoint manually in browser

### No AQHI calculated
- Check if trigger is installed: `\df auto_calculate_aqhi_on_insert` in Supabase SQL
- Check if `calculate_3h_averages_and_aqhi` function exists
- Look for errors in Supabase logs

### Data collected but AQHI is null
- Normal for first 3 hours (building 3-hour moving average)
- After 3 hours of data collection, AQHI should appear
- Check `pm25_3h_avg`, `o3_3h_avg`, `no2_3h_avg` columns

## Performance

- **Collection time**: 5-7 seconds (15 parallel Google API calls)
- **Trigger calculation**: Runs asynchronously in database
- **Total response time**: 5-7 seconds ✅
- **Vercel free tier limit**: 10 seconds ✅

## Files

- `supabase/auto-calculate-aqhi-trigger.sql` - Database trigger
- `api/google-collect-only.js` - Fast collection endpoint
- This setup guide

## Next Steps

After setup is complete:
1. Wait 3 hours for AQHI calculations to become accurate (3-hour moving average)
2. Update your frontend to display Google AQHI data
3. Create charts for historical AQHI trends
