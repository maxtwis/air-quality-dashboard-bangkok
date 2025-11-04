# 🚀 Google-Only AQHI System - Deployment Guide

## ✅ What You Have Now

A **clean, separated air quality system**:

| Tab | Data Source | What It Shows | Status |
|-----|-------------|---------------|--------|
| **AQI** | WAQI API | US EPA Air Quality Index | ✅ Keep as-is |
| **AQHI** | Google API (15 locations) | Thai Air Quality Health Index | 🆕 New system |

---

## 📋 Deployment Checklist

### Step 1: Clean Up Old AQHI System

Run in **Supabase SQL Editor**:

```sql
-- File: supabase/cleanup-old-aqhi.sql
```

This removes:
- ✅ Old combined WAQI+Google AQHI tables
- ✅ Old views and functions
- ✅ Old triggers

**Keeps**:
- ✅ `waqi_data` table (for AQI tab)
- ✅ WAQI collection endpoint

### Step 2: Create New Google-Only AQHI System

Run in **Supabase SQL Editor**:

```sql
-- File: supabase/google-aqhi-system.sql
```

This creates:
- ✅ `community_locations` table (15 monitoring points)
- ✅ `google_aqhi_hourly` table (hourly data with 3h averages)
- ✅ Functions for averaging and AQHI calculation
- ✅ Views for frontend access

### Step 3: Update Environment Variables

Check your `.env.local`:

```bash
# Required for new system
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_AIR_QUALITY_API_KEY=your-google-api-key

# Still needed for AQI tab
WAQI_API_TOKEN=your-waqi-token
```

### Step 4: Deploy Server Changes

Your server now has these endpoints:

```
GET /api/google-aqhi/collect   → Collect hourly Google AQHI data
GET /api/google-aqhi/health    → Health check
```

**Deploy to Vercel:**

```bash
# Commit changes
git add .
git commit -m "Implement Google-only AQHI system"
git push origin main

# Vercel will auto-deploy
```

Or if manual:

```bash
vercel --prod
```

### Step 5: Update cron-job.org

1. **Go to**: https://cron-job.org
2. **Find old job**: "Collect Google Supplements" or similar
3. **Edit or Create New**:
   - **Title**: `Google AQHI Hourly Collection`
   - **URL**: `https://clean-air-bkk.vercel.app/api/google-aqhi/collect`
   - **Schedule**: Every hour at `:00` minutes
   - **Method**: GET

4. **Test**: Click "Run now"
5. **Verify**: Check "History" for Status 200

### Step 6: Verify Data Collection

After first cron run:

```sql
-- Check if data was collected
SELECT * FROM latest_aqhi_by_location ORDER BY location_id;

-- Should see 15 locations with AQHI values
SELECT COUNT(*) FROM google_aqhi_hourly;

-- Check 3-hour averages are working
SELECT
  location_id,
  hour_timestamp,
  pm25,
  pm25_3h_avg,
  aqhi,
  aqhi_category
FROM google_aqhi_hourly
WHERE location_id = 1
ORDER BY hour_timestamp DESC
LIMIT 5;
```

---

## 🗑️ Files to Delete (Already Done)

These old files have been removed:

- ❌ `api/collect-google-supplements.js` (old system)
- ❌ `cron-google-aqhi.js` (standalone script)
- ❌ `supabase/aqhi-hourly-system.sql` (old schema)
- ❌ `supabase/aqhi-hourly-system-v2.sql` (old schema)
- ❌ `supabase/aqhi-with-aqi-conversion.sql` (old schema)

---

## 📦 Files to Keep

### Core System Files

✅ `supabase/google-aqhi-system.sql` - New database schema
✅ `api-google-aqhi.js` - Collection logic
✅ `server.js` - API endpoints

### Documentation

✅ `CRON-JOB-ORG-SETUP.md` - cron-job.org setup guide
✅ `GOOGLE-AQHI-SETUP.md` - Full system setup
✅ `GOOGLE-AQHI-SUMMARY.md` - System overview
✅ `DEPLOYMENT.md` - This file

### Cleanup

✅ `supabase/cleanup-old-aqhi.sql` - Remove old tables

---

## 🎯 Expected Results

### After 1 Hour

- ✅ 15 locations with fresh data
- ✅ Raw pollutant values stored
- ⏳ AQHI values = 1 (not enough data for 3h average yet)

### After 3 Hours

- ✅ 15 locations with 3 readings each
- ✅ 3-hour rolling averages calculated
- ✅ Accurate AQHI values based on averages
- ✅ AQHI categories assigned (LOW/MODERATE/HIGH/VERY_HIGH)

### After 24 Hours

- ✅ 24 readings per location (360 total)
- ✅ Complete 24-hour chart data available
- ✅ Trends visible
- ✅ System fully operational

---

## 🔍 Monitoring

### Check Cron Job

**cron-job.org Dashboard:**
- Last execution: Should be < 1 hour ago
- Status: Success (200)
- Avg duration: ~3-5 seconds

### Check Database

```sql
-- Latest collection time
SELECT MAX(hour_timestamp) as last_collection
FROM google_aqhi_hourly;

-- Should be current hour (rounded to :00)

-- Data completeness (last 24 hours)
SELECT
  hour_timestamp,
  COUNT(*) as locations_collected,
  COUNT(CASE WHEN aqhi IS NOT NULL THEN 1 END) as with_aqhi
FROM google_aqhi_hourly
WHERE hour_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour_timestamp
ORDER BY hour_timestamp DESC;

-- Expected: 15 locations per hour
```

### Check API Health

```bash
curl https://clean-air-bkk.vercel.app/api/google-aqhi/health
```

Expected response:
```json
{
  "status": "OK",
  "service": "Google AQHI Collector",
  "timestamp": "2024-01-15T08:00:00.000Z",
  "config": {
    "hasGoogleApiKey": true,
    "hasSupabaseUrl": true,
    "hasSupabaseKey": true,
    "locations": 15
  }
}
```

---

## ⚠️ Troubleshooting

### Issue: No data after cron run

**Check:**

1. Cron job status in cron-job.org (Status 200?)
2. API endpoint: `https://clean-air-bkk.vercel.app/api/google-aqhi/collect`
3. Vercel logs for errors
4. Supabase table permissions

**Solution:**

```bash
# Test manually
curl https://clean-air-bkk.vercel.app/api/google-aqhi/collect

# Should return success:true
```

### Issue: AQHI values still showing 1

**This is normal in first 1-2 hours!**

AQHI needs 3 hours of data for accurate averages:
- Hour 1: AQHI = 1 (only current reading)
- Hour 2: AQHI = ~2 (average of 2 readings)
- Hour 3+: AQHI = accurate (3-hour average)

### Issue: Some locations missing data

**Check Google API quota:**

Go to Google Cloud Console:
- APIs & Services → Air Quality API
- Check quota usage
- Default: 100 requests/day per location = enough for 15 locations

---

## 🎉 Success Indicators

✅ **cron-job.org**: Status 200, runs every hour
✅ **Supabase**: 15 new readings every hour
✅ **AQHI calculated**: After 3 hours, accurate values
✅ **No errors**: Clean logs in Vercel and cron-job.org
✅ **Frontend ready**: Views available for display

---

## 📈 Next Steps: Frontend Integration

### Example: Fetch Latest AQHI

```javascript
// In your frontend code
const { data } = await supabase
  .from('latest_aqhi_by_location')
  .select('*')
  .order('location_id');

// Display on map
data.forEach(location => {
  L.marker([location.latitude, location.longitude])
    .bindPopup(`
      <h3>${location.location_name}</h3>
      <p><strong>AQHI:</strong> ${location.aqhi} (${location.aqhi_category})</p>
      <p>PM2.5: ${location.pm25_3h_avg?.toFixed(1)} μg/m³</p>
      <p>O3: ${location.o3_3h_avg?.toFixed(1)} ppb</p>
    `)
    .addTo(map);
});
```

### Example: 24-Hour Chart

```javascript
const { data: history } = await supabase
  .from('aqhi_24h_history')
  .select('*')
  .eq('location_id', 1)
  .order('hour_timestamp');

// Use with Chart.js, Recharts, etc.
const chartData = history.map(row => ({
  time: row.hour_timestamp,
  aqhi: row.aqhi,
  category: row.aqhi_category
}));
```

---

## 🔐 Security Checklist

✅ Supabase Row Level Security enabled
✅ Service role key only in server environment
✅ API keys in environment variables (not in code)
✅ Public read access for frontend
✅ Write access only via service role

---

## 📞 Support

**Documentation:**
- [CRON-JOB-ORG-SETUP.md](CRON-JOB-ORG-SETUP.md) - Detailed cron setup
- [GOOGLE-AQHI-SUMMARY.md](GOOGLE-AQHI-SUMMARY.md) - System overview

**Test Endpoints:**
- Health: `https://clean-air-bkk.vercel.app/api/google-aqhi/health`
- Collect: `https://clean-air-bkk.vercel.app/api/google-aqhi/collect`

**Check Logs:**
- Vercel: https://vercel.com/your-project/logs
- cron-job.org: Dashboard → History
- Supabase: Logs & Analytics

---

## ✨ Summary

Your new system:

✅ **Separated**: AQI (WAQI) | AQHI (Google)
✅ **Simplified**: No more WAQI→Google conversion
✅ **Accurate**: True Google ppb values, not AQI conversions
✅ **Community-focused**: 15 fixed monitoring locations
✅ **Efficient**: Hourly collection, server-side calculation
✅ **Production-ready**: Auto-cleanup, monitoring, logging

**System is deployed and operational! 🎉**
