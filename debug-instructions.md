# 🔍 Debug Instructions for Vercel/Supabase Issue

## The Problem
WAQI data loads but doesn't reach Supabase. Let's debug step by step.

## Step 1: Test Debug Endpoint

After deploying to Vercel, visit:
```
https://your-app.vercel.app/api/debug-collect
```

This will show you exactly what's failing.

## Step 2: Check Environment Variables in Vercel

Go to your Vercel Dashboard → Project → Settings → Environment Variables

**Required Variables:**
```
SUPABASE_URL=https://xqvjrovzhupdfwvdikpo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  (your service role key, NOT anon key)
AQICN_API_TOKEN=354eb1b871693ef55f777c69e44e81bcaf215d40
OPENWEATHER_API_KEY=a180db2b4dba131e42c97be80d3d018f  (optional)
```

⚠️ **CRITICAL**: Make sure you're using the **SERVICE ROLE KEY**, not the anon key!

## Step 3: Most Common Issues

### Issue A: Wrong Supabase Key
- **Problem**: Using `SUPABASE_ANON_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`
- **Solution**: Get the service role key from Supabase Dashboard → Settings → API

### Issue B: Missing Environment Variables
- **Problem**: Variables not set in Vercel
- **Solution**: Add them in Vercel Dashboard → Settings → Environment Variables

### Issue C: Import/Module Issues
- **Problem**: `require()` vs `import()` mismatch in Vercel
- **Solution**: Already fixed in our updated files

## Step 4: Check Supabase Logs

In Supabase Dashboard:
1. Go to Logs → API Logs
2. Look for failed requests around the time cron runs
3. Check for authentication or permission errors

## Step 5: Manual Test

Test the endpoint manually:
```bash
curl -X POST https://your-app.vercel.app/api/collect-data
```

Or use a tool like Postman to POST to the endpoint.

## Step 6: Cron Job Setup (if using external cron)

If Vercel cron isn't working, set up external cron:

**Option 1: cron-job.org**
1. Sign up at cron-job.org
2. Create job: `https://your-app.vercel.app/api/collect-data`
3. Schedule: Every 10 minutes
4. Method: POST

**Option 2: UptimeRobot**
1. Sign up at uptimerobot.com
2. Create monitor: `https://your-app.vercel.app/api/collect-data`
3. Interval: 5 minutes

## Expected Results

After fixing, you should see:
- ✅ WAQI data loads (already working)
- ✅ Data gets converted from AQI to concentrations
- ✅ Data gets stored in Supabase tables
- ✅ 3-hour averages appear in database
- ✅ AQHI calculations work with stored data

## Debug Command Summary

1. **Test debug endpoint**: `https://your-app.vercel.app/api/debug-collect`
2. **Check Vercel logs**: Vercel Dashboard → Functions → View Logs
3. **Check Supabase logs**: Supabase Dashboard → Logs → API
4. **Manual test**: `curl -X POST https://your-app.vercel.app/api/collect-data`