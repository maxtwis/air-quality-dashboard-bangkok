# Setting Up Google AQHI with cron-job.org

## 🎯 Overview

This guide shows you how to use **cron-job.org** (free service) to automatically collect Google AQHI data every hour.

---

## ✅ Prerequisites

1. ✅ Your server is running and accessible via public URL
2. ✅ Supabase database is set up ([google-aqhi-system.sql](supabase/google-aqhi-system.sql))
3. ✅ Environment variables configured in `.env.local`

---

## 🚀 Setup Steps

### Step 1: Start Your Server

Make sure your server is running:

```bash
npm run dev
```

Or for production:

```bash
pm2 start server.js --name "air-quality-dashboard"
```

Your server should be accessible at a public URL (e.g., `https://yourdomain.com` or use ngrok for testing).

### Step 2: Test the Endpoint Locally

Open browser or use curl:

```bash
# Health check
curl http://localhost:3000/api/google-aqhi/health

# Test collection (this will actually collect data!)
curl http://localhost:3000/api/google-aqhi/collect
```

Expected response:
```json
{
  "success": true,
  "timestamp": "2024-01-15T08:00:00.000Z",
  "locations_collected": 15,
  "locations_failed": 0,
  "aqhi_calculated": 15,
  "duration_ms": 3542
}
```

### Step 3: Deploy to Production (if needed)

If using localhost, you'll need a public URL. Options:

#### Option A: Use ngrok (for testing)

```bash
npm install -g ngrok
ngrok http 3000
```

You'll get a public URL like: `https://abc123.ngrok.io`

#### Option B: Deploy to Vercel/Railway/Render

Deploy your application and get a permanent public URL.

### Step 4: Create cron-job.org Account

1. Go to https://cron-job.org
2. Sign up (free account)
3. Verify your email

### Step 5: Create a New Cron Job

In cron-job.org dashboard:

1. **Click "Create cronjob"**

2. **Configure the job:**

   **Title**: `Google AQHI Hourly Collection`

   **Address (URL)**:
   ```
   https://yourdomain.com/api/google-aqhi/collect
   ```
   Or if using ngrok:
   ```
   https://abc123.ngrok.io/api/google-aqhi/collect
   ```

   **Schedule**:
   - Execution: `Every hour`
   - Minutes: `0` (run at :00 minutes)
   - Hours: `Every hour` (0-23)
   - Days: `Every day`
   - Months: `Every month`

   **Advanced (Optional)**:
   - Request method: `GET`
   - Request timeout: `60 seconds`
   - Fail percentage: `25%` (to avoid false alarms)

3. **Click "Create cronjob"**

### Step 6: Test the Cron Job

After creating the job:

1. Click **"Run now"** to test immediately
2. Check **"History"** tab for results
3. Look for **"Success (200)"** status

### Step 7: Verify Data in Supabase

After the cron job runs:

```sql
-- Check if data was collected
SELECT * FROM latest_aqhi_by_location ORDER BY location_id;

-- Check recent collection
SELECT
  hour_timestamp,
  COUNT(*) as locations_collected
FROM google_aqhi_hourly
WHERE hour_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour_timestamp
ORDER BY hour_timestamp DESC;
```

Expected: 15 locations per hour

---

## 📊 Monitoring

### Check Cron Job Status

In cron-job.org dashboard:

1. **Dashboard** → View all your cron jobs
2. **History** → See execution history
3. **Logs** → View response details

### Check Server Logs

```bash
# If using PM2
pm2 logs air-quality-dashboard

# If using npm run dev
# Check terminal output
```

### Check Database

```sql
-- Latest collection time
SELECT MAX(hour_timestamp) FROM google_aqhi_hourly;

-- Data completeness last 24 hours
SELECT
  hour_timestamp,
  COUNT(*) as locations,
  COUNT(CASE WHEN aqhi IS NOT NULL THEN 1 END) as with_aqhi
FROM google_aqhi_hourly
WHERE hour_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour_timestamp
ORDER BY hour_timestamp DESC;
```

---

## 🔒 Security (Optional but Recommended)

### Add Authentication

Edit `api-google-aqhi.js`:

```javascript
export async function collectGoogleAQHI(req, res) {
  // Add secret token check
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.CRON_SECRET_TOKEN;

  if (authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  // ... rest of the code
}
```

Add to `.env.local`:
```bash
CRON_SECRET_TOKEN=your-random-secret-token-here
```

In cron-job.org, add header:
- Header name: `Authorization`
- Header value: `Bearer your-random-secret-token-here`

---

## 📧 Email Notifications

In cron-job.org:

1. Go to **Settings** → **Notifications**
2. Enable **Email notifications**
3. Configure:
   - ✅ Notify on failures
   - ⬜ Notify on success (optional, can be noisy)
   - Set failure threshold: `After 3 consecutive failures`

---

## 🐛 Troubleshooting

### Issue: Cron job shows "Failed"

**Check:**

1. **URL is accessible**: Test in browser
2. **Server is running**: Check PM2 or process
3. **Firewall allows requests**: Check server firewall
4. **View error response**: Check cron-job.org History → Response

### Issue: Status 500 (Server Error)

**Check server logs:**

```bash
pm2 logs air-quality-dashboard --lines 50
```

**Common causes:**
- Google API key missing or invalid
- Supabase credentials wrong
- Database table not created

### Issue: Status 401 (Unauthorized)

**If you added authentication:**
- Check `CRON_SECRET_TOKEN` in `.env.local`
- Check Authorization header in cron-job.org
- Restart server after changing env vars

### Issue: Data not appearing in database

**Check:**

1. **Cron job succeeded**: Status 200 in cron-job.org
2. **Run test endpoint**: `curl https://yourdomain.com/api/google-aqhi/collect`
3. **Check Supabase table**: `SELECT * FROM google_aqhi_hourly ORDER BY created_at DESC LIMIT 5;`
4. **Check function exists**: `SELECT calculate_3h_averages_and_aqhi(1, NOW()::timestamp);`

---

## 📋 Example cron-job.org Configuration

```
Title: Google AQHI Hourly Collection
URL: https://yourdomain.com/api/google-aqhi/collect

Schedule Pattern:
┌─────────────── minute (0)
│ ┌───────────── hour (every hour)
│ │ ┌─────────── day of month (every day)
│ │ │ ┌───────── month (every month)
│ │ │ │ ┌─────── day of week (every day)
│ │ │ │ │
0 * * * *

Execution times:
00:00, 01:00, 02:00, 03:00, 04:00, 05:00,
06:00, 07:00, 08:00, 09:00, 10:00, 11:00,
12:00, 13:00, 14:00, 15:00, 16:00, 17:00,
18:00, 19:00, 20:00, 21:00, 22:00, 23:00

= 24 executions per day
```

---

## 🎉 Success Checklist

After setup, verify:

✅ Cron job created in cron-job.org
✅ "Run now" test succeeds (Status 200)
✅ Data appears in Supabase `google_aqhi_hourly` table
✅ AQHI values calculated (check `latest_aqhi_by_location` view)
✅ Email notifications configured (optional)
✅ Server auto-restarts on crash (if using PM2)

---

## 💡 Tips

1. **Use ngrok for testing**: Don't deploy to production just to test cron jobs
2. **Check timezone**: cron-job.org uses UTC by default
3. **Set up monitoring**: Enable email notifications for failures
4. **Log rotation**: PM2 handles this automatically
5. **Backup plan**: Keep the standalone `cron-google-aqhi.js` script as backup

---

## 📞 Need Help?

**Check these files:**
1. `GOOGLE-AQHI-SETUP.md` - Full system documentation
2. `GOOGLE-AQHI-SUMMARY.md` - System overview
3. Server logs: `pm2 logs air-quality-dashboard`
4. Cron-job.org History tab

**Test endpoints:**
```bash
# Health check
curl https://yourdomain.com/api/google-aqhi/health

# Manual collection
curl https://yourdomain.com/api/google-aqhi/collect
```

---

## 🚀 You're All Set!

Your Google AQHI system will now:

✅ Collect data every hour at :00 minutes
✅ Store in Supabase with 3-hour averages
✅ Calculate Thai AQHI automatically
✅ Keep 7 days of historical data
✅ Notify you if something fails

**No server-side cron needed!** 🎉
