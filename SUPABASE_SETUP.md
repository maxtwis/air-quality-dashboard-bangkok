# Supabase Setup Guide

This guide will help you set up Supabase to store air quality data for AQHI calculations using 3-hour moving averages.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: `air-quality-bangkok` (or any name you prefer)
   - **Database Password**: Use a strong password
   - **Region**: Choose closest to your location
5. Click "Create new project"

## 2. Configure Database Schema

1. Go to your Supabase dashboard
2. Click on "SQL Editor" in the left sidebar
3. Copy and paste the entire content of `supabase-schema.sql` into the editor
4. Click "Run" to execute the SQL script

This will create:

- `stations` table - stores station information
- `air_quality_readings` table - stores historical readings
- Database views for 3-hour averages
- Functions for AQHI calculation
- Indexes for performance

## 3. Get Your Credentials

1. Go to "Settings" → "API" in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **Anon key** (long string starting with `eyJ...`)

## 4. Configure Your Application

### Option A: Browser Environment (Recommended)

Update `lib/supabase.js` with your credentials:

```javascript
// Replace these lines in lib/supabase.js:
const supabaseUrl = "https://your-project-id.supabase.co"; // Replace with your URL
const supabaseAnonKey = "your-anon-key-here"; // Replace with your anon key
```

### Option B: Environment Variables (Advanced)

If you want to use environment variables, update your `.env` file:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

Then serve your app with a bundler that supports environment variables.

### Option C: Runtime Configuration

You can also set credentials at runtime by adding this to your HTML before loading the app:

```html
<script>
  window.SUPABASE_URL = "https://your-project-id.supabase.co";
  window.SUPABASE_ANON_KEY = "your-anon-key-here";
</script>
```

## 5. Test the Setup

1. Open your air quality dashboard in the browser
2. Open browser developer tools (F12)
3. Check the console for messages like:
   - ✅ "Supabase connection successful"
   - ✅ "Storage service initialized successfully"
   - ✅ "Stored X air quality readings"

## 6. Verify Data Storage

1. Go to your Supabase dashboard
2. Click on "Table Editor"
3. Check the `stations` table - should start populating with Bangkok stations
4. Check the `air_quality_readings` table - should start collecting data every 10 minutes

## 7. Database Features

### Automatic Data Collection

- Air quality data is automatically stored every 10 minutes
- Stations are automatically registered when first encountered
- Old data (>7 days) is automatically cleaned up

### 3-Hour Moving Averages

- The `current_3h_averages` view provides real-time 3-hour averages
- Used for accurate AQHI calculations
- Automatically updates as new data comes in

### Built-in AQHI Calculation

- Database function `calculate_aqhi()` implements Health Canada formula
- Takes PM2.5, O3, and NO2 values
- Returns scientifically accurate AQHI values

## 8. Monitoring and Maintenance

### Check Storage Status

Open browser console and run:

```javascript
// Check if storage is working
console.log("Storage enabled:", airQualityStorage.isStorageEnabled());

// Get database statistics
airQualityStorage.getStats().then((stats) => console.log("DB Stats:", stats));
```

### Manual Data Cleanup

```javascript
// Clean up old data manually
airQualityStorage.cleanupOldData();
```

## 9. Troubleshooting

### Common Issues

**"Missing Supabase environment variables" Error**

- Make sure you've updated `lib/supabase.js` with your credentials
- Or set `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY` before loading the app

**"Storage service disabled" Warning**

- Check your Supabase credentials are correct
- Verify your project is active and not paused
- Check network connectivity

**No Data in Tables**

- Make sure the API is working (check for stations on the map)
- Wait at least 10 minutes for the first data collection
- Check browser console for error messages

**RLS (Row Level Security) Issues**

- The schema disables RLS by default for public access
- If you enabled RLS, make sure you have appropriate policies

### Support

For issues specific to this implementation, check:

1. Browser console for error messages
2. Supabase dashboard logs
3. Network tab in developer tools

## 10. Advanced Features

### Custom AQHI Thresholds

You can modify the AQHI calculation in `js/aqhi-enhanced.js` to use different thresholds or formulas.

### Data Export

Use Supabase dashboard to export historical data in CSV format for analysis.

### API Access

All data is accessible via Supabase's REST API for integration with other tools.

---

**Next Steps**: Once configured, your dashboard will automatically start collecting and using 3-hour moving averages for more accurate AQHI calculations!
