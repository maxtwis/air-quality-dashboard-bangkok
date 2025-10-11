# Supabase Setup - 2 Simple Steps

## 🎯 What This Does

Creates two separate tables:
1. **waqi_data** - Stores WAQI pollutants (PM2.5, PM10, SO2, CO)
2. **google_supplements** - Stores Google O3/NO2 matched to each station
3. **combined_3h_averages** view - Joins both for AQHI calculations

## 📋 Setup Instructions

### Go to Supabase SQL Editor

https://supabase.com/dashboard → Your Project → SQL Editor

---

### Step 1: Drop Old Tables

Copy and paste this entire query:

```sql
-- STEP 1: Drop all old tables, views, and functions

DROP VIEW IF EXISTS current_3h_averages CASCADE;
DROP VIEW IF EXISTS current_3h_averages_detailed CASCADE;
DROP VIEW IF EXISTS current_3h_averages_by_source CASCADE;
DROP VIEW IF EXISTS latest_station_readings CASCADE;
DROP VIEW IF EXISTS latest_google_supplements CASCADE;
DROP VIEW IF EXISTS google_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_readings CASCADE;
DROP VIEW IF EXISTS air_quality_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_waqi_readings CASCADE;
DROP VIEW IF EXISTS latest_combined_readings CASCADE;
DROP VIEW IF EXISTS waqi_3h_averages CASCADE;
DROP VIEW IF EXISTS combined_3h_averages CASCADE;

DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;
DROP FUNCTION IF EXISTS clean_old_air_quality_data() CASCADE;
DROP FUNCTION IF EXISTS calculate_aqhi(DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;

DROP TABLE IF EXISTS google_supplements CASCADE;
DROP TABLE IF EXISTS air_quality_readings CASCADE;
DROP TABLE IF EXISTS air_quality_data CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS waqi_data CASCADE;

SELECT 'All old tables dropped successfully!' as status;
```

**Click "Run"**

✅ Should see: "All old tables dropped successfully!"

---

### Step 2: Create New Tables

Copy **entire contents** of [supabase/step2-create-new.sql](supabase/step2-create-new.sql) and paste into SQL Editor.

**Click "Run"**

✅ Should see:
```
status: Fresh schema created successfully!
waqi_records: 0
google_records: 0
```

---

## ✅ Verify Setup

Run this query to confirm tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Should show:
- ✅ waqi_data
- ✅ google_supplements

---

## 🧪 Test the Google Endpoint

Now that tables exist, test the endpoint:

```bash
curl https://clean-air-bkk.vercel.app/api/collect-google-supplements
```

**Expected response**:
```json
{
  "success": true,
  "stationsChecked": 127,
  "stationsNeedingSupplements": 127,
  "googleApiCalls": 7,
  "supplementsAdded": 127,
  "storedInDatabase": 127,  ← Should be 127 now!
  "message": "Successfully added O3/NO2 supplements for 127 stations"
}
```

---

## 📊 View Data in Supabase

After endpoint runs successfully:

```sql
-- Check Google supplements were stored
SELECT COUNT(*) as total, MAX(timestamp) as latest
FROM google_supplements;

-- View some samples
SELECT station_uid, o3, no2, grid_lat, grid_lon
FROM google_supplements
ORDER BY timestamp DESC
LIMIT 10;

-- See which grid points are being used
SELECT grid_lat, grid_lon, COUNT(*) as stations
FROM google_supplements
GROUP BY grid_lat, grid_lon
ORDER BY stations DESC;
```

---

## 🎯 How AQHI Calculation Works

Once you have 3 hours of data (3 WAQI collections + 3 Google collections):

```sql
-- View combined averages
SELECT
    station_uid,
    avg_pm25,      -- From WAQI (9 readings)
    avg_pm10,      -- From WAQI (9 readings)
    avg_o3,        -- From Google (3 readings)
    avg_no2,       -- From Google (3 readings)
    waqi_readings,
    google_readings,
    data_quality
FROM combined_3h_averages
LIMIT 10;
```

This gives you complete pollutant data for AQHI calculation! 🎉

---

## ⏱️ Timeline

| Time | What Happens |
|------|-------------|
| T+0 min | Run SQL setup (both steps) |
| T+20 min | First WAQI collection (waqi_data gets 127 records) |
| T+60 min | First Google collection (google_supplements gets 127 records) |
| T+3 hours | combined_3h_averages fully populated |

---

## 🔧 Troubleshooting

### Issue: "storedInDatabase: 0" in endpoint response

**Solution**: Make sure you ran both Step 1 AND Step 2 in Supabase.

Verify table exists:
```sql
SELECT COUNT(*) FROM google_supplements;
```

If error "relation does not exist", run Step 2 again.

### Issue: Step 2 fails with function error

**Solution**: Run Step 1 first to drop the old function, then run Step 2.

---

## ✅ Success Checklist

- [ ] Step 1 completed (old tables dropped)
- [ ] Step 2 completed (new tables created)
- [ ] Tables verified (waqi_data, google_supplements exist)
- [ ] Endpoint tested (storedInDatabase > 0)
- [ ] Data visible in Supabase
- [ ] Cron job running hourly

**Setup complete!** 🚀

Your Google O3/NO2 supplements are now being collected every hour and matched to the correct WAQI stations for accurate AQHI calculations.
