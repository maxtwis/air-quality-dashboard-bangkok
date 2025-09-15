# Vercel Deployment Guide with Server-Side Data Collection

This guide helps you deploy your air quality dashboard to Vercel with automatic server-side data collection.

## 🎯 **Problem Solved**

**Before**: Data collection happens in browser (client-side)
- ❌ Only works when someone has dashboard open
- ❌ Multiple users cause conflicts
- ❌ No data when dashboard is closed

**After**: Data collection happens on Vercel servers
- ✅ Runs automatically every 10 minutes
- ✅ Works even when no one visits the dashboard
- ✅ No conflicts between multiple users
- ✅ Reliable 24/7 data collection

## 🚀 **Deployment Steps**

### 1. **Prepare Your Repository**

Ensure these files are in your repo:
- `api/collect-data.js` - Server-side data collection function ✅
- `vercel.json` - Vercel configuration with cron job ✅
- `supabase-schema.sql` - Database schema ✅

### 2. **Deploy to Vercel**

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure the deployment:
   - **Framework Preset**: Other (or leave as detected)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: Leave empty or `npm run build`
   - **Output Directory**: Leave empty

### 3. **Configure Environment Variables**

In your Vercel dashboard, go to **Settings** → **Environment Variables** and add:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
AQICN_API_TOKEN=354eb1b871693ef55f777c69e44e81bcaf215d40
```

**Important**: Use the **Service Role Key** (not anon key) for server-side operations.

### 4. **Get Your Supabase Service Role Key**

1. Go to your Supabase dashboard
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (starts with `eyJ...`)
4. Add it as `SUPABASE_SERVICE_ROLE_KEY` in Vercel

### 5. **Test the Deployment**

1. After deployment, visit your Vercel dashboard
2. Go to **Functions** tab to see the cron job
3. Test the function manually:
   ```
   curl -X POST https://your-app.vercel.app/api/collect-data
   ```

## ⏰ **How the Cron Job Works**

### Automatic Schedule
- **Frequency**: Every 10 minutes (`*/10 * * * *`)
- **Timezone**: UTC (Vercel default)
- **Reliability**: Vercel handles retries and monitoring

### Data Collection Process
1. **Trigger**: Vercel automatically calls `/api/collect-data` every 10 minutes
2. **Fetch**: Function fetches data from AQICN API
3. **Store**: Saves 134 stations to Supabase database
4. **3-Hour Averages**: Database calculates moving averages automatically

## 🔧 **Disable Client-Side Storage**

Since you now have server-side collection, update your frontend to use database data instead of storing locally.

Update `js/api.js` to remove client-side storage:

```javascript
// Remove this section from fetchAirQualityData():
// Try to store data in Supabase (async, non-blocking)
try {
    // Dynamic import to avoid breaking the app if Supabase isn't available
    import('./storage.js').then(({ airQualityStorage }) => {
        // REMOVE THIS ENTIRE BLOCK
    });
} catch (error) {
    // Non-blocking storage failure
}
```

## 📊 **Monitoring Data Collection**

### Check Vercel Logs
1. Go to your Vercel dashboard
2. Click on your project
3. Go to **Functions** tab
4. Click on the `collect-data` function to see logs

### Check Supabase Database
1. Go to your Supabase dashboard
2. Navigate to **Table Editor**
3. Check `air_quality_readings` table for new entries every 10 minutes

### Expected Log Messages
```
🔄 Starting data collection from WAQI API...
📊 WAQI API returned 134 stations
✅ Stored 134 stations and 134 readings
```

## 🎛️ **Frontend Updates**

Your dashboard will now:
1. **Display**: Show current data from AQICN API (as before)
2. **AQHI Calculations**: Use 3-hour averages from Supabase
3. **Historical Data**: Available for trends and analysis
4. **Multiple Users**: Work perfectly without conflicts

## 🔍 **Troubleshooting**

### Function Not Running
- Check Vercel **Functions** tab for error logs
- Verify environment variables are set correctly
- Ensure Supabase service role key has proper permissions

### Data Not Storing
- Check Supabase logs in dashboard
- Verify your database schema is applied
- Test the function manually with curl

### AQHI Not Improving
- Wait 3+ hours for sufficient historical data
- Check that readings are accumulating in database
- Verify the `current_3h_averages` view is working

## 🎉 **Benefits of This Setup**

- **Reliable**: Data collection continues 24/7
- **Scalable**: Supports unlimited concurrent users
- **Accurate**: True 3-hour moving averages for AQHI
- **Cost-Effective**: Vercel's generous free tier includes cron jobs
- **Maintenance-Free**: Automatic cleanup and error handling

Your dashboard is now a production-ready application with robust server-side data collection!