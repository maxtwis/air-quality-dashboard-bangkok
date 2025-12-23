# LINE Official Account Integration Setup

Complete guide to integrate LINE messaging for community AQHI notifications.

## Overview

This integration allows you to:
- **Broadcast AQHI updates** to all LINE followers (scheduled or manual)
- **Interactive bot** for users to query specific community AQHI
- **Rich Flex Messages** with health advisories in Thai
- **Automated scheduling** using Supabase pg_cron

## Architecture

```
┌─────────────────┐
│   Supabase      │
│   Database      │
│  (AQHI Data)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Edge Function  │◄─────┤   pg_cron        │
│  line-notify-   │      │   (Scheduler)    │
│  aqhi           │      └──────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  LINE Messaging │      │  LINE Webhook    │
│  API (Broadcast)│      │  (User Queries)  │
└─────────────────┘      └──────────────────┘
         │                        │
         ▼                        ▼
    ┌────────────────────────────────┐
    │     LINE Official Account      │
    │      (Community Users)         │
    └────────────────────────────────┘
```

## Prerequisites

1. ✅ LINE Official Account created
2. ✅ Messaging API enabled
3. ✅ Supabase project with AQHI data
4. ✅ Channel Access Token and Channel Secret

## Step 1: Database Setup

### 1.1 Create Community Tables and Functions

Run these SQL files in your Supabase SQL Editor (in order):

```sql
-- File: supabase/community-aqhi-functions.sql
-- Creates:
-- - communities table (15 Bangkok districts)
-- - community_stations table (maps stations to communities)
-- - AQHI aggregation functions
-- - Views for quick access
```

**Execute:**
1. Open Supabase Dashboard → SQL Editor
2. Paste contents of `supabase/community-aqhi-functions.sql`
3. Click "Run"

### 1.2 Populate Station Mappings

```sql
-- File: supabase/populate-community-stations.sql
-- Maps air quality stations to communities
```

⚠️ **IMPORTANT:** Before running, verify your station UIDs:

```sql
-- Check your actual station UIDs
SELECT DISTINCT station_uid, name FROM stations ORDER BY name;
```

Update the INSERT statements in `populate-community-stations.sql` with correct UIDs, then run it.

### 1.3 Verify Setup

```sql
-- Check community data
SELECT * FROM communities;

-- Check station mappings
SELECT
    c.name_th,
    COUNT(cs.station_uid) as station_count
FROM communities c
LEFT JOIN community_stations cs ON c.id = cs.community_id
GROUP BY c.id, c.name_th
ORDER BY c.id;

-- Test AQHI function
SELECT * FROM get_all_communities_aqhi();
```

## Step 2: Deploy Supabase Edge Functions

### 2.1 Install Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

### 2.2 Deploy LINE Notify Function

```bash
# Deploy the notification function
supabase functions deploy line-notify-aqhi

# Set environment variables
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=YOUR_CHANNEL_ACCESS_TOKEN
```

### 2.3 Deploy LINE Webhook Function (Optional - for interactive bot)

```bash
# Deploy webhook handler
supabase functions deploy line-webhook

# Set additional secrets
supabase secrets set LINE_CHANNEL_SECRET=YOUR_CHANNEL_SECRET
```

### 2.4 Test the Functions

```bash
# Test notification function
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-notify-aqhi' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"messageType": "summary"}'

# Test specific community
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-notify-aqhi' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"messageType": "community", "communityId": 11}'
```

## Step 3: LINE Official Account Configuration

### 3.1 Get LINE Credentials

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Select your provider → Your channel
3. Copy:
   - **Channel Access Token** (long-lived)
   - **Channel Secret**

### 3.2 Configure Webhook (for interactive bot)

1. In LINE Developers Console → Messaging API
2. Set Webhook URL:
   ```
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-webhook
   ```
3. Enable "Use webhook"
4. Disable "Auto-reply messages" (optional)
5. Enable "Allow bot to join group chats" (if needed)

### 3.3 Test Webhook

Click "Verify" button in LINE console to test connection.

## Step 4: Schedule Automated Reports

### 4.1 Enable pg_cron Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 4.2 Setup Scheduled Jobs

Edit `supabase/setup-line-cron.sql`:

1. Replace `YOUR_PROJECT_REF` with your Supabase project reference
2. Replace `YOUR_ANON_KEY` with your anon/public key
3. Choose your schedule option:

**Option A: Hourly Summary**
```sql
-- Every hour
'0 * * * *'
```

**Option B: Daily Reports (3x per day)**
```sql
-- Morning (7 AM), Noon (12 PM), Evening (6 PM) Bangkok time
'0 0 * * *'   -- 7 AM Bangkok (midnight UTC)
'0 5 * * *'   -- 12 PM Bangkok (5 AM UTC)
'0 11 * * *'  -- 6 PM Bangkok (11 AM UTC)
```

4. Run the SQL file in Supabase SQL Editor

### 4.3 Verify Scheduled Jobs

```sql
-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job execution history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

## Step 5: Testing

### 5.1 Manual Broadcast Test

```bash
# Send summary to all followers
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-notify-aqhi' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"messageType": "summary"}'
```

### 5.2 Interactive Bot Test

1. Add your LINE Official Account as friend
2. Send messages:
   - `สวัสดี` - Greeting
   - `ปทุมวัน` - Query Pathum Wan district
   - `สรุป` - Get summary of all districts
   - `ช่วยเหลือ` - Help message

## Message Types

### Summary Message (All Communities)

Shows ranked list of all 15 Bangkok districts with AQHI values.

**Features:**
- Emoji indicators (😊 😐 😷 🚨)
- Color-coded values
- Sorted by risk level (highest first)
- Timestamp

### Community Detail Message

Shows detailed AQHI for specific district.

**Features:**
- Current AQHI value
- Risk category (Thai)
- Min/Max values
- Health advice (Thai)
- Last updated time

## Customization

### Modify Message Templates

Edit `supabase/functions/line-notify-aqhi/index.ts`:

```typescript
// Change colors
function getAQHIColor(aqhi: number): string {
  if (aqhi <= 3) return "#10b981"; // Customize
  // ...
}

// Change emojis
function getAQHIEmoji(aqhi: number): string {
  if (aqhi <= 3) return "😊"; // Customize
  // ...
}
```

### Add More Communities

1. Update `bangkok-communities.json`
2. Run:
```sql
-- Add new community
INSERT INTO communities (name, name_th)
VALUES ('New District', 'เขตใหม่');

-- Map stations
INSERT INTO community_stations (community_id, station_uid)
VALUES (16, 'station-uid-here');
```

### Change Schedule

```sql
-- Update cron schedule
SELECT cron.schedule(
    'line-aqhi-custom',
    '*/30 * * * *',  -- Every 30 minutes
    $$ ... $$
);
```

## Monitoring & Troubleshooting

### Check Function Logs

```bash
# View logs
supabase functions logs line-notify-aqhi --tail

# View specific invocation
supabase functions logs line-notify-aqhi --limit 50
```

### Common Issues

**1. No data returned**
```sql
-- Check if AQHI data exists
SELECT * FROM latest_station_readings WHERE stored_aqhi IS NOT NULL;
```

**2. Wrong station mappings**
```sql
-- Verify mappings
SELECT c.name_th, cs.station_uid
FROM communities c
JOIN community_stations cs ON c.id = cs.community_id
WHERE c.id = 1;
```

**3. LINE API errors**
- Verify Channel Access Token is valid
- Check token hasn't expired (use long-lived token)
- Verify webhook URL is correct

**4. Cron jobs not running**
```sql
-- Check pg_cron is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check job status
SELECT * FROM cron.job_run_details WHERE status = 'failed';
```

## Cost Considerations

### LINE Messaging API

- **Free tier**: 500 messages/month
- **Paid plans**: From ¥5,000/month (~$35 USD)
- **Broadcasts**: Count per recipient

### Supabase

- **Edge Functions**: 500K invocations/month (free tier)
- **Database**: Included in free tier
- **pg_cron**: No additional cost

### Optimization Tips

1. **Reduce broadcast frequency** - Use 3x daily instead of hourly
2. **Use targeted messages** - Send only to active users
3. **Cache responses** - Implement response caching in Edge Function

## Support Communities

The system supports these 15 Bangkok districts:

1. พระนคร (Phra Nakhon)
2. ธนบุรี (Thon Buri)
3. บางกอกใหญ่ (Bangkok Yai)
4. คลองสาน (Khlong San)
5. บางกอกน้อย (Bangkok Noi)
6. หนองแขม (Nong Khaem)
7. ราษฎร์บูรณะ (Rat Burana)
8. ดินแดง (Din Daeng)
9. พระโขนง (Phra Khanong)
10. หนองจอก (Nong Chok)
11. ปทุมวัน (Pathum Wan)
12. ป้อมปราบศัตรูพ่าย (Pom Prap Sattru Phai)
13. สัมพันธวงศ์ (Samphanthawong)
14. บางพลัด (Bang Phlat)
15. จตุจักร (Chatuchak)

## Next Steps

- [ ] Deploy to production
- [ ] Test with real users
- [ ] Monitor message delivery
- [ ] Adjust schedules based on usage
- [ ] Consider adding alert thresholds (high AQHI warnings)
- [ ] Implement user preferences (subscribe to specific districts)

## Files Reference

```
├── bangkok-communities.json              # Community configuration
├── supabase/
│   ├── community-aqhi-functions.sql     # Database schema
│   ├── populate-community-stations.sql  # Station mappings
│   ├── setup-line-cron.sql             # Cron job setup
│   └── functions/
│       ├── line-notify-aqhi/           # Notification function
│       │   └── index.ts
│       └── line-webhook/               # Interactive bot
│           └── index.ts
└── LINE-INTEGRATION-SETUP.md           # This file
```

## Resources

- [LINE Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)
- [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/)
