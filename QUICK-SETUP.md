# Quick Setup Guide - Google O3/NO2 Supplements

## ✅ What's Already Done

1. **Code deployed** to Vercel ✅
2. **Cron job configured** on cron-job.org ✅
3. **Google API key added** to Vercel ✅

## 🔧 Final Setup (2 steps)

### Step 1: Create Supabase Table (2 minutes)

1. Go to: https://supabase.com/dashboard → Your Project → SQL Editor
2. Copy the entire contents of [supabase/create-google-supplements-table.sql](supabase/create-google-supplements-table.sql)
3. Paste into SQL Editor
4. Click **Run**
5. You should see: ✅ "Table created successfully!"

### Step 2: Test the Endpoint (1 minute)

Wait 2 minutes for Vercel deployment, then test:

```bash
curl https://clean-air-bkk.vercel.app/api/collect-google-supplements
```

**Expected response**:

```json
{
  "success": true,
  "stationsChecked": 188,
  "stationsNeedingSupplements": 180,
  "googleApiCalls": 8,
  "supplementsAdded": 180,
  "storedInDatabase": 180,
  "message": "Successfully added O3/NO2 supplements for 180 stations"
}
```

## 📊 Verify It's Working

### Check cron-job.org

Your hourly cron job should show:

- ✅ Status: 200 OK
- ✅ Response time: ~20-40 seconds
- ✅ Response contains `"success": true`

### Check Supabase Data

After first cron run (wait until top of next hour):

```sql
-- Check if supplements are being stored
SELECT COUNT(*) as total_supplements,
       MAX(timestamp) as latest_supplement
FROM google_supplements;

-- Should show ~180 records after first run

-- View latest supplements
SELECT station_uid, o3, no2, timestamp, grid_lat, grid_lon
FROM google_supplements
ORDER BY timestamp DESC
LIMIT 10;
```

### Check 3-Hour Averages

After 3 hours (3 cron runs):

```sql
-- View 3-hour averages with Google O3/NO2
SELECT *
FROM google_3h_averages
LIMIT 10;

-- Should show:
-- - avg_o3: populated
-- - avg_no2: populated
-- - reading_count: 3
```

## 🎯 How It Works

### Architecture

```
Every Hour (cron-job.org)
    ↓
api/collect-google-supplements
    ↓
1. Fetch 188 WAQI stations (from waqi-proxy)
2. Find ~180 stations missing O3/NO2
3. Map to 3x3 grid (typically 8 points)
4. Fetch Google data (8 API calls)
5. Store in google_supplements table
    ↓
Supabase google_supplements table
    ↓
Your app reads supplements & combines with WAQI data
```

### Cost

- **Google API calls/hour**: 8
- **Google API calls/day**: 192
- **Google API calls/month**: 5,760
- **Status**: ✅ Under 10K free tier (42% safety margin)

## 📝 Table Schema

### google_supplements

| Column      | Type        | Description                   |
| ----------- | ----------- | ----------------------------- |
| id          | UUID        | Primary key                   |
| station_uid | INTEGER     | WAQI station ID               |
| timestamp   | TIMESTAMPTZ | When supplement was collected |
| o3          | DECIMAL     | O3 concentration (µg/m³)      |
| no2         | DECIMAL     | NO2 concentration (µg/m³)     |
| grid_lat    | DECIMAL     | Source grid point latitude    |
| grid_lon    | DECIMAL     | Source grid point longitude   |

### Views

- **latest_google_supplements**: Latest supplement for each station
- **google_3h_averages**: 3-hour moving averages of O3/NO2

## 🔍 Troubleshooting

### Issue: Endpoint returns error

**Test endpoint directly**:

```bash
curl https://clean-air-bkk.vercel.app/api/collect-google-supplements
```

Check the error message:

- **"Google API key not configured"**: Add key to Vercel env vars
- **"Failed to fetch WAQI stations"**: Check if waqi-proxy is working
- **"Failed to store"**: Run the Supabase SQL script

### Issue: No data in google_supplements table

**Check 1**: Verify table exists

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'google_supplements';
```

**Check 2**: Check cron execution

- Go to cron-job.org → Execution history
- Should show recent successful runs

**Check 3**: Check Vercel logs

- Go to Vercel Dashboard → Functions → Logs
- Filter by `collect-google-supplements`

### Issue: Google API quota exceeded

Check usage:

1. Go to https://console.cloud.google.com/
2. APIs & Services → Dashboard
3. Air Quality API → Quotas

Should show ~192 requests/day. If much higher, check cron frequency.

## ✅ Success Checklist

- [ ] SQL script run successfully
- [ ] Test endpoint returns success
- [ ] google_supplements table has data
- [ ] Cron job runs every hour
- [ ] Google API usage < 10K/month

Once all checked, you're done! 🎉

## 📚 Next Steps

The supplements are now stored in Supabase. To use them in your app:

1. **Join with WAQI data**:

```sql
SELECT
  w.station_uid,
  w.pm25,  -- from WAQI
  w.pm10,  -- from WAQI
  g.o3,    -- from Google
  g.no2    -- from Google
FROM latest_station_readings w
LEFT JOIN latest_google_supplements g
  ON w.station_uid = g.station_uid;
```

2. **Calculate AQHI** using complete pollutant data
3. **Display on map** with all pollutants available

Your Bangkok Air Quality Dashboard now has complete O3 and NO2 data for accurate AQHI calculations! 🎯
