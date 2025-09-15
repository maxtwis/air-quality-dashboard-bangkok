# Free Cron Solutions for Hobby Vercel Plan

Since Vercel Hobby plan only allows daily cron jobs, here are free alternatives for 10-minute data collection:

## 🆓 **Option 1: cron-job.org (Recommended)**

**Free Service**: [cron-job.org](https://cron-job.org)

### Setup:
1. Sign up at cron-job.org (free account)
2. Create a new cron job:
   - **URL**: `https://your-app.vercel.app/api/collect-data`
   - **Schedule**: Every 10 minutes
   - **HTTP Method**: POST
   - **Title**: Bangkok Air Quality Data Collection

### Free Limits:
- ✅ Up to 3 cron jobs
- ✅ Down to 1-minute intervals
- ✅ Reliable execution
- ✅ Email notifications on failures

---

## 🆓 **Option 2: UptimeRobot (Creative Use)**

**Free Service**: [uptimerobot.com](https://uptimerobot.com)

### Setup:
1. Sign up for free UptimeRobot account
2. Create HTTP(s) monitor:
   - **URL**: `https://your-app.vercel.app/api/collect-data`
   - **Monitoring Interval**: 5 minutes (minimum)
   - **Monitor Type**: HTTP(s)

### How It Works:
- UptimeRobot "monitors" your endpoint every 5 minutes
- Your endpoint returns success, triggering data collection
- Side effect: collects data every 5 minutes for free!

### Free Limits:
- ✅ Up to 50 monitors
- ✅ 5-minute intervals
- ✅ 99.9% uptime monitoring

---

## 🆓 **Option 3: GitHub Actions (Most Reliable)**

**Free Service**: GitHub Actions (if your repo is public)

### Setup:
Create `.github/workflows/data-collection.yml`:

\`\`\`yaml
name: Collect Air Quality Data
on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  collect-data:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Data Collection
        run: |
          curl -X POST ${{ secrets.VERCEL_ENDPOINT }}/api/collect-data \\
               -H "Content-Type: application/json"
\`\`\`

### GitHub Secrets:
Add to your repo's **Settings** → **Secrets**:
- `VERCEL_ENDPOINT`: `https://your-app.vercel.app`

### Free Limits:
- ✅ 2,000 minutes/month for public repos
- ✅ Precise timing
- ✅ Logs and monitoring

---

## 🆓 **Option 4: EasyCron**

**Free Service**: [easycron.com](https://easycron.com)

### Free Limits:
- ✅ 1 cron job
- ✅ Down to 1-minute intervals
- ✅ 100 executions/month (not enough for 10-min intervals)

**Better for**: Daily or hourly collection

---

## 🎯 **Recommended Hybrid Approach**

Combine multiple solutions for reliability:

### Primary: cron-job.org (Every 10 minutes)
### Backup: Vercel daily cron (Once per day)
### Failsafe: Client-side collection (When users visit)

This ensures:
- ✅ Regular 10-minute collection (cron-job.org)
- ✅ Daily consistency check (Vercel)
- ✅ Real-time updates (client-side)
- ✅ No data gaps if external service fails

---

## 🔧 **Implementation Code**

Update your Vercel function to handle external triggers:

\`\`\`javascript
// In api/collect-data.js
export default async function handler(req, res) {
  // Allow external cron services
  const allowedOrigins = [
    'cron-job.org',
    'uptimerobot.com',
    'github.com',
    'easycron.com'
  ];

  const origin = req.headers['user-agent'] || req.headers['origin'] || '';
  const isExternalCron = allowedOrigins.some(allowed =>
    origin.toLowerCase().includes(allowed)
  );

  if (req.method !== 'POST' && req.method !== 'GET' && !isExternalCron) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Your existing data collection code...
}
\`\`\`

---

## 💰 **Cost Comparison**

| Solution | Cost | Interval | Reliability | Setup |
|----------|------|----------|-------------|--------|
| cron-job.org | FREE | 10 min | ⭐⭐⭐⭐⭐ | Easy |
| UptimeRobot | FREE | 5 min | ⭐⭐⭐⭐ | Easy |
| GitHub Actions | FREE* | 10 min | ⭐⭐⭐⭐⭐ | Medium |
| Vercel Pro | $20/mo | 10 min | ⭐⭐⭐⭐⭐ | Easy |

*Free for public repos only

---

## 🚀 **Quick Start: cron-job.org Setup**

1. Go to [cron-job.org](https://cron-job.org)
2. Sign up (email verification required)
3. Click "Create cronjob"
4. Fill in:
   - **Title**: Bangkok Air Quality Collection
   - **Address**: `https://your-app.vercel.app/api/collect-data`
   - **Schedule**:
     - Minute: `*/10` (every 10 minutes)
     - Hour: `*` (every hour)
     - Day: `*` (every day)
   - **Execution**:
     - HTTP method: `POST`
     - Headers: `Content-Type: application/json`
5. Save and activate

**Result**: Your data will be collected every 10 minutes, completely free! 🎉