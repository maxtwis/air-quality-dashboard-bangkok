# Server-Side Hybrid Data Collection (Correct Architecture)

## Overview

The correct architecture uses **server-side data collection** via cron jobs, NOT client-side API calls. This ensures:
- ✅ Reliable 3-hour averages
- ✅ No user-triggered API costs
- ✅ Consistent data collection
- ✅ Data available for all users from Supabase

## Architecture Flow (Dual Cron Jobs)

```
┌─────────────────────────────────────────────────────────────┐
│            CRON JOB #1: WAQI (Every 20 min)                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              api/collect-data.js (SERVER-SIDE)              │
│                                                              │
│  1. Fetch WAQI data (188 stations in Bangkok)              │
│  2. Fetch detailed pollutant data                          │
│  3. Store in Supabase (PM2.5, PM10, SO2, CO)               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           CRON JOB #2: Google (Every 60 min)                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│       api/collect-google-supplements.js (SERVER-SIDE)       │
│                                                              │
│  1. Load recent WAQI stations from Supabase                │
│  2. Check for missing O3/NO2 (~180 of 188 stations)        │
│  3. Map to nearest 3x3 grid points                         │
│  4. Fetch Google data (typically 7-9 grid points)          │
│  5. Store O3/NO2 supplements in Supabase                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE DATABASE                       │
│                                                              │
│  - air_quality_readings (WAQI + Google supplements)         │
│  - current_3h_averages (auto-calculated view)              │
│  - All pollutants complete (PM2.5, O3, NO2, etc.)          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│                                                              │
│  1. Reads from Supabase (via API proxy)                    │
│  2. Gets complete data with 3-hour averages                │
│  3. Calculates AQHI using all pollutants                   │
│  4. Displays on map                                         │
│                                                              │
│  NO GOOGLE API CALLS FROM CLIENT!                           │
└─────────────────────────────────────────────────────────────┘
```

## Why This is Better

### ❌ Client-Side Approach (Wrong)
```
User clicks station → Google API call → Data shown
Problems:
- Users trigger API costs
- No 3-hour averages (needs time)
- Inconsistent data collection
- Each user makes separate calls
```

### ✅ Server-Side Approach (Correct)
```
Cron job runs every 10 min → Collects all data → Stores in DB → All users read from DB
Benefits:
- Predictable API costs
- 3-hour averages build automatically
- Consistent data for all users
- Only 1 set of API calls per 10 min
```

## Server-Side Implementation

### api/collect-data.js (WAQI Only)

```javascript
// Step 1: Fetch WAQI data
const stations = await fetchAirQualityData();

// Step 2: Get detailed pollutant data
const detailedStations = await fetchDetailedStationData(stations);

// Step 3: Store in Supabase (PM2.5, PM10, SO2, CO from WAQI)
await storeHistoricalData(detailedStations);
// Google supplements handled separately (see below)
```

### api/collect-google-supplements.js (NEW - Google Only)

```javascript
// Step 1: Load recent WAQI stations from Supabase
const stations = await supabase.from('stations').select('*');
const recentReadings = await supabase.from('air_quality_readings')
  .select('station_uid, o3, no2')
  .gte('timestamp', '2 hours ago');

// Step 2: Find stations missing O3/NO2
const stationsNeedingSupplements = stations.filter(station => {
  // Check if station has recent O3/NO2 readings
  const hasCompleteData = recentReadings.some(r =>
    r.station_uid === station.uid && r.o3 && r.no2
  );
  return !hasCompleteData;
});
// Typically ~180 of 188 stations need supplements

// Step 3: Map to nearest 3x3 grid points (smart caching)
const gridCache = mapStationsToGridPoints(stationsNeedingSupplements);
// Results in 7-9 unique grid points for Bangkok

// Step 4: Fetch Google data for grid points
for (const gridPoint of uniqueGridPoints) {
  const googleData = await fetchGoogleAirQuality(gridPoint);
  storeInCache(gridPoint, googleData);
}

// Step 5: Create supplement readings
const supplementReadings = [];
for (const station of stationsNeedingSupplements) {
  const nearestGrid = findNearestGridPoint(station);
  const googleData = getFromCache(nearestGrid);

  supplementReadings.push({
    station_uid: station.uid,
    timestamp: new Date(),
    o3: googleData.o3,
    no2: googleData.no2,
    data_source: 'GOOGLE_SUPPLEMENT'
  });
}

// Step 6: Store in Supabase
await supabase.from('air_quality_readings').insert(supplementReadings);
```

### Cron Job Execution

**WAQI Collection (Every 20 minutes)**:
```
10:00 AM → 188 WAQI stations → Store PM2.5, PM10, SO2, CO
10:20 AM → 188 WAQI stations → Store PM2.5, PM10, SO2, CO
10:40 AM → 188 WAQI stations → Store PM2.5, PM10, SO2, CO
...
```

**Google Supplements (Every 60 minutes)**:
```
10:00 AM → Check 188 stations → 180 need O3/NO2 → Fetch 8 grid points → Store supplements
11:00 AM → Check 188 stations → 180 need O3/NO2 → Fetch 8 grid points → Store supplements
12:00 PM → Check 188 stations → 180 need O3/NO2 → Fetch 8 grid points → Store supplements
...
```

**Result**:
- WAQI: 3 readings per hour (fast-changing pollutants)
- Google: 1 reading per hour (slow-changing gaseous pollutants)

## API Cost Calculation (Dual Cron Setup)

### WAQI Collection (Every 20 minutes)
- WAQI API calls: 188 stations × 72 times/day = **Free** ✅
- WAQI has unlimited free tier

### Google Collection (Every 60 minutes)
- Collections per day: 24
- Grid points per collection: 8 (avg, with 180/188 stations needing supplements)
- Google API calls per day: 24 × 8 = **192 calls/day**
- Google API calls per month: 192 × 30 = **5,760 calls/month** ✅

**Status**: **Well under 10K free tier!** (42% safety margin)

### Why This Works

**Separate Frequencies**:
- Fast pollutants (PM2.5, PM10): Every 20 min (3 readings/hour)
- Slow pollutants (O3, NO2): Every 60 min (1 reading/hour)

**Cost Comparison**:
- **Old approach** (combined, 20 min): 8,640-19,440 calls/month ⚠️
- **New approach** (separate, 20+60 min): **5,760 calls/month** ✅
- **Savings**: 33-70% reduction

**Data Quality**:
- 3-hour PM2.5 average: 9 readings (excellent)
- 3-hour O3/NO2 average: 3 readings (good, sufficient for slow-changing gases)

## Client-Side Implementation

### What Client Does

```javascript
// js/app.js

async loadData() {
  // Simply fetch from WAQI API (which proxies to our server)
  const stations = await fetchAirQualityData(false);

  // Data already includes Google supplements from server!
  // No need to call Google API from client

  this.stations = stations;
  this.updateDisplay();
}
```

### AQHI Calculation

```javascript
// Client calculates AQHI using Supabase 3-hour averages

async calculateAQHI() {
  // Fetches 3-hour averages from Supabase
  // These averages include Google-supplemented O3/NO2
  this.stationsWithAQHI = await enhanceStationsWithAQHI(this.stations);

  // AQHI now accurate because all pollutants present!
}
```

## Database Structure

### air_quality_readings Table

**WAQI readings** (every 20 minutes):
```sql
INSERT INTO air_quality_readings (
  station_uid,
  timestamp,
  pm25,    -- From WAQI
  pm10,    -- From WAQI
  so2,     -- From WAQI (if available)
  co,      -- From WAQI (if available)
  o3,      -- From WAQI (if available, usually NULL)
  no2,     -- From WAQI (if available, usually NULL)
  data_source -- 'WAQI'
) VALUES (...);
```

**Google supplement readings** (every 60 minutes):
```sql
INSERT INTO air_quality_readings (
  station_uid,
  timestamp,
  o3,      -- From Google (supplementing WAQI)
  no2,     -- From Google (supplementing WAQI)
  data_source -- 'GOOGLE_SUPPLEMENT'
) VALUES (...);
```

Note: Google supplements are stored as separate readings, not merged with WAQI readings.

### 3-Hour Averages View

```sql
-- Automatically calculated by Supabase
SELECT
  station_uid,
  AVG(pm25) as avg_pm25,
  AVG(o3) as avg_o3,      -- Includes Google data!
  AVG(no2) as avg_no2,    -- Includes Google data!
  COUNT(*) as reading_count
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid;
```

## Configuration

### Set Collection Intervals

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/collect-data",
      "schedule": "*/20 * * * *"  // Every 20 minutes (WAQI)
    },
    {
      "path": "/api/collect-google-supplements",
      "schedule": "0 * * * *"  // Every 60 minutes (Google)
    }
  ]
}
```

Or use external cron service (cron-job.org):
```
Job 1: */20 * * * * → https://your-app.vercel.app/api/collect-data
Job 2: 0 * * * *   → https://your-app.vercel.app/api/collect-google-supplements
```

### Add Google API Key

In Vercel environment variables:
```
GOOGLE_AIR_QUALITY_API_KEY=YOUR_GOOGLE_AIR_QUALITY_API_KEY_HERE
```

## Monitoring

### Check Collection Logs

In Vercel Function Logs or cron-job.org logs:

```
2025-10-11 10:00:00 - 🔄 Starting data collection...
2025-10-11 10:00:01 - 📊 Loaded 188 stations from WAQI
2025-10-11 10:00:02 - 🔄 Checking for missing O3/NO2 data...
2025-10-11 10:00:02 - 📊 Found X/188 stations needing O3/NO2 supplement
2025-10-11 10:00:02 - 🎯 Y unique grid points needed for X stations
2025-10-11 10:00:03 - 🌐 Fetching Google data for grid point 13.5,100.3...
2025-10-11 10:00:04 - ✅ Got Google data: O3=14.56, NO2=32.52
2025-10-11 10:00:05 - ✅ Supplemented N pollutant values using Google API
2025-10-11 10:00:05 - 💰 Total Google API calls: Y
2025-10-11 10:00:06 - ✅ Database storage successful
```

**Note**: X, Y, and N are actual counts that will be logged when the function runs. Bangkok has 188 WAQI stations stored in Supabase.

### Check Database

```sql
-- Check recent collections
SELECT
  COUNT(*) as total_readings,
  MAX(timestamp) as latest,
  MIN(timestamp) as oldest
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours';

-- Should show ~27 readings per station for 3 hours
-- (9 collections × 3 if using 20-min intervals)

-- Check completeness
SELECT
  station_uid,
  COUNT(CASE WHEN o3 IS NOT NULL THEN 1 END) as o3_count,
  COUNT(CASE WHEN no2 IS NOT NULL THEN 1 END) as no2_count
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid;
```

## Testing

### Manual Trigger

```bash
# Trigger collection manually
curl https://your-app.vercel.app/api/collect-data

# Check response
{
  "success": true,
  "stored": 188,
  "detailedStations": 188,
  "timestamp": "2025-10-11T10:00:00Z",
  "message": "Successfully fetched 188 stations and stored to database"
}
```

### Check Client

```bash
npm run dev
```

Client should show:
```console
📊 Loaded 188 stations (includes Google O3/NO2 supplements from server)
```

No Google API calls from client!

## Cost Summary

### Current Setup (10-min intervals)
- Collections/day: 144
- Google calls/month: **17,280** ❌ Exceeds 10K

### Recommended Setup (20-min intervals)
- Collections/day: 72
- Google calls/month: **8,640** ✅ Under 10K
- Readings per 3 hours: 9 (excellent quality)

### Conservative Setup (30-min intervals)
- Collections/day: 48
- Google calls/month: **5,760** ✅ Well under 10K
- Readings per 3 hours: 6 (good quality)

## Benefits of Server-Side Approach

✅ **Predictable Costs**: Fixed API usage regardless of users
✅ **3-Hour Averages**: Automatically build over time
✅ **All Users Benefit**: Everyone gets same complete data
✅ **No Client API Keys**: Secure - keys only on server
✅ **Reliable**: Cron ensures consistent collection
✅ **Fast Client**: No API calls needed - reads from DB
✅ **Scalable**: 1000 users = same API cost as 1 user

## Summary

The correct architecture:
1. **Server collects** data every 20 minutes via cron
2. **Google supplements** missing O3/NO2 (3-5 API calls)
3. **Stores in Supabase** with 3-hour averages
4. **Client reads** from Supabase (no Google API calls)
5. **AQHI calculated** using complete 3-hour average data

**Total monthly cost: $0** (stays within 10K free tier with 20-min intervals)

This is the professional, scalable approach! 🎯
