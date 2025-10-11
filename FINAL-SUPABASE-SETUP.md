# Final Supabase Setup Guide

## 🎯 Goal

Create clean separate tables:
1. **waqi_data** - PM2.5, PM10, SO2, CO (collected every 20 min)
2. **google_supplements** - O3, NO2 (collected every 60 min)
3. **combined_3h_averages** view - Joins both for AQHI calculations

## 📋 Step-by-Step Setup (5 minutes)

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard → Your Project → SQL Editor

### Step 2: Check What Tables Exist

Paste and run:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

You'll see what tables currently exist (stations, air_quality_readings, etc.)

### Step 3: Drop All Old Tables

**⚠️ WARNING: This deletes all existing air quality data!**

Paste and run:
```sql
-- Drop all old tables and views
DROP VIEW IF EXISTS current_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_station_readings CASCADE;
DROP VIEW IF EXISTS latest_google_supplements CASCADE;
DROP VIEW IF EXISTS google_3h_averages CASCADE;
DROP VIEW IF EXISTS latest_readings CASCADE;
DROP VIEW IF EXISTS air_quality_3h_averages CASCADE;

DROP TABLE IF EXISTS google_supplements CASCADE;
DROP TABLE IF EXISTS air_quality_readings CASCADE;
DROP TABLE IF EXISTS air_quality_data CASCADE;
DROP TABLE IF EXISTS stations CASCADE;

SELECT 'All old tables dropped!' as status;
```

### Step 4: Create Fresh Schema

Copy **entire contents** of `supabase/fresh-schema.sql` and paste into SQL Editor.

Click **Run**.

You should see:
```
✅ Fresh schema created successfully!
   waqi_records: 0
   google_records: 0
```

## 🔍 Verify Schema

Check that tables were created:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Should show:
-- waqi_data
-- google_supplements

-- Check views
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public';

-- Should show:
-- latest_waqi_readings
-- latest_google_supplements
-- latest_combined_readings
-- waqi_3h_averages
-- google_3h_averages
-- combined_3h_averages
```

## 📊 Schema Overview

### Table: waqi_data

| Column | Type | Description |
|--------|------|-------------|
| station_uid | INTEGER | WAQI station ID |
| timestamp | TIMESTAMPTZ | When collected |
| lat, lon | DECIMAL | Station location |
| station_name | TEXT | Station name |
| aqi | INTEGER | Air Quality Index |
| pm25, pm10 | DECIMAL | Primary pollutants |
| so2, co | DECIMAL | Other pollutants |
| o3, no2 | DECIMAL | Rare (usually NULL) |

**Populated by**: `api/collect-data` (every 20 minutes)

### Table: google_supplements

| Column | Type | Description |
|--------|------|-------------|
| station_uid | INTEGER | WAQI station this supplements |
| timestamp | TIMESTAMPTZ | When collected |
| o3 | DECIMAL | Ozone from Google |
| no2 | DECIMAL | Nitrogen Dioxide from Google |
| grid_lat, grid_lon | DECIMAL | Source grid point |

**Populated by**: `api/collect-google-supplements` (every 60 minutes)

### View: combined_3h_averages ⭐ (FOR AQHI)

```sql
SELECT * FROM combined_3h_averages WHERE station_uid = 12345;
```

Returns:
```
station_uid: 12345
avg_pm25: 35.2     (from 9 WAQI readings)
avg_pm10: 42.1     (from 9 WAQI readings)
avg_o3: 45.6       (from 3 Google readings) ← Matched to this station!
avg_no2: 28.3      (from 3 Google readings) ← Matched to this station!
waqi_readings: 9
google_readings: 3
data_quality: EXCELLENT
```

## 🔗 How the Matching Works

### Grid → Station Matching

When Google supplements are collected:

1. **Fetch 8 grid points** (3x3 coverage of Bangkok)
   - Grid Point 1: (13.5, 100.3) → O3=42.1, NO2=25.3
   - Grid Point 2: (13.5, 100.6) → O3=45.6, NO2=28.3
   - etc.

2. **Find nearest grid for each station**:
   - Station 12345 at (13.52, 100.58) → nearest is Grid Point 2
   - Station 12346 at (13.48, 100.31) → nearest is Grid Point 1
   - Station 12347 at (13.51, 100.62) → nearest is Grid Point 2

3. **Store with station_uid**:
```sql
INSERT INTO google_supplements VALUES
  (12345, NOW(), 45.6, 28.3, 13.5, 100.6),  -- Station 12345 gets Grid 2 data
  (12346, NOW(), 42.1, 25.3, 13.5, 100.3),  -- Station 12346 gets Grid 1 data
  (12347, NOW(), 45.6, 28.3, 13.5, 100.6);  -- Station 12347 gets Grid 2 data
```

4. **Join for AQHI**:
```sql
SELECT w.avg_pm25, g.avg_o3, g.avg_no2
FROM waqi_3h_averages w
JOIN google_3h_averages g ON w.station_uid = g.station_uid
WHERE w.station_uid = 12345;
```

**Result**: Each station gets PM2.5 from WAQI + O3/NO2 from nearest Google grid!

## ✅ After Setup Complete

### Test Data Flow

**1. Wait for WAQI collection** (every 20 min):
```sql
SELECT COUNT(*), MAX(timestamp) FROM waqi_data;
-- Should show ~188 records after first collection
```

**2. Wait for Google collection** (every 60 min, on the hour):
```sql
SELECT COUNT(*), MAX(timestamp) FROM google_supplements;
-- Should show ~180 records after first collection
```

**3. Check combined view**:
```sql
SELECT COUNT(*) FROM combined_3h_averages;
-- After 3 hours, should show ~188 stations with complete data
```

### Verify Grid Matching

```sql
-- See which grid points are being used
SELECT
    grid_lat,
    grid_lon,
    COUNT(*) as station_count,
    ARRAY_AGG(station_uid) as stations
FROM latest_google_supplements
GROUP BY grid_lat, grid_lon
ORDER BY station_count DESC;
```

This shows:
```
grid_lat | grid_lon | station_count | stations
13.500   | 100.600  | 25            | {12345, 12367, 12389, ...}
13.750   | 100.600  | 28            | {12346, 12356, 12378, ...}
...
```

## 🎯 Using Data for AQHI

### Query for AQHI Calculation

```sql
SELECT
    station_uid,
    avg_pm25,
    avg_pm10,
    avg_o3,
    avg_no2,
    avg_so2,
    waqi_readings,
    google_readings,
    data_quality,
    -- Calculate AQHI (simplified formula)
    ROUND(
        (
            (1000/10.4) * (EXP(0.000487 * COALESCE(avg_pm25, 0)) - 1) +
            (1000/16.8) * (EXP(0.000871 * COALESCE(avg_no2, 0)) - 1) +
            (1000/20.2) * (EXP(0.000537 * COALESCE(avg_o3, 0)) - 1)
        ) * 10 / 10.4
    , 1) as aqhi
FROM combined_3h_averages
WHERE waqi_readings >= 3  -- Need at least 3 WAQI readings
  AND google_readings >= 1  -- Need at least 1 Google reading
ORDER BY aqhi DESC;
```

## 📈 Data Volume Expectations

### Daily
- WAQI records: 188 stations × 72 collections = **13,536 records/day**
- Google records: 180 stations × 24 collections = **4,320 records/day**
- **Total**: ~18,000 records/day

### With 7-day Retention
- Active records: ~125,000
- Storage: ~30-50 MB
- Well within Supabase free tier ✅

## 🧹 Maintenance

### Auto-cleanup (Optional)

Set up a cron to clean old data weekly:

```sql
-- Run this manually or via cron
SELECT cleanup_old_data();

-- This deletes records older than 7 days
```

## 🐛 Troubleshooting

### Issue: No data in waqi_data

**Check**: Is `api/collect-data` running?
```bash
curl https://clean-air-bkk.vercel.app/api/collect-data
```

### Issue: No data in google_supplements

**Check**: Is `api/collect-google-supplements` running?
```bash
curl https://clean-air-bkk.vercel.app/api/collect-google-supplements
```

**Check**: Cron job on cron-job.org running?

### Issue: combined_3h_averages is empty

**Wait 3 hours** for enough data to build up:
- WAQI needs 3+ readings (60 minutes)
- Google needs 1+ readings (60 minutes)

## ✅ Final Checklist

- [ ] Old tables dropped
- [ ] Fresh schema created (`fresh-schema.sql` run successfully)
- [ ] Both tables exist (waqi_data, google_supplements)
- [ ] All 6 views created
- [ ] WAQI collection tested (curl collect-data)
- [ ] Google collection tested (curl collect-google-supplements)
- [ ] Cron jobs configured (20 min WAQI, 60 min Google)
- [ ] After 1 hour: Data in both tables
- [ ] After 3 hours: combined_3h_averages populated

## 🎉 Success!

Your Bangkok Air Quality Dashboard now has:
- ✅ Separate WAQI and Google tables
- ✅ Grid-to-station matching for O3/NO2
- ✅ Combined 3-hour averages for AQHI
- ✅ Complete pollutant data for all 188 stations
- ✅ Under 10K/month Google API limit

**Total monthly cost: $0** 🎯
