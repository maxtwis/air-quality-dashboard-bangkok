# Google Air Quality API Integration (Hybrid Mode)

This document explains how to set up and use the Google Air Quality API integration for the Bangkok Air Quality Dashboard.

## Overview

The dashboard uses a **hybrid data approach**:
- **WAQI (World Air Quality Index)** - Primary source, 188 real monitoring stations in Bangkok
- **Google Air Quality API** - Supplements WAQI data ONLY for missing O3 and NO2 pollutants

**Key Architecture**: All data collection happens **server-side** via cron jobs. The client reads from Supabase only.

## Setup Instructions

### 1. Get Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Air Quality API**
4. Create credentials (API Key)
5. Copy your API key

### 2. Configure Environment Variables

#### For Local Development

Add to `.env.local`:
```
GOOGLE_AIR_QUALITY_API_KEY=your_api_key_here
```

#### For Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add: `GOOGLE_AIR_QUALITY_API_KEY` = `your_api_key_here`
4. Redeploy your application

### 3. API Endpoint Configuration

The integration uses a proxy endpoint at `/api/google-air-quality-proxy.js` to keep the API key secure.

## How It Works

### Server-Side Hybrid Collection

**Important**: This is NOT a separate data source. Google supplements WAQI data server-side.

**Architecture**:
1. **Cron job** runs every 20 minutes on the server
2. Fetches **188 WAQI stations** from Bangkok
3. Identifies stations **missing O3 or NO2** data
4. Maps those stations to **nearest 3x3 grid points**
5. Fetches Google data for **3-5 unique grid points** (smart caching)
6. **Merges** O3/NO2 into WAQI station data
7. Stores complete data in **Supabase**

**Client-side**: Simply reads complete data from Supabase. No Google API calls from browser.

### Smart Caching

Multiple WAQI stations are mapped to the same nearest grid point, dramatically reducing API calls:
- 188 WAQI stations in Bangkok
- Typically 60-100+ stations missing O3/NO2
- But only need **3-5 grid points** due to geographic clustering
- **Result**: 3-5 Google API calls per collection cycle

### Grid System

3x3 grid across Bangkok (13.5-14.0°N, 100.3-100.9°E):
```
Grid Point 1: (13.5, 100.3)  Grid Point 2: (13.5, 100.6)  Grid Point 3: (13.5, 100.9)
Grid Point 4: (13.75, 100.3) Grid Point 5: (13.75, 100.6) Grid Point 6: (13.75, 100.9)
Grid Point 7: (14.0, 100.3)  Grid Point 8: (14.0, 100.6)  Grid Point 9: (14.0, 100.9)
```

Each WAQI station maps to its nearest grid point for O3/NO2 supplementation.

## Using the Feature

### Transparent Operation

The Google API integration works **transparently in the background**. Users don't need to do anything:

1. **All stations show complete data** - WAQI + Google supplements
2. **No toggle needed** - It's all one unified dataset
3. **AQHI calculations work** - Now have O3/NO2 for accurate health index
4. **3-hour averages build** - Automatically in Supabase

### Checking Data Completeness

You can verify the hybrid data is working:

1. Open browser console (F12)
2. Look for stations that previously lacked O3/NO2
3. Check if they now have values
4. Look for log: "✅ Supplemented X pollutant values using Google API"

## API Costs

Google Air Quality API pricing (as of 2025):
- **Free Tier**: 10,000 requests/month
- Additional requests: Check [Google Cloud Pricing](https://cloud.google.com/maps-platform/pricing)

### Current Configuration (Server-Side Collection)

**Collection Interval**: Every 20 minutes
**Google Calls per Collection**: 3-5 (smart caching to nearest grid points)
**WAQI Stations**: 188 (free, unlimited)

**Monthly Usage**:
- Collections per day: 72 (every 20 minutes)
- Collections per month: 2,160
- Google API calls: 2,160 × 4 (avg) = **8,640 calls/month** ✅
- **Under 10K free tier!**

### Why This is Cost-Effective

1. **Smart Caching**: 60-100+ stations needing O3/NO2 → Only 3-5 API calls
2. **20-Minute Intervals**: Balances data freshness with cost
3. **Server-Side**: No duplicate calls from multiple users
4. **Supplement Only**: Only calls Google for missing pollutants, not full dataset

**Cost Savings**:
- **Naive approach** (188 stations × 72 collections/day): ~408,000 calls/month 💸
- **Grid approach** (9 points × 72 collections/day): ~19,440 calls/month ⚠️
- **Smart caching** (4 points × 72 collections/day): **8,640 calls/month** ✅
- **Savings**: 98% reduction from naive approach!

## Technical Implementation

### Files Modified/Created

**Primary Implementation** (Server-Side):
1. **api/collect-data.js** - Added `supplementWithGoogleData()` function
2. **api/google-air-quality-proxy.js** - Proxy endpoint for secure API key handling

**Database**:
3. **supabase/add-data-source-column.sql** - Schema update for tracking data sources

**Client-Side** (Simplified):
4. **js/app.js** - Reads hybrid data from Supabase
5. **js/aqhi-supabase.js** - AQHI calculations using complete pollutant data

**Configuration**:
6. **vercel.json** - Cron job configuration (20-minute intervals)
7. **.env.local** / Vercel env vars - Google API key storage

### API Response Format

```javascript
{
  "indexes": [
    {
      "code": "uaqi",
      "displayName": "Universal AQI",
      "aqi": 65,
      "aqiDisplay": "65",
      "color": {...},
      "category": "Moderate"
    }
  ],
  "pollutants": [
    {
      "code": "pm25",
      "displayName": "PM2.5",
      "fullName": "Fine particulate matter",
      "concentration": {
        "value": 18.5,
        "units": "PARTS_PER_BILLION"
      }
    }
  ],
  "healthRecommendations": {...},
  "dominantPollutant": "pm25"
}
```

## Troubleshooting

### Common Issues

1. **"API key not configured" error**
   - Ensure `GOOGLE_AIR_QUALITY_API_KEY` is set in environment variables
   - Redeploy after adding the variable

2. **"Failed to fetch" errors**
   - Check API key is valid
   - Verify Air Quality API is enabled in Google Cloud Console
   - Check billing is enabled on your Google Cloud project

3. **Empty or missing data**
   - Google API may not have data for all grid points
   - Try increasing grid density or adjusting coordinates

4. **Rate limiting**
   - Reduce grid density (modify `generateBangkokGrid()` in `js/google-api.js`)
   - Increase refresh interval in `js/config.js`

## Benefits of Hybrid Approach

### Why Hybrid is Better than Separate Sources

✅ **Best of Both Worlds**:
- WAQI: Real station locations and PM2.5 data (primary pollutant)
- Google: Fills O3/NO2 gaps for complete AQHI calculations

✅ **Cost Effective**:
- Only 8,640 Google calls/month (vs 408,000 naive approach)
- Stays within free tier
- WAQI remains free and unlimited

✅ **Scientifically Accurate**:
- Complete pollutant data for Health Canada's AQHI formula
- 3-hour moving averages for all pollutants
- No stations skipped due to missing data

✅ **Transparent to Users**:
- Single unified dataset
- No confusion about which source to use
- All 188 stations show complete information

## Next Steps

1. **Add Google API key** to Vercel environment variables
2. **Configure cron job** for 20-minute intervals
3. **Run SQL migration** (add-data-source-column.sql) in Supabase
4. **Monitor logs** to verify Google supplementation is working
5. **Track API usage** in Google Cloud Console (should stay under 10K/month)

## Support

For issues or questions:
- Google API: [Google Cloud Support](https://cloud.google.com/support)
- This integration: Open an issue in the repository
