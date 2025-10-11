# Supabase Setup Checklist for Google Supplements

## Quick Setup (5 minutes)

### 1. Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

### 2. Run the Migration SQL

Copy and paste the entire contents of `supabase/update-for-google-supplements.sql` into the SQL Editor and click **Run**.

This will:
- ✅ Add `data_source` column (if not exists)
- ✅ Update constraint to allow `GOOGLE_SUPPLEMENT` value
- ✅ Create indexes for performance
- ✅ Update 3-hour averages view to combine WAQI + Google data
- ✅ Create detailed view showing data sources separately

### 3. Verify Schema Update

After running the SQL, you should see:
```
status: Schema updated successfully!
total_readings: X
waqi_readings: X
google_readings: 0 (will populate after first Google cron run)
```

## What Changed

### air_quality_readings Table

**Before**:
```sql
data_source VARCHAR(20) CHECK (data_source IN ('WAQI', 'GOOGLE'))
```

**After**:
```sql
data_source VARCHAR(20) CHECK (data_source IN ('WAQI', 'GOOGLE', 'GOOGLE_SUPPLEMENT'))
```

### How Data is Stored

**WAQI readings** (every 20 minutes):
```sql
INSERT INTO air_quality_readings (
  station_uid, timestamp, pm25, pm10, so2, co, data_source
) VALUES (
  '12345', '2025-10-12 10:00:00', 35.2, 42.1, 5.3, 0.8, 'WAQI'
);
```

**Google supplement readings** (every 60 minutes):
```sql
INSERT INTO air_quality_readings (
  station_uid, timestamp, o3, no2, data_source
) VALUES (
  '12345', '2025-10-12 10:00:00', 45.6, 28.3, 'GOOGLE_SUPPLEMENT'
);
```

### How 3-Hour Averages Work

The `current_3h_averages` view automatically combines both sources:

```sql
SELECT * FROM current_3h_averages WHERE station_uid = '12345';
```

Returns:
```
station_uid: 12345
avg_pm25: 36.2    (from 9 WAQI readings)
avg_pm10: 43.5    (from 9 WAQI readings)
avg_o3: 46.1      (from 3 Google readings)
avg_no2: 29.4     (from 3 Google readings)
waqi_count: 9     (3 readings/hour × 3 hours)
google_count: 3   (1 reading/hour × 3 hours)
```

## Verify Setup is Working

### Check WAQI Data (should already exist)

```sql
SELECT
  COUNT(*) as count,
  MAX(timestamp) as latest
FROM air_quality_readings
WHERE data_source = 'WAQI'
AND timestamp >= NOW() - INTERVAL '1 hour';
```

**Expected**: ~216 readings (188 stations × 3 collections in 1 hour)

### Check Google Supplements (after first cron run)

```sql
SELECT
  COUNT(*) as count,
  MAX(timestamp) as latest
FROM air_quality_readings
WHERE data_source = 'GOOGLE_SUPPLEMENT'
AND timestamp >= NOW() - INTERVAL '1 hour';
```

**Expected**: ~180 readings (once per hour)

### Check Combined 3-Hour Averages

```sql
SELECT
  station_uid,
  avg_pm25,
  avg_o3,
  avg_no2,
  waqi_count,
  google_count
FROM current_3h_averages
LIMIT 10;
```

**Expected**:
- `waqi_count`: ~9 (WAQI readings every 20 min)
- `google_count`: ~3 (Google readings every 60 min)
- `avg_pm25`: populated (from WAQI)
- `avg_o3`, `avg_no2`: populated (from Google)

### Check Data Quality by Station

```sql
SELECT
  s.name,
  s.city,
  r.waqi_count,
  r.google_count,
  r.avg_pm25,
  r.avg_o3,
  r.avg_no2,
  r.latest_reading
FROM current_3h_averages r
JOIN stations s ON s.uid = r.station_uid
WHERE r.google_count > 0  -- Only stations with Google supplements
ORDER BY r.latest_reading DESC
LIMIT 20;
```

This shows which stations are successfully getting Google O3/NO2 supplements.

## Troubleshooting

### Issue: No Google supplement readings after 1 hour

**Check 1**: Verify cron job ran successfully
- Go to cron-job.org → Execution history
- Should show 200 OK response

**Check 2**: Check Vercel logs
```bash
# View recent function logs
curl https://vercel.com/api/logs?projectId=YOUR_PROJECT_ID
```

Look for:
```
📊 Found 180/188 stations needing O3/NO2 supplements
✅ Stored 180 supplement readings in database
```

**Check 3**: Verify data_source constraint
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'check_data_source';
```

Should include `GOOGLE_SUPPLEMENT`.

### Issue: 3-hour averages not calculating

**Check 1**: Verify view exists
```sql
SELECT COUNT(*) FROM current_3h_averages;
```

**Check 2**: Check if readings have timestamps
```sql
SELECT COUNT(*) as total,
  COUNT(CASE WHEN timestamp IS NULL THEN 1 END) as null_timestamps
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours';
```

All timestamps should be non-null.

**Check 3**: Recreate view
```sql
DROP VIEW IF EXISTS current_3h_averages CASCADE;
-- Then re-run the CREATE VIEW statement from migration SQL
```

## Expected Timeline

| Time | What Happens | Data in Supabase |
|------|-------------|------------------|
| T+0 min | Run SQL migration | Schema updated ✅ |
| T+0-20 min | Wait for WAQI cron | WAQI readings continue as normal |
| T+60 min | First Google cron runs | 180 Google supplement readings added ✅ |
| T+120 min | Second Google cron | 180 more Google readings |
| T+180 min | Third Google cron | 3-hour averages now complete ✅ |

## Data Storage Summary

**Per Day**:
- WAQI readings: 188 stations × 72 collections = 13,536 readings/day
- Google supplements: 180 stations × 24 collections = 4,320 readings/day
- **Total**: ~17,856 readings/day

**Per Month** (with 7-day retention):
- Active readings: ~125,000 readings
- Storage: ~25-50 MB (depending on null values)

This is well within Supabase free tier limits! ✅

## Next Steps

1. ✅ Run `supabase/update-for-google-supplements.sql` in Supabase SQL Editor
2. ✅ Verify schema update successful
3. ⏳ Wait for first Google cron job to run (next hour mark)
4. ✅ Check for Google supplement readings in database
5. ⏳ Wait 3 hours for full 3-hour averages to build
6. ✅ Verify AQHI calculations use complete pollutant data

## Support

- Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
- Supabase Logs: https://supabase.com/dashboard/project/YOUR_PROJECT/logs
- Table Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/editor
