# Historical Chart Data Collection Setup

## Issue: Charts Not Loading for WAQI/AQI Stations

If you're seeing "กำลังรวบรวมข้อมูล" (Collecting Data) messages when clicking on WAQI stations, it means historical data hasn't been collected yet.

## Why Charts Need Historical Data

The 24-hour and 7-day charts require:
- **WAQI Stations (AQI)**: Historical data stored in Supabase database
- **Google Stations (AQHI)**: Historical data automatically collected every 10 minutes

## Solution: Set Up Data Collection

### Method 1: Manual Data Collection (Quick Test)

Run the collection script manually to start gathering data:

```bash
# Collect WAQI data
node api/collect-data.js

# Collect Google AQHI data
node api-google-aqhi.js
```

This will:
- Fetch current air quality data from WAQI API
- Store it in Supabase database
- Start building historical records

**Note**: You need to run this regularly (every 10 minutes) to build up historical data.

### Method 2: Automated Collection (Recommended)

#### Option A: Using cron-job.org (Free External Service)

1. Go to [cron-job.org](https://cron-job.org)
2. Create a free account
3. Add a new cron job:
   - **URL**: `https://your-domain.com/api/collect-google-aqhi`
   - **Schedule**: Every 10 minutes
   - **Method**: GET

#### Option B: Using Node.js Cron (Server-Side)

Add to `server.js`:

```javascript
import cron from 'node-cron';
import { collectGoogleAQHI } from './api-google-aqhi.js';

// Run every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('Running scheduled data collection...');
  try {
    await collectGoogleAQHI();
    console.log('Data collection completed');
  } catch (error) {
    console.error('Data collection failed:', error);
  }
});
```

Then install the package:
```bash
npm install node-cron
```

#### Option C: Using System Cron (Linux/Mac)

Add to your crontab:
```bash
# Edit crontab
crontab -e

# Add this line to run every 10 minutes
*/10 * * * * cd /path/to/project && node api/collect-data.js >> /var/log/air-quality-cron.log 2>&1
```

### Method 3: Vercel Cron Jobs (For Production)

If deploying to Vercel, create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/collect-google-aqhi",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

## How Long Until Charts Work?

- **24-hour chart**: Needs ~24 hours of data collection
- **7-day chart**: Needs ~7 days of data collection
- **Data points**: Collected every 10 minutes = 6 points/hour

### Data Collection Timeline

| Time Elapsed | Data Points | Charts Available |
|--------------|-------------|------------------|
| 1 hour       | 6 points    | Partial chart    |
| 3 hours      | 18 points   | Better chart     |
| 24 hours     | 144 points  | 24-hour complete |
| 7 days       | 1,008 points| 7-day complete   |

## Checking Data Collection Status

### Via Browser Console

Open browser DevTools Console and check:

```javascript
// Check if data collection is working
await fetch('/api/collect-google-aqhi')
  .then(r => r.json())
  .then(data => console.log('Collection status:', data));
```

### Via Database Query

Check Supabase dashboard:

```sql
-- Count total records
SELECT COUNT(*) FROM air_quality_data;

-- Check recent data
SELECT station_id, timestamp, aqi
FROM air_quality_data
ORDER BY timestamp DESC
LIMIT 10;

-- Check data coverage per station
SELECT station_id, COUNT(*) as records,
       MIN(timestamp) as first_record,
       MAX(timestamp) as last_record
FROM air_quality_data
GROUP BY station_id;
```

## Troubleshooting

### Charts Still Not Loading?

1. **Check Supabase Connection**
   ```bash
   node test-data-collection.js
   ```

2. **Verify Environment Variables**
   ```bash
   # Check .env.local
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_key
   WAQI_API_TOKEN=your_waqi_token
   GOOGLE_API_KEY=your_google_key
   ```

3. **Check Database Schema**
   - Ensure `air_quality_data` table exists
   - Verify columns match expected schema
   - Check RLS policies allow data insertion

4. **Review Server Logs**
   ```bash
   # Check for errors
   npm run dev
   # Look for database connection or API errors
   ```

### Common Errors

**"Supabase not configured"**
- Missing environment variables
- Check `.env.local` file exists
- Verify Supabase credentials are correct

**"No data available"**
- Collection hasn't run yet
- Wait 10-30 minutes after starting collection
- Check cron job is actually running

**"Database connection failed"**
- Supabase project may be paused (free tier)
- Check Supabase dashboard for service status
- Verify network connectivity

## Data Retention Policy

The system automatically:
- **Keeps**: Last 7 days of data
- **Deletes**: Data older than 7 days
- **Storage**: ~10,000 records per station (7 days × 144 records/day)

## Cost Considerations

### Supabase Free Tier
- **Database**: 500 MB (sufficient for ~1 year of data)
- **API Requests**: 500,000/month (plenty for this app)
- **Bandwidth**: 5 GB/month

### WAQI API Free Tier
- **Requests**: 1,000/day
- **Rate Limit**: ~1 request/minute
- **Cost**: Free

### Google Air Quality API
- **Requests**: Varies by usage
- **Cost**: Pay as you go (first 2M requests free on GCP)

## Current Status

Check the collection status:

```bash
# Run test script
node test-data-collection.js

# Should output:
# ✓ Supabase connected
# ✓ WAQI data collected: 50 stations
# ✓ Google data collected: 15 locations
# ✓ Historical records: 1,234 points
```

## Next Steps

1. Choose a data collection method (Manual, Cron, or External)
2. Set up automated collection
3. Wait 24 hours for initial data
4. Test charts on dashboard
5. Monitor data collection logs

## Support

If charts still don't load after 24 hours:
1. Check server logs for errors
2. Verify Supabase data exists
3. Test API endpoints manually
4. Review browser console for errors

---

**Last Updated**: November 2025
**Dashboard**: Bangkok Air Quality Monitor
