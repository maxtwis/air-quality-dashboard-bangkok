# OpenWeather Integration Setup Guide

## Overview

This guide covers the complete setup and usage of the OpenWeather API integration for enhanced AQHI calculations. The system intelligently collects O3 and NO2 data from OpenWeather API to supplement stations that lack these critical pollutants.

## 🎯 Key Features

- **Smart Data Collection**: Only fetches data for stations missing O3/NO2
- **API Rate Limiting**: Respects 1000 calls/day limit with intelligent optimization
- **3-Hour Averages**: Builds proper moving averages in Supabase database
- **Data Quality Tracking**: Clear indicators showing data sources and quality
- **Graceful Fallbacks**: System continues working if OpenWeather API fails

## 📋 Prerequisites

1. **OpenWeather API Key**: Get a free key at https://openweathermap.org/api
2. **Supabase Database**: Running with proper schema (see setup below)
3. **Environment Variables**: Configured for both local and production

## 🔧 Setup Instructions

### Step 1: Database Schema Setup

Run the following SQL in your Supabase SQL Editor:

```sql
-- Execute this file in Supabase SQL Editor
\i supabase/openweather-enhancement.sql
```

This creates:

- `openweather_readings` table for storing OpenWeather data
- `openweather_api_usage` table for tracking API usage
- Database functions for enhanced 3-hour average calculations
- Proper indexes and RLS policies

### Step 2: Environment Variables

#### Local Development (`.env.local`)

```env
OPENWEATHER_API_KEY=your_openweather_api_key_here
```

#### Vercel Production

```bash
# Set in Vercel dashboard or CLI
vercel env add OPENWEATHER_API_KEY
```

#### Direct Configuration

Update `js/config.js`:

```javascript
export const OPENWEATHER_CONFIG = {
  API_KEY: "your_api_key_here",
  API_URL: "https://api.openweathermap.org/data/2.5/air_pollution",
  CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
  MAX_REQUESTS_PER_DAY: 1000,
};
```

### Step 3: Enable Enhanced Data Collection

Two options for enabling collection:

#### Option A: Replace Existing Collection (Recommended)

Replace `api/collect-data.js` with `api/collect-data-enhanced.js`:

```bash
mv api/collect-data.js api/collect-data-original.js
mv api/collect-data-enhanced.js api/collect-data.js
```

#### Option B: Add New Endpoint

Keep both files and use:

- `/api/collect-data` - Original WAQI only
- `/api/collect-data-enhanced` - Enhanced with OpenWeather

## 🚀 Usage Guide

### Automated Collection (Production)

The enhanced collection runs automatically via cron jobs:

1. **Vercel Cron** (if configured):

   ```json
   {
     "crons": [
       {
         "path": "/api/collect-data",
         "schedule": "0 */10 * * * *"
       }
     ]
   }
   ```

2. **External Cron Services**:
   - URL: `https://your-domain.vercel.app/api/collect-data`
   - Frequency: Every 10 minutes
   - Method: GET or POST

### Manual Testing (Development)

#### Browser Console Commands

After loading the dashboard:

```javascript
// Test OpenWeather API key
await window.openWeatherClient.testApiKey();

// Check API usage
const usage = await window.openWeatherClient.checkApiUsage();
console.log("API Usage:", usage);

// Get stations needing data
const stations = window.dashboard.stations; // Assuming you have stations loaded
const result = await window.collectOpenWeatherData(stations);
console.log("Collection Result:", result);

// Get collection statistics
const stats = await window.getDataCollectionStats();
console.log("Collection Stats:", stats);

// Check system health
const health = await window.getSystemHealth();
console.log("System Health:", health);
```

#### Direct API Testing

```bash
# Test the enhanced collection endpoint
curl -X POST https://your-domain.vercel.app/api/collect-data-enhanced

# Check response for success/errors
```

## 📊 Monitoring & Analytics

### Data Quality Indicators

The system provides several data quality levels:

- 🎯 **Excellent**: Full 3+ hour averages (15+ readings)
- ✅ **Good**: 2+ hour averages (10+ readings)
- ⏳ **Fair**: 1+ hour averages (5+ readings)
- 🌐 **Enhanced**: Station data + OpenWeather supplementation
- 🔄 **Limited**: Building data (<1 hour)
- 📊 **Estimated**: Fallback estimation

### API Usage Monitoring

```javascript
// Check current usage
const usage = await window.openWeatherClient.checkApiUsage();
console.log(`Used: ${usage.used}/${usage.limit} (${usage.percentageUsed}%)`);

// Get collection statistics
const stats = await window.enhancedDataManager.getCollectionStatistics();
console.log("Today collected:", stats.openWeather.todayCollected);
```

### Database Queries for Monitoring

```sql
-- Check OpenWeather data collection today
SELECT COUNT(*) as today_collected,
       AVG(CASE WHEN o3 IS NOT NULL THEN 1 ELSE 0 END) as o3_coverage,
       AVG(CASE WHEN no2 IS NOT NULL THEN 1 ELSE 0 END) as no2_coverage
FROM openweather_readings
WHERE timestamp >= CURRENT_DATE;

-- Check API usage
SELECT * FROM openweather_api_usage
WHERE date = CURRENT_DATE;

-- Check enhanced stations
SELECT station_uid, data_sources, reading_count
FROM air_quality_readings
WHERE data_source_flags = 'mixed'
  AND timestamp >= NOW() - INTERVAL '3 hours';
```

## 🔍 Troubleshooting

### Common Issues

#### 1. API Key Invalid (401 Error)

```
Error: OpenWeather API error: 401 - Unauthorized
```

**Solutions:**

- Verify API key is correct in config
- Check if key is activated (new keys take 1-2 hours)
- Ensure account has Air Pollution API access
- Test key manually: `https://api.openweathermap.org/data/2.5/air_pollution?lat=13.7563&lon=100.5018&appid=YOUR_KEY`

#### 2. Daily Limit Reached

```
Warning: Daily OpenWeather API limit reached
```

**Solutions:**

- Check usage: `await window.openWeatherClient.checkApiUsage()`
- Wait for daily reset (midnight UTC)
- Optimize collection frequency
- Consider upgrading OpenWeather plan

#### 3. Database Functions Not Found

```
Error: function calculate_enhanced_3h_averages does not exist
```

**Solutions:**

- Run the enhancement SQL: `supabase/openweather-enhancement.sql`
- Check Supabase SQL editor for errors
- Verify database permissions

#### 4. No Enhanced Data Showing

```
No stations show "Enhanced" quality level
```

**Debugging Steps:**

```javascript
// Check if OpenWeather data exists
const openWeatherStats = await window.openWeatherCollector.getCollectionStats();
console.log("OpenWeather data points:", openWeatherStats.totalStored);

// Check if stations need data
const stations = window.dashboard.stations;
const needingData =
  await window.openWeatherCollector.identifyStationsNeedingData(stations);
console.log("Stations needing data:", needingData.length);

// Force collection
const result = await window.enhancedDataManager.forceDataCollection(stations);
console.log("Force collection result:", result);
```

### Performance Optimization

#### 1. Optimize API Usage

- Collection frequency: 10-15 minutes
- Batch size: 10 stations per batch
- Daily limit buffer: 950 calls (leave 50 buffer)

#### 2. Database Performance

- Regular cleanup of old data (automated)
- Index optimization (included in schema)
- Connection pooling (Supabase handles this)

#### 3. Caching Strategy

- Client-side: 10-minute cache
- Database: Built-in 3-hour averages
- API responses: In-memory caching

## 📈 Expected Results

### Before Integration

- Stations with only PM2.5: Limited AQHI accuracy
- Missing O3/NO2 data: Estimated values only
- Data quality: Mixed, many "Limited" or "Estimated"

### After Integration

- Enhanced coverage: Real O3/NO2 data for most stations
- Improved accuracy: Scientific AQHI calculations
- Better quality indicators: More "Enhanced" and fewer "Estimated"
- User transparency: Clear data source labeling

### Typical Improvement Metrics

- **Data Coverage**: 60-80% of stations get enhanced data
- **API Efficiency**: ~50-100 calls per day (well under limit)
- **AQHI Accuracy**: Significant improvement for PM2.5-only stations
- **User Experience**: More reliable health recommendations

## 🔄 Maintenance

### Regular Tasks

#### Weekly

- Monitor API usage trends
- Check collection statistics
- Review data quality distribution

#### Monthly

- Clean up old test data
- Review API costs (if upgraded plan)
- Update documentation if needed

#### Quarterly

- Evaluate collection efficiency
- Consider API usage optimization
- Update to latest OpenWeather API features

### Database Maintenance

Automatic cleanup is included, but you can manually run:

```sql
-- Cleanup old OpenWeather data (keeps 7 days)
SELECT cleanup_old_openweather_data();

-- Check database size
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename IN ('openweather_readings', 'openweather_api_usage', 'air_quality_readings')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🔗 Related Files

- `supabase/openweather-enhancement.sql` - Database schema
- `js/openweather-api.js` - OpenWeather API client
- `js/openweather-collector.js` - Smart collection service
- `js/enhanced-data-manager.js` - Data management interface
- `js/aqhi-supabase.js` - Enhanced AQHI calculations
- `api/collect-data-enhanced.js` - Server-side collection
- `O3-NO2-Enhancement-Plan.md` - Original implementation plan

## 🆘 Support

If you encounter issues:

1. **Check Browser Console** for detailed error messages
2. **Test API Key** using the browser console commands
3. **Verify Database Setup** by running the SQL schema
4. **Monitor API Usage** to ensure you're within limits
5. **Review Logs** in Vercel dashboard (for production issues)

The system is designed to be resilient - if OpenWeather integration fails, the dashboard continues working with standard AQHI calculations.
