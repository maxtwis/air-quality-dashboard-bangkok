# Complete Vercel Deployment Guide for AQHI Dashboard

## 🚨 **Why LocalStorage Won't Work on Vercel**

**Problem with Current Implementation:**
- Each user builds their own 3-hour average in their browser
- New visitors always start from zero
- No shared historical data between users
- Takes 3+ hours for each individual to get accurate AQHI

---

## ✅ **Recommended Solution: Server-Side Data Collection**

### **Architecture Overview**
```
Vercel Cron Job (every 10 mins) → Collects WAQI data → Stores in database
    ↓
User visits dashboard → Fetches 3-hour averages from API → Shows accurate AQHI
```

---

## 🛠 **Step-by-Step Implementation**

### **Step 1: Choose Your Database**

#### Option A: Supabase (Recommended - Free tier available)
```bash
# Create account at supabase.com
# Create new project
# Copy URL and anon key to Vercel env vars
```

#### Option B: Vercel Postgres
```bash
# Enable in Vercel dashboard
# Automatic setup with your project
```

#### Option C: PlanetScale MySQL
```bash
# Create account at planetscale.com
# Create database
# Copy connection details
```

### **Step 2: Set Up Database Schema**
```sql
-- Run schema.sql in your chosen database
-- Creates tables for storing historical data
-- Includes optimized indexes and views
```

### **Step 3: Configure Vercel Environment**

Add to your Vercel project settings:
```env
WAQI_API_TOKEN=your_waqi_token_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

### **Step 4: Deploy Files**

Essential files for Vercel:
```
api/
├── collect-data.js     # Cron job to collect data
├── get-historical.js   # API to serve 3h averages
js/
├── aqhi-vercel.js      # Updated AQHI logic
database/
├── schema.sql          # Database structure
vercel.json             # Cron configuration
```

### **Step 5: Enable Cron Jobs**

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/collect-data",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

## 🔄 **How It Works**

### **Data Collection (Server-Side)**
1. **Every 10 minutes**: Vercel cron calls `/api/collect-data`
2. **Fetches current data** from WAQI API for all Bangkok stations
3. **Stores in database** with timestamp
4. **Automatically calculates** 3-hour moving averages

### **User Experience**
1. **User visits dashboard**
2. **Fetches 3-hour averages** from `/api/get-historical`
3. **Shows scientifically accurate AQHI** immediately
4. **All users see same data** (no individual waiting period)

---

## 📊 **Benefits of This Approach**

✅ **Immediate accuracy** for all users  
✅ **Shared data** across all visitors  
✅ **True 3-hour moving averages**  
✅ **Efficient API usage** (server collects once, serves many)  
✅ **Scalable** to thousands of users  
✅ **Persistent** across deployments  

---

## 💰 **Cost Considerations**

### **Free Tier Limits**
- **Vercel**: 100GB-hrs/month serverless function time
- **Supabase**: 500MB database, 2 million rows
- **Total API calls**: ~4,320/month (every 10 min)

### **Expected Usage**
- **Data collection**: ~2 seconds every 10 minutes
- **Monthly function time**: ~10 hours (well within limits)
- **Database growth**: ~50MB/month for Bangkok area

---

## 🔧 **Implementation Timeline**

### **Immediate (Day 1)**
- Deploy cron job and database setup
- Start collecting data every 10 minutes

### **After 3 Hours**
- Full 3-hour moving averages available
- All users see accurate AQHI values

### **Ongoing**
- Automatic data collection
- 7-day data retention (configurable)
- Self-maintaining system

---

## 🚀 **Quick Start Commands**

```bash
# 1. Set up database (choose one)
# Supabase: Create project at supabase.com
# Vercel: Enable Postgres in dashboard
# PlanetScale: Create database

# 2. Run schema
psql -f database/schema.sql your_database_url

# 3. Configure environment variables in Vercel
WAQI_API_TOKEN=your_token
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key

# 4. Deploy to Vercel
vercel deploy

# 5. Enable cron jobs (Pro plan required)
# Or use GitHub Actions as alternative
```

---

## 🔍 **Testing & Monitoring**

### **Test Endpoints**
```bash
# Test data collection
curl https://your-app.vercel.app/api/collect-data

# Test historical data
curl https://your-app.vercel.app/api/get-historical

# Check specific station
curl https://your-app.vercel.app/api/get-historical?station=5773
```

### **Monitor System**
- Check Vercel function logs
- Monitor database growth
- Track API response times
- Verify cron job execution

---

## 🆘 **Fallback Strategy**

The system includes intelligent fallbacks:

1. **Primary**: Server-side 3-hour averages
2. **Fallback 1**: Current readings from WAQI
3. **Fallback 2**: Client-side localStorage (original approach)

This ensures the dashboard always works, even if server components fail.

---

## 📱 **Alternative: GitHub Actions Approach**

If you prefer not to use Vercel crons:

```yaml
# .github/workflows/collect-data.yml
name: Collect Air Quality Data
on:
  schedule:
    - cron: '*/10 * * * *'
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: |
          curl -X POST https://your-app.vercel.app/api/collect-data
```

---

This approach transforms your dashboard from a client-side toy into a professional air quality monitoring system that provides immediate, accurate AQHI values to all users from day one! 🌟