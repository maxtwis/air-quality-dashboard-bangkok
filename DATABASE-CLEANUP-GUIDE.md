# Database Cleanup Guide - Remove AQI Data

## Current Status

**Problem**: Supabase free tier database limit exceeded
- **waqi_data table**: 1,434,245 records (~684 MB)
- **Includes AQI column**: Taking up unnecessary space
- **Most data is old**: Only need last 7 days for AQHI calculations

## Solution Overview

Remove AQI data from the database and application to:
1. **Reduce database size** by 90-95% (from ~684 MB to ~3-5 MB)
2. **Free up storage** for future data collection
3. **Simplify application** by focusing on AQHI only

## Step 1: Database Cleanup

⚠️ **TIMEOUT ISSUE**: The original `cleanup-database-complete.sql` script causes timeout errors with 1.4M records. Use one of these alternatives:

### Option A: JavaScript API Cleanup (RECOMMENDED ✅)

Run the Node.js script that deletes records in small batches via Supabase API:

```bash
node cleanup-via-api.js
```

**Features:**
- Deletes records older than 7 days in batches of 1000
- Progress tracking with percentage complete
- No SQL timeout errors
- Safe and automatic
- Takes ~10-20 minutes to complete

**Expected result**: ~10,000-15,000 records

**Next step**: After completion, run `cleanup-remove-aqi-column.sql` to remove AQI column

### Option B: Ultra-Batched SQL (Manual but Reliable)

Run `cleanup-ultra-batched.sql` **ONE STATEMENT AT A TIME** in Supabase SQL Editor:

**Important**: Copy and run each DELETE statement separately, waiting for completion before the next

**Expected result**: ~10,000-15,000 records

**Next step**: After completion, run `cleanup-remove-aqi-column.sql` to remove AQI column

### Option C: Just Remove AQI Column (No Deletion)

Run `cleanup-aqi-data.sql` in Supabase SQL Editor:
- Keeps all 1.4M historical records
- Only removes AQI column and indexes

**Expected result**: 1,434,245 records (~550-600 MB) - saves ~15-20%

⚠️ **Not recommended** - Still exceeds free tier limits

### Option D: ~~Complete Cleanup SQL~~ (DEPRECATED)

~~`cleanup-database-complete.sql`~~ - **DO NOT USE** - Causes timeout with large datasets

## Step 2: Application Code Updates

After database cleanup, update the application to remove AQI references:

### Files to Update:

1. **index.html** (Line 105-118)
   - Remove AQI/AQHI toggle buttons
   - Update text to show "AQHI only"

2. **js/ui.js**
   - Remove AQI circle rendering code
   - Simplify to AQHI-only display

3. **js/statistics.js**
   - Remove AQI statistics calculations
   - Keep only AQHI stats

4. **js/markers.js**
   - Remove AQI marker coloring
   - Use only AQHI levels

5. **js/config.js**
   - Remove AQI configuration
   - Set default to AQHI only

6. **lib/supabase.js**
   - Remove AQI column from queries
   - Update views to exclude AQI

## Step 3: Verification

### Check Database

```bash
node list-all-tables.js
```

Expected output:
- waqi_data: ~10,000-15,000 records
- No AQI column in table structure

### Check Application

1. Open the dashboard in browser
2. Verify:
   - No AQI toggle button
   - All markers show AQHI values
   - Statistics show AQHI only
   - No errors in console

## Step 4: Prevent Future Data Growth

### Set Up Auto-Cleanup

Add this function to Supabase and schedule it to run daily:

```sql
-- Create function to auto-cleanup old data
CREATE OR REPLACE FUNCTION auto_cleanup_old_data()
RETURNS void AS $$
BEGIN
  DELETE FROM waqi_data
  WHERE timestamp < NOW() - INTERVAL '7 days';

  VACUUM ANALYZE waqi_data;
END;
$$ LANGUAGE plpgsql;

-- Schedule to run daily (use pg_cron extension)
-- SELECT cron.schedule('daily-cleanup', '0 2 * * *', 'SELECT auto_cleanup_old_data()');
```

### Update Data Collection

Modify data collection scripts to:
- Skip AQI field when inserting data
- Focus on pollutant concentrations for AQHI

## Rollback Plan

If you need to restore AQI functionality:

1. Add AQI column back:
```sql
ALTER TABLE waqi_data ADD COLUMN aqi INTEGER;
CREATE INDEX idx_waqi_aqi ON waqi_data(aqi);
```

2. Restore AQI toggle in HTML (line 105-118)
3. Re-enable AQI mode in application code

## Files Created

**Cleanup Scripts:**
- ✅ `cleanup-via-api.js` - **RECOMMENDED** - Delete via API in batches (no timeout)
- ✅ `cleanup-ultra-batched.sql` - Delete in small SQL batches (manual)
- ✅ `cleanup-remove-aqi-column.sql` - Remove AQI column after deletion
- ✅ `cleanup-aqi-data.sql` - Remove AQI column only (no deletion)
- ⚠️ `cleanup-database-complete.sql` - DEPRECATED (causes timeout)
- ⚠️ `cleanup-old-records.sql` - DEPRECATED (causes timeout)

**Verification Scripts:**
- ✅ `verify-waqi-table.js` - Check table structure
- ✅ `list-all-tables.js` - List all tables and sizes
- ✅ `check-waqi-table.js` - Check waqi_data table details

## Next Steps

1. **Choose cleanup option** (A, B, or C above)
2. **Run SQL script** in Supabase SQL Editor
3. **Update application code** to remove AQI references
4. **Test thoroughly** before deploying
5. **Set up auto-cleanup** to prevent future growth

## Questions?

- How much history do you need? (7 days is recommended for AQHI)
- Do you want to keep AQI as an option? (not recommended)
- Should we set up auto-cleanup? (highly recommended)
