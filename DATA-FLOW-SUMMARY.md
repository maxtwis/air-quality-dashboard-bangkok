# Air Quality Data Flow and Unit Conversion

**Updated**: January 2025

This document explains how air quality data flows through the system, where unit conversions happen, and how AQHI is calculated.

---

## Overview

The system has **two parallel data paths**:

1. **Client-Side Path** (Real-time display)
2. **Server-Side Path** (Supabase data collection via cron)

Both paths now use the **same formula** for Thai AQHI calculation.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    WAQI API (aqicn.org)                    │
│          Returns AQI values (0-500 scale) + metadata       │
└─────────────────┬───────────────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌────────────────┐   ┌────────────────────────────────┐
│  CLIENT-SIDE   │   │       SERVER-SIDE (CRON)       │
│   (Browser)    │   │  api/collect-data.js (Vercel)  │
└────────┬───────┘   └────────┬───────────────────────┘
         │                    │
         │                    ▼
         │           ┌────────────────────────────┐
         │           │ lib/thai-aqhi-converter.js │
         │           │ AQI → Thai AQHI units:     │
         │           │ • PM2.5: AQI → μg/m³       │
         │           │ • O3: AQI → ppb            │
         │           │ • NO2: AQI → ppb           │
         │           └────────┬───────────────────┘
         │                    │
         ▼                    ▼
┌──────────────────┐   ┌──────────────────────┐
│ js/aqi-to-       │   │   Supabase DB        │
│ concentration.js │   │   (waqi_data table)  │
│                  │   │                      │
│ AQI → μg/m³      │   │ Stores:              │
│ (all pollutants) │   │ • PM2.5: μg/m³       │
└────────┬─────────┘   │ • O3: ppb            │
         │             │ • NO2: ppb           │
         │             │ • Timestamp          │
         │             │ • Station metadata   │
         ▼             └──────────┬───────────┘
┌──────────────────┐             │
│ getConcentration │             │
│ ForAQHI()        │             │
│                  │             │
│ μg/m³ → ppb      │◄────────────┘
│ (for O3/NO2)     │  (Client reads from DB)
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│        Thai AQHI Calculation               │
│   js/aqhi-supabase.js & aqhi-realistic.js  │
│                                            │
│   Formula: AQHI = (10/C) × Total %ER       │
│   %ER_i = 100 × (e^(βi × xi) - 1)          │
│                                            │
│   Inputs:                                  │
│   • PM2.5: μg/m³                           │
│   • O3: ppb                                │
│   • NO2: ppb                               │
└────────────────────────────────────────────┘
```

---

## Path 1: Server-Side Data Collection (Cron Job)

**Frequency**: Every 10 minutes (configured in Vercel cron)

### Step-by-Step Process

1. **Trigger**: Vercel cron job calls `api/collect-data.js`

2. **Fetch from WAQI**:

   ```javascript
   // api/collect-data.js:59
   const response = await fetch(
     `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&token=${apiToken}`,
   );
   ```

   Returns: AQI values for all stations in Bangkok

3. **Convert to Thai AQHI Units**:

   ```javascript
   // api/collect-data.js:192
   const { convertStationDataForThaiAQHI } = await import(
     "../lib/thai-aqhi-converter.js"
   );
   const convertedConcentrations = convertStationDataForThaiAQHI(stationData);
   ```

   **lib/thai-aqhi-converter.js** performs:
   - PM2.5: `AQI → μg/m³` (EPA formula, already in correct unit)
   - O3: `AQI → ppm → ppb` (multiply by 1000)
   - NO2: `AQI → ppb` (EPA formula, already in correct unit)

4. **Store in Supabase**:

   ```javascript
   // api/collect-data.js:239-244
   const reading = {
     station_uid: parseInt(station.station_uid),
     timestamp: timestamp,
     pm25: convertedConcentrations.pm25 || null, // μg/m³
     o3: convertedConcentrations.o3 || null, // ppb
     no2: convertedConcentrations.no2 || null, // ppb
   };
   ```

5. **Database Storage**:
   ```sql
   -- Supabase waqi_data table
   CREATE TABLE waqi_data (
     station_uid INTEGER,
     timestamp TIMESTAMPTZ,
     pm25 NUMERIC,  -- μg/m³
     pm10 NUMERIC,  -- μg/m³
     o3 NUMERIC,    -- ppb ✅
     no2 NUMERIC,   -- ppb ✅
     so2 NUMERIC,   -- ppb
     co NUMERIC     -- mg/m³
   );
   ```

**Result**: Data stored in Supabase is **already in Thai AQHI-required units**:

- ✅ PM2.5 in μg/m³
- ✅ O3 in ppb
- ✅ NO2 in ppb

---

## Path 2: Client-Side Real-Time Display

**When**: User loads the dashboard or every 10-minute auto-refresh

### Step-by-Step Process

1. **Fetch from WAQI** (browser):

   ```javascript
   // js/api.js
   const response = await fetch(
     `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&token=${token}`,
   );
   ```

   Returns: AQI values for all stations

2. **Convert AQI to μg/m³** (for all pollutants):

   ```javascript
   // js/aqi-to-concentration.js:173
   export function convertStationToRawConcentrations(station) {
     // Converts all AQI values to μg/m³ for storage/display
     // Uses EPA breakpoints and linear interpolation
   }
   ```

   This creates:
   - PM2.5: μg/m³ ✅
   - O3: μg/m³ (NOT ppb yet!)
   - NO2: μg/m³ (NOT ppb yet!)

3. **Convert to AQHI-Required Units**:

   ```javascript
   // js/aqi-to-concentration.js:254
   export function getConcentrationForAQHI(stationData, pollutant) {
     // PM2.5: Keep as μg/m³ ✅
     if (pollutant === "pm25") {
       return concInUgM3;
     }

     // O3: Convert μg/m³ → ppb
     if (pollutant === "o3") {
       const ppm = concInUgM3 / 1962;
       const ppb = ppm * 1000;
       return ppb;
     }

     // NO2: Convert μg/m³ → ppb
     if (pollutant === "no2") {
       const ppb = concInUgM3 / 1.88;
       return ppb;
     }
   }
   ```

4. **Calculate AQHI**:

   ```javascript
   // js/aqhi-supabase.js:49
   export function calculateThaiAQHI(pm25, no2, o3) {
     // pm25 is in μg/m³
     // no2 is in ppb
     // o3 is in ppb

     const perErPM25 = pm25 ? 100 * (Math.exp(0.0012 * pm25) - 1) : 0;
     const perErO3 = o3 ? 100 * (Math.exp(0.001 * o3) - 1) : 0;
     const perErNO2 = no2 ? 100 * (Math.exp(0.0052 * no2) - 1) : 0;

     const totalPerER = perErPM25 + perErO3 + perErNO2;
     const aqhi = (10 / 105.19) * totalPerER;

     return Math.max(1, Math.round(aqhi));
   }
   ```

---

## Thai AQHI Formula (Official)

### Mathematical Formula

```
AQHI = (10 / C) × Total %ER

Where:
  C = 105.19 (Thai scaling constant)
  Total %ER = %ER_PM2.5 + %ER_O3 + %ER_NO2

  %ER_i = 100 × (e^(βi × xi) - 1)

Coefficients (β):
  β_PM2.5 = 0.0012 per μg/m³
  β_O3 = 0.0010 per ppb
  β_NO2 = 0.0052 per ppb
```

### Required Units

| Pollutant | Required Unit | Why                                   |
| --------- | ------------- | ------------------------------------- |
| PM2.5     | μg/m³         | Beta coefficient calibrated for μg/m³ |
| O3        | ppb           | Beta coefficient calibrated for ppb   |
| NO2       | ppb           | Beta coefficient calibrated for ppb   |

**Critical**: Using wrong units will produce incorrect AQHI values!

---

## Example Calculation

### Input (from WAQI):

- PM2.5 AQI = 98
- NO2 AQI = 42
- O3 AQI = 35

### Step 1: Convert AQI to concentrations

**PM2.5**:

```
AQI 98 → 34.8 μg/m³ (using EPA breakpoints)
```

**NO2**:

```
AQI 42 → 44.5 ppb (using EPA breakpoints)
```

**O3**:

```
AQI 35 → 0.0378 ppm → 37.8 ppb (using EPA breakpoints)
```

### Step 2: Calculate %ER for each pollutant

```
%ER_PM2.5 = 100 × (e^(0.0012 × 34.8) - 1) = 4.26%
%ER_NO2 = 100 × (e^(0.0052 × 44.5) - 1) = 26.08%
%ER_O3 = 100 × (e^(0.0010 × 37.8) - 1) = 3.85%
```

### Step 3: Calculate AQHI

```
Total %ER = 4.26 + 26.08 + 3.85 = 34.19%
AQHI = (10 / 105.19) × 34.19 = 3.25 ≈ 3
```

**Result**: AQHI = **3** (Low Risk)

---

## Unit Conversion Reference

### EPA Breakpoints to Concentrations

| Pollutant | EPA Native Unit | Conversion to Thai AQHI Unit |
| --------- | --------------- | ---------------------------- |
| PM2.5     | μg/m³           | No conversion needed ✓       |
| PM10      | μg/m³           | No conversion needed ✓       |
| O3        | ppm             | Multiply by 1000 → ppb       |
| NO2       | ppb             | No conversion needed ✓       |
| SO2       | ppb             | No conversion needed ✓       |
| CO        | ppm             | Multiply by 1000 → ppb       |

### Molecular Weight Conversions

At 25°C, 1 atm:

| Gas | Conversion Factor  |
| --- | ------------------ |
| O3  | 1 ppm = 1962 μg/m³ |
| NO2 | 1 ppb = 1.88 μg/m³ |
| SO2 | 1 ppb = 2.62 μg/m³ |
| CO  | 1 ppm = 1.15 mg/m³ |

---

## Database Views for 3-Hour Averages

Supabase automatically calculates 3-hour moving averages:

```sql
-- View: combined_3h_averages
CREATE VIEW combined_3h_averages AS
SELECT
  station_uid,
  AVG(pm25) as avg_pm25,    -- Already in μg/m³
  AVG(pm10) as avg_pm10,    -- Already in μg/m³
  AVG(o3) as avg_o3,        -- Already in ppb ✅
  AVG(no2) as avg_no2,      -- Already in ppb ✅
  AVG(so2) as avg_so2,      -- Already in ppb
  AVG(co) as avg_co,        -- Already in mg/m³
  COUNT(*) as reading_count
FROM waqi_data
WHERE timestamp > NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;
```

**Result**: 3-hour averages are **already in correct units** for Thai AQHI calculation!

---

## Key Files

### Server-Side

- **api/collect-data.js** - Cron job entry point
- **lib/thai-aqhi-converter.js** - AQI → Thai AQHI units conversion

### Client-Side

- **js/aqi-to-concentration.js** - AQI → μg/m³, then μg/m³ → ppb for O3/NO2
- **js/aqhi-supabase.js** - Main AQHI calculation with Supabase
- **js/aqhi-realistic.js** - Fallback AQHI calculation with localStorage

### Database

- **supabase-schema.sql** - Database schema with views
- **Table**: `waqi_data` - Stores pollutant concentrations in Thai AQHI units
- **View**: `combined_3h_averages` - Pre-calculated 3-hour moving averages

---

## Quality Assurance

### Both Paths Use Same Formula ✅

**Server-side** (lib/thai-aqhi-converter.js:162-170):

```javascript
const perErPM25 = pm25 ? 100 * (Math.exp(0.0012 * pm25) - 1) : 0;
const perErO3 = o3 ? 100 * (Math.exp(0.001 * o3) - 1) : 0;
const perErNO2 = no2 ? 100 * (Math.exp(0.0052 * no2) - 1) : 0;
const totalPerER = perErPM25 + perErO3 + perErNO2;
const aqhi = (10 / 105.19) * totalPerER;
```

**Client-side** (js/aqhi-supabase.js:54-62):

```javascript
const perErPM25 = pm25 ? 100 * (Math.exp(0.0012 * pm25) - 1) : 0;
const perErO3 = o3 ? 100 * (Math.exp(0.001 * o3) - 1) : 0;
const perErNO2 = no2 ? 100 * (Math.exp(0.0052 * no2) - 1) : 0;
const totalPerER = perErPM25 + perErO3 + perErNO2;
const aqhi = (10 / 105.19) * totalPerER;
```

**Identical!** ✅

### Both Paths Use Correct Units ✅

**Server-side storage**:

- PM2.5: μg/m³ ✅
- O3: ppb ✅
- NO2: ppb ✅

**Client-side calculation**:

- PM2.5: μg/m³ (via `getConcentrationForAQHI`) ✅
- O3: ppb (via `getConcentrationForAQHI`) ✅
- NO2: ppb (via `getConcentrationForAQHI`) ✅

---

## Summary

✅ **Server-side cron job** converts AQI to Thai AQHI units **before** storing in Supabase
✅ **Client-side code** converts μg/m³ to ppb for O3/NO2 **before** AQHI calculation
✅ **Same formula** used on both server and client
✅ **Same units** used for calculation (PM2.5 μg/m³, O3/NO2 ppb)
✅ **Database stores** data in Thai AQHI-required units
✅ **3-hour averages** are automatically calculated in the database in correct units

**Result**: Consistent, accurate Thai AQHI values across the entire system! 🎯

---

**Last Updated**: January 2025
**Version**: 2.0
**Status**: ✅ All conversions verified and documented
