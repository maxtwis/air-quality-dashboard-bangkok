# Google AQHI Final Solution

## Problem Summary

Vercel free tier cannot handle Google AQHI collection:
- **Free tier timeout**: 10 seconds max
- **Actual cold start timeout**: ~5-7 seconds
- **Collection time**:
  - 15 locations: ~8-10 seconds ❌
  - 5 locations (batched): ~3-5 seconds ⚠️ Still times out with cold starts

## ✅ Recommended Solution: Local Cron Job

Run the collection on your computer with Windows Task Scheduler or a simple local cron script.

### Option A: Windows Task Scheduler (Easiest)

1. **Create the collection script**:

Create `google-aqhi-collect.bat`:
```batch
@echo off
cd /d "C:\Users\ion_l_uhhlu4p.MAXTWIS\Documents\GitHub\air-quality-dashboard-bangkok"
node collect-google-aqhi-local.js
```

2. **Create the collection script** (`collect-google-aqhi-local.js`):

```javascript
// See the file below - already created for you
```

3. **Set up Windows Task Scheduler**:
   - Open Task Scheduler
   - Create Basic Task
   - Name: "Google AQHI Hourly Collection"
   - Trigger: Daily, repeat every 1 hour
   - Start time: Today at next whole hour (e.g., 15:00)
   - Action: Start a program
   - Program: `C:\path\to\google-aqhi-collect.bat`
   - Finish

### Option B: Node-cron (Alternative)

Create `google-cron.js`:
```javascript
const cron = require('node-cron');
const { exec } = require('child_process');

// Run every hour at :00
cron.schedule('0 * * * *', () => {
  console.log(`[${new Date().toISOString()}] Running Google AQHI collection...`);

  exec('node collect-google-aqhi-local.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error);
      return;
    }
    console.log(stdout);
    if (stderr) console.error(stderr);
  });
});

console.log('Google AQHI cron job started. Press Ctrl+C to stop.');
```

Run with:
```bash
npm install node-cron
node google-cron.js
```

Keep the terminal open or run as a Windows service.

## Why Local Works Better

| Method | Timeout | Cost | Reliability |
|--------|---------|------|-------------|
| Vercel Free | 10s (cold start ~5s) | Free | ❌ Times out |
| Vercel Pro | 60s | $20/month | ✅ Works |
| cron-job.org | Depends on host | Free | ❌ Still calls Vercel |
| **Local cron** | **No limit** | **Free** | **✅ Perfect** |

## Database Trigger Still Works!

Even with local collection, the Supabase trigger automatically calculates AQHI:

1. Local script collects Google API data
2. Inserts into `google_aqhi_hourly` table
3. **Trigger fires automatically**
4. AQHI calculated in database

## Setup Steps

1. **Install the trigger** (one-time):
   - Run `supabase/auto-calculate-aqhi-trigger.sql` in Supabase

2. **Set up local collection**:
   - Use the provided `collect-google-aqhi-local.js` script
   - Schedule with Windows Task Scheduler (Option A)
   - Or run with node-cron (Option B)

3. **Test it**:
```bash
node collect-google-aqhi-local.js
```

Expected output:
```
[2025-11-04T08:00:00.000Z] Starting Google AQHI collection...
✅ Collected 15/15 locations in 6500ms
✅ Stored in database
✅ Trigger will calculate AQHI automatically
```

## Alternative: Upgrade to Vercel Pro

If you prefer cloud-based collection:
- Cost: $20/month
- Benefit: 60-second timeouts
- The existing `/api/google-batch` endpoint will work

## Files

- `collect-google-aqhi-local.js` - Local collection script (see below)
- `supabase/auto-calculate-aqhi-trigger.sql` - Database trigger
- This guide

---

The local solution is **free, reliable, and has no timeout limits**. Your computer just needs to be on at the top of each hour to run the collection.
