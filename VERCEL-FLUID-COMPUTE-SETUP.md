# Google AQHI with Vercel Fluid Compute (Free Tier)

## ✅ Recommended Solution: Use Vercel Fluid Compute

With **Vercel Fluid Compute**, you get **60-second timeouts on the free tier** (up from 10 seconds), which is enough for Google AQHI collection!

## Setup Steps

### 1. Enable Fluid Compute in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project: `clean-air-bkk`
3. Click **Settings** → **Functions** tab
4. **Enable Fluid Compute** (toggle the switch)
5. Click **Save**

### 2. Trigger a New Deployment

The settings take effect on the next deployment:

```bash
git commit --allow-empty -m "Enable Fluid Compute"
git push
```

Or simply push the updated `vercel.json` file (already done):

```bash
git add vercel.json
git commit -m "Update maxDuration for Fluid Compute"
git push
```

### 3. Install Supabase Trigger

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Copy from supabase/auto-calculate-aqhi-trigger.sql
```

This trigger automatically calculates AQHI when data is inserted.

### 4. Set Up cron-job.org

**Option A: Single Endpoint (All 15 locations)**

If Fluid Compute works well:
- **URL**: `https://clean-air-bkk.vercel.app/api/google-batch?batch=1` (just batch 1, or remove batch parameter for all)
- **Schedule**: `0 * * * *` (every hour at :00)

**Option B: Three Batches (5 locations each)** - More reliable

Create 3 cron jobs:

**Job 1**: Locations 1-5
- **URL**: `https://clean-air-bkk.vercel.app/api/google-batch?batch=1`
- **Schedule**: `0 * * * *` (every hour at :00)

**Job 2**: Locations 6-10
- **URL**: `https://clean-air-bkk.vercel.app/api/google-batch?batch=2`
- **Schedule**: `2 * * * *` (every hour at :02)

**Job 3**: Locations 11-15
- **URL**: `https://clean-air-bkk.vercel.app/api/google-batch?batch=3`
- **Schedule**: `4 * * * *` (every hour at :04)

## Benefits of Fluid Compute

| Feature | Before Fluid | With Fluid |
|---------|-------------|------------|
| Timeout (Free) | 10 seconds | **60 seconds** ✅ |
| Cold Starts | Slow | Faster |
| Cost | Free | **Still Free** ✅ |
| Concurrency | Limited | Better |

## How It Works

```
cron-job.org (every hour)
    ↓
/api/google-batch?batch=1 (Vercel with Fluid Compute - 60s timeout)
    ↓
Fetch Google API (5 locations in parallel) - ~2-3 seconds
    ↓
Insert into google_aqhi_hourly - ~500ms
    ↓
Trigger automatically calculates AQHI - async in database
    ↓
Complete in ~3-4 seconds ✅
```

## Testing

After enabling Fluid Compute and deploying:

```bash
# Test batch 1 (locations 1-5)
curl "https://clean-air-bkk.vercel.app/api/google-batch?batch=1"

# Expected response:
{
  "success": true,
  "batch": 1,
  "collected": 5,
  "failed": 0,
  "duration_ms": 3200,
  "timestamp": "2025-11-04T08:00:00.000Z",
  "note": "AQHI calculated by database trigger"
}
```

## Troubleshooting

### Still getting timeouts?

1. **Check Fluid Compute is enabled**: Settings → Functions → Verify toggle is ON
2. **Verify new deployment**: Check Vercel dashboard for latest deployment
3. **Use batched approach**: 3 cron jobs with 5 locations each (Option B above)
4. **Fallback**: Use the local script (`collect-google-aqhi-local.js`)

### Check AQHI calculation

```sql
-- In Supabase SQL Editor
SELECT
  location_id,
  hour_timestamp,
  pm25, o3, no2,
  pm25_3h_avg, o3_3h_avg, no2_3h_avg,
  aqhi,
  aqhi_category
FROM google_aqhi_hourly
ORDER BY hour_timestamp DESC, location_id
LIMIT 15;
```

## Alternative: Local Collection

If you prefer not to use Vercel, use the local script:
- See [GOOGLE-AQHI-FINAL-SOLUTION.md](GOOGLE-AQHI-FINAL-SOLUTION.md)
- Run `collect-google-aqhi-local.js` with Windows Task Scheduler
- No timeout limits, works perfectly

## Files

- ✅ `api/google-batch.js` - Batched collection endpoint
- ✅ `vercel.json` - Updated with 60-second timeout
- ✅ `supabase/auto-calculate-aqhi-trigger.sql` - Database trigger
- ✅ `collect-google-aqhi-local.js` - Local fallback script
- ✅ This setup guide

---

**Recommended**: Try Fluid Compute first (it's free and easy). If it doesn't work reliably, use the local script.
