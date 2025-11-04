# Google-Only AQHI System Setup Guide

## 🎯 Overview

This system provides **Air Quality Health Index (AQHI)** for 15 community monitoring points in Bangkok using **Google Air Quality API only**. It's completely separated from the WAQI AQI system.

### Architecture

- **AQI Tab**: Uses WAQI data only (current system, no changes)
- **AQHI Tab**: Uses Google data only (new system)
- **15 Fixed Locations**: Community monitoring points from `community_point.csv`
- **Hourly Data Collection**: Runs at :00 every hour
- **3-Hour Rolling Averages**: Calculated automatically in Supabase
- **Thai AQHI Formula**: Applied to averaged data

---

## 📋 Prerequisites

1. ✅ Supabase account and project
2. ✅ Google Air Quality API key
3. ✅ Node.js installed (v18+)
4. ✅ `.env.local` file with credentials

---

## 🚀 Setup Instructions

### Step 1: Configure Environment Variables

Add to your `.env.local`:

```bash
# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Air Quality API
GOOGLE_AIR_QUALITY_API_KEY=your-google-api-key
```

### Step 2: Run Supabase Schema

Run the SQL schema in your Supabase SQL Editor:

```bash
# File: supabase/google-aqhi-system.sql
```

This will:
- Drop old AQHI tables (if any)
- Create `community_locations` table (15 monitoring points)
- Create `google_aqhi_hourly` table (hourly data storage)
- Create functions for 3-hour averaging and AQHI calculation
- Create views for easy data access

### Step 3: Test Manual Data Collection

Run the collection script manually to test:

```bash
node cron-google-aqhi.js
```

Expected output:
```
================================================================================
🕐 Starting hourly Google AQHI data collection
📅 Timestamp: 2024-01-15T08:00:00.000Z
================================================================================

📍 Fetching data for Location 1: มัสยยิดบ้านตึกดิน
   ✅ PM2.5: 45.2 μg/m³, O3: 32.1 ppb, NO2: 18.5 ppb
...
✅ Hourly collection completed successfully!
```

### Step 4: Set Up Automated Hourly Collection

#### Option A: Node-Cron (Development)

Install `node-cron`:

```bash
npm install node-cron
```

Create `cron-scheduler.js`:

```javascript
import cron from 'node-cron';
import { spawn } from 'child_process';

// Run every hour at :00 minutes
cron.schedule('0 * * * *', () => {
  console.log(`[${new Date().toISOString()}] Running hourly Google AQHI collection...`);

  const child = spawn('node', ['cron-google-aqhi.js']);

  child.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  child.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  child.on('close', (code) => {
    console.log(`Collection process exited with code ${code}`);
  });
});

console.log('🕐 Google AQHI Cron Scheduler started');
console.log('📅 Will run every hour at :00 minutes');
```

Run with PM2:

```bash
npm install -g pm2
pm2 start cron-scheduler.js --name "google-aqhi-cron"
pm2 save
pm2 startup
```

#### Option B: System Cron (Linux/Mac)

Edit crontab:

```bash
crontab -e
```

Add:

```bash
# Run Google AQHI collection every hour at :00
0 * * * * cd /path/to/project && /usr/bin/node cron-google-aqhi.js >> /var/log/google-aqhi.log 2>&1
```

#### Option C: Windows Task Scheduler

1. Open Task Scheduler
2. Create New Task
3. Trigger: Daily, repeat every 1 hour
4. Action: Start a program
   - Program: `node.exe`
   - Arguments: `C:\path\to\cron-google-aqhi.js`
   - Start in: `C:\path\to\project`

#### Option D: Supabase Edge Functions + pg_cron

Create `supabase/functions/collect-google-aqhi/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // Your collection logic here
  // Call Google API for 15 locations
  // Store in Supabase
  // Calculate 3h averages

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

Then in Supabase SQL Editor:

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule hourly collection at :05 (gives Google API time to update)
SELECT cron.schedule(
  'collect-google-aqhi',
  '5 * * * *',  -- Every hour at :05
  $$
  SELECT
    net.http_post(
      url:='https://YOUR_PROJECT.supabase.co/functions/v1/collect-google-aqhi',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) as request_id;
  $$
);
```

---

## 🧪 Testing

### Test 1: Manual Collection

```bash
node cron-google-aqhi.js
```

### Test 2: Verify Database

```sql
-- Check latest AQHI values
SELECT * FROM latest_aqhi_by_location ORDER BY location_id;

-- Check 24-hour history
SELECT * FROM aqhi_24h_history WHERE location_id = 1 ORDER BY hour_timestamp DESC;

-- Verify 3-hour averages
SELECT
  location_id,
  hour_timestamp,
  pm25,
  pm25_3h_avg,
  o3,
  o3_3h_avg,
  aqhi,
  aqhi_category
FROM google_aqhi_hourly
WHERE location_id = 1
ORDER BY hour_timestamp DESC
LIMIT 10;
```

### Test 3: Check Cron Logs

```bash
# PM2 logs
pm2 logs google-aqhi-cron

# System cron logs
tail -f /var/log/google-aqhi.log
```

---

## 📊 Data Quality

### Quality Indicators

- **EXCELLENT**: All pollutants available, recent data
- **GOOD**: Most pollutants available
- **FAIR**: Some pollutants missing
- **LIMITED**: Minimal data available

### 3-Hour Average Logic

For hour 08:00, the 3-hour average includes:
- 06:00 data
- 07:00 data
- 08:00 data

**Result**: More accurate AQHI reflecting recent air quality trends

---

## 🗑️ Cleanup

### Remove Old AQHI Tables

If you want to start fresh:

```sql
-- Drop old combined WAQI+Google AQHI system
DROP TABLE IF EXISTS public.aqhi_hourly_calculated CASCADE;
DROP VIEW IF EXISTS combined_3h_averages CASCADE;

-- Keep WAQI tables for AQI (don't drop these!)
-- - public.waqi_data
-- - public.google_supplements
```

### Auto-Cleanup Old Data

Data older than 7 days is automatically removed:

```sql
-- Manual cleanup
SELECT cleanup_old_google_aqhi_data();

-- Schedule daily cleanup (using pg_cron)
SELECT cron.schedule(
  'cleanup-google-aqhi',
  '0 2 * * *',  -- Every day at 2 AM
  $$SELECT cleanup_old_google_aqhi_data()$$
);
```

---

## 📈 Using the Data

### Frontend Integration

```javascript
// Fetch latest AQHI for all locations
const { data } = await supabase
  .from('latest_aqhi_by_location')
  .select('*')
  .order('location_id');

// Fetch 24-hour history for charts
const { data: history } = await supabase
  .from('aqhi_24h_history')
  .select('*')
  .eq('location_id', 1);

// Display on map
data.forEach(location => {
  addMarker({
    lat: location.latitude,
    lng: location.longitude,
    aqhi: location.aqhi,
    category: location.aqhi_category,
    name: location.location_name
  });
});
```

---

## 🔍 Monitoring

### Check System Health

```bash
# View cron job status
pm2 status

# View recent logs
pm2 logs google-aqhi-cron --lines 50

# Restart if needed
pm2 restart google-aqhi-cron
```

### Database Monitoring

```sql
-- Check latest collection time
SELECT MAX(hour_timestamp) as last_collection FROM google_aqhi_hourly;

-- Check data completeness
SELECT
  hour_timestamp,
  COUNT(*) as locations_collected
FROM google_aqhi_hourly
WHERE hour_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour_timestamp
ORDER BY hour_timestamp DESC;

-- Expected: 15 locations per hour
```

---

## ⚠️ Troubleshooting

### Issue: No data collected

**Check:**
1. Google API key is valid: `echo $GOOGLE_AIR_QUALITY_API_KEY`
2. API quota not exceeded (check Google Cloud Console)
3. Network connectivity

### Issue: AQHI not calculated

**Check:**
1. At least 1 hour of data exists
2. Pollutant data is available (PM2.5 or O3)
3. Run manually: `SELECT calculate_3h_averages_and_aqhi(1, NOW()::timestamp);`

### Issue: Cron not running

**Check:**
1. PM2 process running: `pm2 list`
2. Cron schedule correct: Every hour at :00
3. Logs for errors: `pm2 logs google-aqhi-cron`

---

## 🎉 Success Criteria

✅ 15 locations collecting data every hour
✅ 3-hour rolling averages calculated automatically
✅ AQHI values displaying correctly
✅ Historical data available for charts
✅ System running reliably 24/7

---

## 📞 Support

If you encounter issues:
1. Check logs: `pm2 logs google-aqhi-cron`
2. Verify database: `SELECT * FROM latest_aqhi_by_location`
3. Test manually: `node cron-google-aqhi.js`
4. Check Google API quota in Google Cloud Console
