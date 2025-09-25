# 🕐 External Cron Setup for Vercel Hobby Plan

## Why External Cron?

Vercel Hobby plan only supports **daily** cron jobs, not every 10 minutes. Since you need frequent data collection, we'll use a free external service.

## ✅ **Fixed the Deployment Issue**

I removed the incompatible cron configuration from `vercel.json`. Your deployment should work now!

## 🚀 **Setup External Cron (5 minutes)**

### **Option 1: cron-job.org (Recommended)**

1. **Sign up**: Go to [cron-job.org](https://cron-job.org) (free account)

2. **Create Cron Job**:
   - **Title**: Bangkok Air Quality Data Collection
   - **URL**: `https://your-app.vercel.app/api/collect-data`
   - **HTTP Method**: POST
   - **Schedule**: `*/10 * * * *` (every 10 minutes)
   - **Timezone**: Asia/Bangkok

3. **Enable**: Save and enable the job

### **Option 2: UptimeRobot (Alternative)**

1. **Sign up**: Go to [uptimerobot.com](https://uptimerobot.com) (free account)

2. **Create Monitor**:
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://your-app.vercel.app/api/collect-data`
   - **Monitoring Interval**: 5 minutes
   - **HTTP Method**: POST

3. **Enable**: The "uptime monitor" will trigger your data collection

## 🧪 **Test Your Setup**

1. **Deploy**: Push your changes to trigger Vercel deployment (should work now!)

2. **Manual Test**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/debug-collect
   ```

3. **Check Results**: Visit your Supabase dashboard to see if data is flowing

4. **Monitor**: External cron service will show success/failure logs

## 📊 **Expected Results**

After setup, every 10 minutes:
- ✅ External cron triggers your Vercel function
- ✅ Function fetches WAQI data
- ✅ Converts AQI to concentrations
- ✅ Stores in Supabase tables
- ✅ 3-hour averages build up over time
- ✅ AQHI calculations improve with stored data

## 🔧 **Troubleshooting**

If data still doesn't flow:
1. Check `https://your-app.vercel.app/api/debug-collect` for detailed logs
2. Check Vercel function logs in dashboard
3. Check Supabase API logs for errors
4. Ensure environment variables are set in Vercel

## 🎯 **Why It Worked Yesterday**

Yesterday, Vercel might have temporarily allowed the cron job, or you were on a different deployment. Today's deployment failed because Hobby plan restrictions are enforced more strictly.

**Bottom line**: External cron is actually more reliable for Hobby plans anyway! 🚀