# Setup Hourly AQHI Calculation (Supabase Cron)

## Option 1: Supabase Edge Functions + Cron (Recommended)

### Step 1: Enable pg_cron Extension

Go to your Supabase Dashboard:
1. SQL Editor
2. Run this command:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 2: Schedule Hourly AQHI Calculation

```sql
-- Schedule AQHI calculation to run every hour at :05 past the hour
-- (gives time for data collection to complete)
SELECT cron.schedule(
    'calculate-hourly-aqhi',           -- Job name
    '5 * * * *',                        -- Every hour at :05 (e.g., 11:05, 12:05, 13:05)
    $$SELECT calculate_and_store_hourly_aqhi()$$
);

-- Verify cron job is scheduled
SELECT * FROM cron.job;
```

### Step 3: Schedule Cleanup of Old Data

```sql
-- Schedule cleanup to run daily at 2 AM
SELECT cron.schedule(
    'cleanup-old-aqhi-data',
    '0 2 * * *',                        -- Every day at 2:00 AM
    $$SELECT cleanup_old_aqhi_data()$$
);
```

### Step 4: Monitor Cron Jobs

```sql
-- View scheduled jobs
SELECT
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
ORDER BY jobid;

-- View job run history
SELECT
    jobid,
    runid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Step 5: Manual Trigger (for testing)

```sql
-- Manually trigger AQHI calculation for current hour
SELECT * FROM calculate_and_store_hourly_aqhi();

-- Check results
SELECT
    station_uid,
    hour_timestamp,
    aqhi,
    aqhi_category,
    data_quality,
    calculation_method
FROM latest_aqhi_by_station
ORDER BY aqhi DESC
LIMIT 20;
```

---

## Option 2: Node.js Cron Job (Alternative)

If Supabase pg_cron is not available, you can run a Node.js cron job:

### Create `cron-aqhi-calculator.js`:

```javascript
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key
);

// Run every hour at :05 past the hour
cron.schedule('5 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running hourly AQHI calculation...`);

  try {
    const { data, error } = await supabase.rpc('calculate_and_store_hourly_aqhi');

    if (error) throw error;

    console.log(`✅ Calculated AQHI for ${data.length} stations`);
    console.log(`   Min: ${Math.min(...data.map(d => d.aqhi))}`);
    console.log(`   Max: ${Math.max(...data.map(d => d.aqhi))}`);
    console.log(`   Avg: ${(data.reduce((sum, d) => sum + d.aqhi, 0) / data.length).toFixed(1)}`);
  } catch (error) {
    console.error('❌ AQHI calculation failed:', error);
  }
});

// Cleanup old data daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Cleaning up old AQHI data...`);

  try {
    const { data, error } = await supabase.rpc('cleanup_old_aqhi_data');

    if (error) throw error;

    console.log(`✅ Cleaned up ${data} old AQHI records`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
});

console.log('🕐 AQHI Cron Jobs Started');
console.log('   - Hourly calculation: Every hour at :05');
console.log('   - Daily cleanup: Every day at 2:00 AM');
```

### Install dependencies:

```bash
npm install node-cron
```

### Run the cron job:

```bash
node cron-aqhi-calculator.js
```

### Deploy to production:

Use PM2 or similar process manager:

```bash
npm install -g pm2
pm2 start cron-aqhi-calculator.js --name "aqhi-cron"
pm2 save
pm2 startup
```

---

## Option 3: Vercel Cron Jobs

If deploying to Vercel, use Vercel Cron Jobs:

### Create `api/cron/calculate-aqhi.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase.rpc('calculate_and_store_hourly_aqhi');

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        stations: data.length,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
```

### Configure in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/calculate-aqhi",
      "schedule": "5 * * * *"
    }
  ]
}
```

---

## Testing the System

### 1. Manual Test

```sql
-- Calculate AQHI for current hour
SELECT * FROM calculate_and_store_hourly_aqhi();

-- View results
SELECT * FROM latest_aqhi_by_station ORDER BY aqhi DESC;
```

### 2. Check 24-hour History

```sql
SELECT
    station_uid,
    COUNT(*) as hours_recorded,
    MIN(aqhi) as min_aqhi,
    MAX(aqhi) as max_aqhi,
    AVG(aqhi) as avg_aqhi
FROM aqhi_24h_history
GROUP BY station_uid
ORDER BY station_uid;
```

### 3. Verify Data Quality

```sql
SELECT
    data_quality,
    calculation_method,
    COUNT(*) as count,
    AVG(aqhi) as avg_aqhi
FROM latest_aqhi_by_station
GROUP BY data_quality, calculation_method
ORDER BY count DESC;
```

---

## Recommended: Supabase pg_cron (Option 1)

**Advantages:**
- ✅ Runs inside database (no external server needed)
- ✅ Most reliable and efficient
- ✅ No additional infrastructure
- ✅ Perfect for this use case

**Use Option 2 or 3 only if:**
- Supabase pg_cron is not available in your plan
- You need more complex scheduling logic
- You want to integrate with other services
