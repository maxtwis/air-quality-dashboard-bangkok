# Hybrid Mode: WAQI + Google API Integration

## Overview

**Hybrid Mode** combines the best of both data sources:

- **WAQI**: Primary source for all pollutants (PM2.5, PM10, etc.)
- **Google API**: Supplements only missing O₃ and NO₂ data

This dramatically reduces Google API costs while ensuring complete data for accurate AQHI calculations.

## Why Hybrid Mode?

### Problem

Many WAQI stations in Bangkok don't report O₃ (Ozone) and NO₂ (Nitrogen Dioxide), which are **essential** for AQHI calculations.

### Solution

- Use WAQI as primary (free, comprehensive network)
- Use Google API only to fill gaps in O₃/NO₂
- Result: Complete data with minimal API costs

### Cost Comparison

| Mode            | API Calls     | Monthly Cost | Data Completeness |
| --------------- | ------------- | ------------ | ----------------- |
| **WAQI Only**   | 0             | Free         | ❌ Missing O₃/NO₂ |
| **Google Only** | 9 per fetch   | ~$0-10/month | ✅ Complete       |
| **Hybrid**      | 1-3 per fetch | ~$0/month    | ✅ Complete       |

**Hybrid mode uses 67-89% fewer Google API calls than full Google mode!**

## How It Works

### Step 1: Fetch WAQI Data

```javascript
const stations = await fetchAirQualityData(false);
// Returns: ~40 stations from WAQI
```

### Step 2: Analyze Missing Pollutants

```javascript
// Check each station
Station 1: Has PM2.5, PM10 ✅ | Missing O3, NO2 ❌
Station 2: Has PM2.5, PM10, O3 ✅ | Missing NO2 ❌
Station 3: Has PM2.5, PM10, O3, NO2 ✅ | Complete!
...
```

### Step 3: Fetch Google Data (Smart Caching)

Only fetch Google data for stations with missing pollutants:

```javascript
// Example: 15 stations missing O3/NO2
// But they're spread across Bangkok

Station 1 at (13.52, 100.35) → Nearest grid: (13.5, 100.3)
Station 2 at (13.54, 100.38) → Nearest grid: (13.5, 100.3) ← Same grid!
Station 3 at (13.78, 100.62) → Nearest grid: (13.75, 100.6)
...

// Result: Only 3 unique grid points needed
// 3 Google API calls instead of 15!
```

### Step 4: Merge Data

```javascript
// Station 1 after hybrid enhancement:
{
  uid: "12345",
  aqi: 55,
  iaqi: {
    pm25: { v: 18.5, _source: "waqi" },        // From WAQI
    pm10: { v: 45.2, _source: "waqi" },        // From WAQI
    o3: { v: 14.56, _source: "google" },       // From Google ✨
    no2: { v: 32.52, _source: "google" },      // From Google ✨
  },
  _hybridData: true,
  _googleSupplemented: ["o3", "no2"]
}
```

### Step 5: Calculate AQHI

Now all stations have complete data for accurate AQHI:

```javascript
AQHI = f(PM2.5, NO2, O3)  // All values present ✅
```

## Implementation

### Automatic Hybrid Mode

Hybrid mode is **enabled by default**:

```javascript
class ModernAirQualityDashboard {
  constructor() {
    this.currentDataSource = "WAQI";
    this.useHybridMode = true; // ← Hybrid mode ON by default
  }
}
```

### How Data is Fetched

In [js/app.js](js/app.js#L73-L85):

```javascript
if (this.currentDataSource === "WAQI" && this.useHybridMode) {
  // 1. Fetch WAQI data
  stations = await fetchAirQualityData(false);

  // 2. Automatically supplement with Google
  stations = await enhanceWAQIWithGooglePollutants(stations);

  // 3. Show statistics
  const stats = getHybridDataStatistics(stations);
  console.log(`Enhanced ${stats.hybridStations} stations`);
  console.log(`Google API calls: ${stats.googleApiCalls}`);
}
```

### Smart Grid Point Selection

In [js/hybrid-data.js](js/hybrid-data.js):

```javascript
function findNearestGridPoint(stationLat, stationLon) {
  // Uses distance formula to find closest grid point
  // Minimizes API calls through caching
}
```

## Real-World Example

### Scenario: 40 WAQI Stations in Bangkok

**Station Analysis**:

```
Total stations: 40
✅ Complete data (PM2.5, PM10, O3, NO2): 12 stations
❌ Missing O3 only: 8 stations
❌ Missing NO2 only: 5 stations
❌ Missing both O3 and NO2: 15 stations

Stations needing Google data: 28
```

**Grid Point Mapping**:

```
28 stations map to these nearest grid points:
- Grid (13.5, 100.3): 6 stations
- Grid (13.5, 100.6): 5 stations
- Grid (13.75, 100.6): 8 stations
- Grid (14.0, 100.6): 9 stations

Unique grid points: 4
Google API calls: 4 ✅
```

**Cost Comparison**:
| Approach | API Calls | Result |
|----------|-----------|--------|
| Google for all | 40 calls | Expensive |
| Google grid (9 points) | 9 calls | Medium |
| **Hybrid** | **4 calls** | **Optimal!** |

**Savings**: 90% fewer API calls vs individual station lookups!

## API Cost Analysis

### Monthly Usage Estimates

**Typical Bangkok Scenario**:

- 40 WAQI stations total
- ~25-30 need O₃/NO₂ supplement
- Maps to ~3-5 unique grid points

**Per Fetch**:

- WAQI calls: 0 (free)
- Google calls: 3-5 (hybrid)

**Monthly** (5 manual fetches/day):

- Daily: 15-25 calls
- Monthly: 450-750 calls
- **Well within 10K free tier!** ✅

### Comparison Table

| Mode            | Calls/Fetch | Calls/Month | Free Tier | Cost   |
| --------------- | ----------- | ----------- | --------- | ------ |
| WAQI Only       | 0           | 0           | N/A       | Free   |
| Hybrid          | 3-5         | 450-750     | ✅ Yes    | **$0** |
| Google Grid (9) | 9           | 1,350       | ✅ Yes    | $0     |
| Google Full     | 40          | 6,000       | ✅ Yes    | $0     |

All approaches stay within free tier, but **Hybrid uses the least API calls!**

## Data Quality Indicators

### Station Markers Show Data Sources

```javascript
// In station popup:
"📊 Data Sources:";
"✓ PM2.5: WAQI";
"✓ PM10: WAQI";
"✓ O3: Google (supplemented)"; // ← Google-sourced
"✓ NO2: Google (supplemented)"; // ← Google-sourced
```

### Console Output

```console
🔄 Using hybrid mode: WAQI + Google supplemental data...
📊 Loaded 40 stations from WAQI
   ♻️ Using cached Google data for station 12345
   🌐 Fetching Google data for station 67890 (o3, no2)
   ✓ Added O3 from Google: 14.56
   ✓ Added NO2 from Google: 32.52
✅ Enhanced 28 stations using 4 Google API calls
   💰 Cost savings: 24 API calls saved by caching
🔬 Hybrid Stats: 28/40 stations enhanced
   O3 supplemented: 23, NO2 supplemented: 20
   Google API calls used: 4
```

## Supabase Storage

### Hybrid Data Storage

Both WAQI and Google supplement data are stored:

```sql
-- WAQI station readings
INSERT INTO air_quality_readings (
  station_uid, data_source, pm25, pm10, o3, no2
) VALUES (
  '12345', 'WAQI', 18.5, 45.2, NULL, NULL
);

-- Google supplement readings (stored separately)
INSERT INTO air_quality_readings (
  station_uid, data_source, pm25, pm10, o3, no2
) VALUES (
  'google-supplement-13.5-100.3', 'GOOGLE', NULL, NULL, 14.56, 32.52
);
```

### 3-Hour Averages

Hybrid mode still builds 3-hour averages for AQHI:

```sql
SELECT * FROM current_3h_averages
WHERE station_uid = '12345';

-- Returns averages using:
-- PM2.5: From WAQI readings (primary)
-- O3: From Google supplement readings (if available)
-- NO2: From Google supplement readings (if available)
```

## Configuration

### Enable/Disable Hybrid Mode

```javascript
// In js/app.js constructor
this.useHybridMode = true; // ← Set to false to disable

// Or toggle at runtime
window.dashboard.useHybridMode = false;
window.dashboard.loadData(); // Reload without hybrid
```

### Customize Which Pollutants to Supplement

In [js/hybrid-data.js](js/hybrid-data.js):

```javascript
function analyzeStationsForMissingPollutants(waqiStations) {
  // Currently checks: O3, NO2
  // Add more if needed:

  // Check for SO2
  if (!station.iaqi?.so2?.v) {
    missingPollutants.push("so2");
  }

  // Check for CO
  if (!station.iaqi?.co?.v) {
    missingPollutants.push("co");
  }
}
```

## Monitoring

### Check Hybrid Statistics

In browser console:

```javascript
// Get current hybrid stats
const stats = getHybridDataStatistics(window.dashboard.stations);
console.log(stats);

// Output:
{
  total: 40,
  hybridStations: 28,
  o3Supplemented: 23,
  no2Supplemented: 20,
  fullyWAQI: 12,
  googleApiCalls: 4
}
```

### Check Individual Station

```javascript
const station = window.dashboard.stations[0];
console.log(station._hybridData); // true if hybrid
console.log(station._googleSupplemented); // ['o3', 'no2']
console.log(station.iaqi.o3._source); // 'google'
```

### Database Queries

```sql
-- Count hybrid-enhanced readings
SELECT COUNT(*) as google_supplements
FROM air_quality_readings
WHERE station_uid LIKE 'google-supplement%';

-- View recent Google supplements
SELECT station_uid, timestamp, o3, no2
FROM air_quality_readings
WHERE station_uid LIKE 'google-supplement%'
ORDER BY timestamp DESC
LIMIT 10;
```

## Benefits

### ✅ Cost Efficiency

- 67-89% fewer Google API calls vs full Google mode
- ~450-750 calls/month (vs 1,350 for Google grid)
- Stays well within 10K free tier

### ✅ Data Completeness

- All stations have O₃ and NO₂ for AQHI
- No missing pollutant gaps
- Accurate health risk calculations

### ✅ Smart Caching

- Multiple stations share same grid point
- Automatic deduplication
- Minimal redundant API calls

### ✅ Transparency

- Each pollutant tagged with source
- Console shows exactly what was supplemented
- Full visibility into hybrid process

### ✅ Performance

- Parallel API calls (non-blocking)
- Cached grid points
- No UI lag

## Troubleshooting

### Issue: "No hybrid enhancement needed"

**Symptom**: Console shows "All WAQI stations have complete data"
**Explanation**: Great! All stations already have O₃/NO₂
**Action**: No Google API calls needed - perfect scenario!

### Issue: High Google API usage

**Symptom**: More API calls than expected
**Check**: How many unique grid points are being used?

```javascript
const stats = getHybridDataStatistics(window.dashboard.stations);
console.log(`API calls: ${stats.googleApiCalls}`);
// Should be 1-5 typically
```

**If high**: Stations may be very spread out. This is normal.

### Issue: Missing O₃/NO₂ in AQHI

**Symptom**: AQHI shows "Limited" quality
**Check**: Are stations actually getting Google data?

```javascript
const station = window.dashboard.stations[0];
console.log(station.iaqi.o3); // Should have ._source = 'google'
```

**Fix**: Ensure Google API key is configured and valid.

## Advanced Usage

### Disable Hybrid for Specific Fetch

```javascript
// Temporarily disable hybrid
const savedMode = window.dashboard.useHybridMode;
window.dashboard.useHybridMode = false;
await window.dashboard.loadData();
window.dashboard.useHybridMode = savedMode;
```

### Get Data Source Breakdown

```javascript
import { getStationDataSources } from "./hybrid-data.js";

const station = window.dashboard.stations[0];
const sources = getStationDataSources(station);

console.log(sources);
// {
//   sources: { pm25: 'waqi', o3: 'google', ... },
//   googleCount: 2,
//   waqiCount: 4,
//   isHybrid: true
// }
```

## Summary

**Hybrid Mode** is the optimal approach for Bangkok:

✅ **Best Data Quality**: Complete O₃/NO₂ coverage
✅ **Lowest Cost**: 67-89% fewer API calls
✅ **Smart**: Automatic caching and optimization
✅ **Transparent**: Clear source attribution
✅ **Free**: Stays within 10K Google API free tier

**Default mode: ON** - Just use WAQI normally and Google supplements automatically!
