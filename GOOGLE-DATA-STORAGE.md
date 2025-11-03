# Google Air Quality Data Storage & AQHI Calculations

## Overview

Google Air Quality API data is now automatically stored in Supabase to enable 3-hour moving average calculations for accurate AQHI (Air Quality Health Index) values.

## Why Store Google Data?

### AQHI Requires Historical Data

- AQHI calculation uses 3-hour moving averages of PM2.5, NO₂, and O₃
- Single-point readings don't provide accurate health risk assessment
- Historical data builds over time for improved accuracy

### Benefits

- **Accurate AQHI**: Based on 3-hour trends, not single readings
- **Data Quality Indicators**: Shows confidence level based on data points
- **Cross-Device Sync**: Data persists across browsers and devices
- **Historical Analysis**: Track air quality trends over time

## Database Schema Updates

### New Column: `data_source`

Both tables now track the source of data:

```sql
ALTER TABLE air_quality_readings
ADD COLUMN data_source VARCHAR(20) DEFAULT 'WAQI';

ALTER TABLE stations
ADD COLUMN data_source VARCHAR(20) DEFAULT 'WAQI';
```

Valid values: `'WAQI'` or `'GOOGLE'`

### Updated Views

**`current_3h_averages_by_source`**:

- Calculates 3-hour averages separately for each data source
- Includes automatic AQHI calculation
- Groups by `station_uid` and `data_source`

## How It Works

### 1. Data Collection Flow

```
User clicks "Google" toggle
    ↓
fetchGoogleAirQualityData() called
    ↓
Fetches 9 grid points from Google API (9 API calls)
    ↓
storeGoogleDataInSupabase() automatically called
    ↓
Data stored with data_source='GOOGLE'
    ↓
Display updated with current values
```

### 2. AQHI Calculation Flow

```
User switches to AQHI indicator
    ↓
calculateAQHI() detects data_source='GOOGLE'
    ↓
enhanceGoogleStationsWithAQHI() called
    ↓
Fetches 3-hour averages from Supabase
    ↓
Calculates AQHI using Thai formula
    ↓
Adds data quality indicators
    ↓
Display updated with AQHI values
```

### 3. Data Quality Levels

| Reading Count | Quality   | Icon | Description             |
| ------------- | --------- | ---- | ----------------------- |
| 15+           | Excellent | 🎯   | 15+ readings in 3 hours |
| 10-14         | Good      | ✅   | 10+ readings in 3 hours |
| 5-9           | Fair      | ⏳   | 5+ readings in 3 hours  |
| 1-4           | Limited   | 🔄   | Building data           |
| 0             | No data   | ❌   | Using current reading   |

## Files Created/Modified

### New Files

1. **[supabase/add-data-source-column.sql](supabase/add-data-source-column.sql)**
   - SQL migration to add data_source columns
   - Run this in Supabase SQL Editor

2. **[js/google-data-storage.js](js/google-data-storage.js)**
   - `storeGoogleDataInSupabase()` - Store Google data
   - `getGoogle3HourAverages()` - Fetch 3-hour averages
   - `cleanupOldGoogleData()` - Remove old data (7+ days)

3. **[js/aqhi-google.js](js/aqhi-google.js)**
   - `enhanceGoogleStationsWithAQHI()` - Calculate AQHI for Google data
   - `calculateGoogleAQHIStatistics()` - Statistics for Google AQHI

### Modified Files

1. **[js/google-api.js](js/google-api.js)**
   - Added automatic data storage after fetch
   - Import `storeGoogleDataInSupabase`

2. **[js/app.js](js/app.js)**
   - Import `enhanceGoogleStationsWithAQHI`
   - Update `calculateAQHI()` to handle both sources

## Setup Instructions

### 1. Run Database Migration

In Supabase SQL Editor, run:

```bash
# Copy and paste the contents of:
supabase/add-data-source-column.sql
```

This adds:

- `data_source` columns
- Updated views
- Check constraints

### 2. Configure Environment Variables

Already configured if you followed [GOOGLE-AIR-QUALITY-SETUP.md](GOOGLE-AIR-QUALITY-SETUP.md):

```env
GOOGLE_AIR_QUALITY_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 3. Test the Integration

```bash
npm run dev
```

Then:

1. Click "Google" data source toggle
2. Wait for data to load (9 API calls)
3. Check console for: "✅ Stored X Google readings in database"
4. Switch to "AQHI" indicator
5. First time: Will show current readings (🔄 Limited)
6. After manual refreshes: Will show 3-hour averages (✅ Good)

## Data Storage Details

### Storage Trigger

Google data is stored automatically when:

- User switches to Google data source (first time)
- User clicks manual refresh button (while on Google source)
- Data is fetched successfully (9 grid points)

### What Gets Stored

**Stations Table**:

```javascript
{
  station_uid: 'google-13.75-100.6',
  name: 'Bangkok Grid 2-2',
  latitude: 13.75,
  longitude: 100.6,
  city: 'Bangkok',
  country: 'Thailand',
  data_source: 'GOOGLE',
  is_active: true
}
```

**Readings Table**:

```javascript
{
  station_uid: 'google-13.75-100.6',
  timestamp: '2025-10-11T12:00:00Z',
  aqi: 59,
  data_source: 'GOOGLE',
  pm25: 15.64,  // μg/m³
  pm10: 47.21,  // μg/m³
  o3: 14.56,    // ppb
  no2: 32.52,   // ppb
  so2: 1.0,     // ppb
  co: 795.28,   // ppb
  raw_data: {...} // Full Google API response
}
```

### Storage Frequency

Since Google uses on-demand refresh only:

- **Initial load**: 9 calls, 9 readings stored
- **Each manual refresh**: 9 calls, 9 readings stored
- **Example**: 5 refreshes/day = 45 readings/day

### Data Retention

- **Default**: 7 days of historical data
- **Automatic cleanup**: Runs via `cleanupOldGoogleData()`
- **Can be extended**: Modify cleanup function if needed

## AQHI Calculation Process

### Step 1: Fetch 3-Hour Averages

```javascript
const averagesMap = await getGoogle3HourAverages(stationUids);
// Returns: { 'google-13.75-100.6': { avg_pm25: 15.2, avg_no2: 31.5, ... } }
```

### Step 2: Calculate AQHI

Using Thai AQHI formula:

```javascript
const aqhi = calculateThaiAQHI(pm25, no2, o3);
// Uses exponential risk functions for each pollutant
```

### Step 3: Add Data Quality

```javascript
{
  value: 5,
  level: { min: 4, max: 6.9, label: 'Moderate', color: '#f59e0b' },
  calculationMethod: '3h_avg',
  readingCount: 12,
  dataQuality: 'good',
  dataQualityIcon: '✅',
  dataSources: 'google_supabase'
}
```

## API Cost Impact

### No Additional Costs!

Storing data in Supabase does **NOT** increase Google API costs:

- Storage happens after data is fetched
- No extra API calls needed
- Uses existing 9-call fetch

### Benefits for Free Tier

With on-demand refresh (no auto-refresh):

- **Storage**: ~270-1,350 readings/month
- **Retrieval**: Free (Supabase queries)
- **AQHI calculations**: Done in database (free)
- **Still within 10K Google free tier**

## Monitoring Data Collection

### Check Storage in Real-Time

Watch browser console when using Google source:

```
🌐 Fetching Google Air Quality data for 9 locations...
✅ Fetched Google Air Quality data for 9 locations
💾 Storing Google data in Supabase for AQHI calculations...
✅ Stored 9 Google readings in database
```

### Check Data in Supabase

Run in SQL Editor:

```sql
-- Count Google readings
SELECT COUNT(*) as google_readings
FROM air_quality_readings
WHERE data_source = 'GOOGLE';

-- View recent Google data
SELECT station_uid, timestamp, pm25, no2, o3, aqi
FROM air_quality_readings
WHERE data_source = 'GOOGLE'
ORDER BY timestamp DESC
LIMIT 50;

-- Check 3-hour averages
SELECT * FROM current_3h_averages_by_source
WHERE data_source = 'GOOGLE';
```

## Troubleshooting

### Issue: "Supabase not configured"

**Symptom**: Console shows warning about Supabase
**Solution**: Add Supabase environment variables to `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

### Issue: "Failed to store Google data"

**Symptom**: Error message in console
**Possible causes**:

1. Database migration not run → Run `add-data-source-column.sql`
2. Network error → Check internet connection
3. Invalid API key → Verify Supabase credentials

### Issue: AQHI shows "Limited" quality

**Symptom**: All stations show 🔄 Limited
**Explanation**: Normal for first few manual refreshes
**Solution**: Perform 3-5 manual refreshes over 3 hours to build history

### Issue: No 3-hour averages

**Symptom**: All AQHI calculations use current readings
**Check**:

```sql
SELECT COUNT(*) FROM air_quality_readings
WHERE data_source = 'GOOGLE'
AND timestamp >= NOW() - INTERVAL '3 hours';
```

**Solution**: Need more data points. Refresh manually every 20-30 minutes.

## Best Practices

### 1. Initial Data Collection

For best AQHI accuracy on first day:

1. Switch to Google source
2. Refresh manually every 20-30 minutes
3. After 3 hours: Full 3-hour averages available
4. Quality improves with each refresh

### 2. Regular Usage

- Use WAQI as default (auto-refresh every 10 min)
- Switch to Google occasionally for comparison
- Manual refresh Google 1-3 times per session
- AQHI improves automatically over time

### 3. Data Quality

- **First refresh**: Current readings only (🔄 Limited)
- **2-4 refreshes**: Building averages (⏳ Fair)
- **5-10 refreshes**: Good coverage (✅ Good)
- **15+ refreshes**: Excellent data (🎯 Excellent)

## Technical Notes

### Concurrent Data Sources

WAQI and Google data are stored separately:

- Separate `station_uid` formats
- Filtered by `data_source` column
- Independent 3-hour average calculations
- No data conflicts

### Station UID Format

- **WAQI**: Numeric (e.g., `"1234"`)
- **Google**: Prefixed (e.g., `"google-13.75-100.6"`)

This ensures no collisions between sources.

### Performance

- Storage is async (non-blocking)
- Queries use indexed columns
- 3-hour averages are pre-computed views
- No impact on UI responsiveness

## Future Enhancements

Possible improvements:

1. **Background sync**: Store data even when not viewing
2. **Longer retention**: Keep 30+ days for trend analysis
3. **Export data**: Download historical Google data as CSV
4. **Comparison views**: Side-by-side WAQI vs Google AQHI
5. **Alerts**: Notify when AQHI exceeds thresholds

## Summary

✅ Google data automatically stored in Supabase
✅ 3-hour averages calculated for accurate AQHI
✅ Data quality indicators show confidence level
✅ No additional API costs
✅ Works alongside WAQI data
✅ Cross-device persistence
✅ Historical data for trend analysis

The integration is fully automatic - just use Google source normally and AQHI calculations improve over time!
