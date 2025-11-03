# Dual Cron Setup Guide (WAQI + Google Supplements)

## Overview

This setup uses **two separate cron jobs** with different frequencies:

1. **WAQI Collection** (Every 20 minutes) - Fast-changing pollutants
2. **Google Supplements** (Every 60 minutes) - Slow-changing gaseous pollutants

**Result**: Only **5,760 Google API calls/month** (42% under 10K free tier) ✅

## Architecture

```
┌─── CRON #1 (Every 20 min) ───┐
│   api/collect-data.js         │
│   - 188 WAQI stations         │
│   - PM2.5, PM10, SO2, CO      │
│   - FREE (unlimited)          │
└───────────────────────────────┘
              ↓
        SUPABASE DB
              ↓
┌─── CRON #2 (Every 60 min) ───┐
│ api/collect-google-supplements│
│   - Checks 188 stations       │
│   - ~180 need O3/NO2          │
│   - Fetches 8 grid points     │
│   - 5,760 calls/month ✅      │
└───────────────────────────────┘
              ↓
        SUPABASE DB
              ↓
        CLIENT (reads combined data)
```

## Quick Setup

### 1. Environment Variables

Add to Vercel:

```
GOOGLE_AIR_QUALITY_API_KEY=YOUR_GOOGLE_AIR_QUALITY_API_KEY_HERE
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Deploy Code

The following files have been created/updated:

- ✅ `api/collect-data.js` - WAQI only (Google code removed)
- ✅ `api/collect-google-supplements.js` - NEW (Google supplements only)
- ✅ `vercel.json` - Dual cron configuration

### 3. Cron Configuration

**Option A: Vercel Cron (Built-in)** ⭐ Recommended

```json
{
  "crons": [
    {
      "path": "/api/collect-data",
      "schedule": "*/20 * * * *"
    },
    {
      "path": "/api/collect-google-supplements",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Option B: External Cron (cron-job.org)**

1. Create account at https://cron-job.org
2. Create Job #1:
   - URL: `https://your-app.vercel.app/api/collect-data`
   - Schedule: `*/20 * * * *` (every 20 minutes)
3. Create Job #2:
   - URL: `https://your-app.vercel.app/api/collect-google-supplements`
   - Schedule: `0 * * * *` (every hour, on the hour)

### 4. Database Schema

Run this SQL in Supabase if not already done:

```sql
-- Add data_source column if not exists
ALTER TABLE air_quality_readings
ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'WAQI';

-- Allow GOOGLE_SUPPLEMENT value
ALTER TABLE air_quality_readings
DROP CONSTRAINT IF EXISTS check_data_source;

ALTER TABLE air_quality_readings
ADD CONSTRAINT check_data_source
CHECK (data_source IN ('WAQI', 'GOOGLE', 'GOOGLE_SUPPLEMENT'));
```

### 5. Test Endpoints

**Test WAQI collection**:

```bash
curl https://your-app.vercel.app/api/collect-data
```

Expected response:

```json
{
  "success": true,
  "stored": 188,
  "detailedStations": 188,
  "message": "Successfully fetched 188 stations and stored to database"
}
```

**Test Google supplements**:

```bash
curl https://your-app.vercel.app/api/collect-google-supplements
```

Expected response:

```json
{
  "success": true,
  "stationsChecked": 188,
  "stationsNeedingSupplements": 180,
  "gridPointsUsed": 8,
  "googleApiCalls": 8,
  "supplementsAdded": 180,
  "message": "Successfully added O3/NO2 supplements for 180 station readings"
}
```

## Cost Analysis

### WAQI Collection (Every 20 min)

- Frequency: 72 times/day
- Stations: 188
- API calls: FREE (unlimited)
- Pollutants: PM2.5, PM10, SO2, CO

### Google Collection (Every 60 min)

- Frequency: 24 times/day
- Stations needing supplements: ~180 (out of 188)
- Grid points: 8 (avg)
- API calls/day: 24 × 8 = **192**
- API calls/month: 192 × 30 = **5,760** ✅

**Total Google cost**: $0 (well within 10K free tier)

## Data Quality

### 3-Hour Moving Averages

**PM2.5** (primary health concern):

- Readings per 3 hours: **9** (every 20 min)
- Quality: Excellent ✅

**O3/NO2** (gaseous pollutants):

- Readings per 3 hours: **3** (every 60 min)
- Quality: Good (sufficient for slow-changing gases) ✅

## Monitoring

### Check Logs

**Vercel Dashboard**: Functions → Logs

- Look for `api/collect-data` every 20 minutes
- Look for `api/collect-google-supplements` every 60 minutes

**Expected WAQI logs**:

```
📊 Loaded 188 stations from WAQI
✅ Database storage successful: stored 188
```

**Expected Google logs**:

```
📊 Found 180/188 stations needing O3/NO2 supplements
🎯 8 unique grid points needed for 180 stations
💰 Total Google API calls: 8
✅ Stored 180 supplement readings in database
```

### Monitor API Usage

**Google Cloud Console**:

1. Go to https://console.cloud.google.com/
2. Select your project
3. Go to APIs & Services → Dashboard
4. Click "Air Quality API"
5. View usage graphs

Should show ~192 requests/day (5,760/month)

### Database Checks

```sql
-- Check recent WAQI readings
SELECT COUNT(*), MAX(timestamp)
FROM air_quality_readings
WHERE data_source = 'WAQI'
AND timestamp >= NOW() - INTERVAL '1 hour';
-- Should show ~216 readings (188 stations × 3 collections in 1 hour)

-- Check recent Google supplements
SELECT COUNT(*), MAX(timestamp)
FROM air_quality_readings
WHERE data_source = 'GOOGLE_SUPPLEMENT'
AND timestamp >= NOW() - INTERVAL '1 hour';
-- Should show ~180 readings (1 collection per hour)

-- Check 3-hour averages
SELECT
  station_uid,
  COUNT(*) as total_readings,
  COUNT(CASE WHEN pm25 IS NOT NULL THEN 1 END) as pm25_readings,
  COUNT(CASE WHEN o3 IS NOT NULL THEN 1 END) as o3_readings,
  COUNT(CASE WHEN no2 IS NOT NULL THEN 1 END) as no2_readings
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
ORDER BY station_uid;
-- PM2.5: ~9 readings
-- O3/NO2: ~3 readings
```

## Troubleshooting

### Google supplements not working

**Check 1**: Verify API key

```bash
curl -X POST "https://airquality.googleapis.com/v1/currentConditions:lookup?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"location":{"latitude":13.75,"longitude":100.6}}'
```

**Check 2**: Check Vercel logs for errors

- Look for "❌" errors in Google supplement logs
- Common issues: API key not set, quota exceeded, network errors

**Check 3**: Verify data_source column exists

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'air_quality_readings'
AND column_name = 'data_source';
```

### WAQI collection slow

- Normal: 188 stations take 30-60 seconds
- If >2 minutes: Check WAQI API status
- Solution: Increase `maxDuration` in vercel.json (currently 60s)

### Not getting 3-hour averages

- Wait 3 hours after first deployment for data to build up
- Check if both cron jobs are running (view logs)
- Verify timestamps in database match current time

## Benefits

✅ **Cost-Effective**: 5,760 Google calls/month (under 10K free tier)
✅ **Scientific Accuracy**: Complete pollutant data for AQHI
✅ **Data Quality**: 9 PM2.5 readings + 3 O3/NO2 readings per 3 hours
✅ **Scalable**: Same cost for 1 user or 1000 users
✅ **Reliable**: Server-side collection, no client API calls

## Next Steps

1. Deploy to Vercel: `git push`
2. Add environment variables in Vercel dashboard
3. Wait 20 minutes for first WAQI collection
4. Wait 60 minutes for first Google supplements
5. Check database for data
6. Monitor Google API usage in Cloud Console
7. Verify AQHI calculations work correctly

## Support

- WAQI API: https://aqicn.org/api/
- Google Air Quality API: https://developers.google.com/maps/documentation/air-quality
- Supabase: https://supabase.com/docs
- Vercel Cron: https://vercel.com/docs/cron-jobs
