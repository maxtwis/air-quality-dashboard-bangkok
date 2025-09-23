# O3 and NO2 Data Enhancement for AQHI Calculations

## Problem Statement

Many air quality monitoring stations in Bangkok lack O3 (ozone) and NO2 (nitrogen dioxide) readings, which are essential components of the Air Quality Health Index (AQHI) formula. This limits the accuracy of AQHI calculations for stations that only provide PM2.5 data.

## Recommended Solution: OpenWeather API with Coordinate-Based Fallback

### Why OpenWeather API?

- **Free tier**: Up to 1,000 calls/day
- **Comprehensive data**: O3, NO2, CO, SO2, PM2.5, PM10
- **Global coverage**: Includes Bangkok coordinates
- **Multiple time periods**: Current, forecast (4 days), and historical data
- **Standard format**: JSON with concentrations in μg/m³

### Why Coordinate-Based Fallback?

#### ✅ **Advantages**
1. **Simple Implementation** - Direct API call per station when needed
2. **More Accurate** - Gets pollutant data at exact station coordinates
3. **Cost-Efficient** - Only calls API when O3/NO2 is missing
4. **Better Data Quality** - Station-quality meteorological data
5. **Easy Integration** - Fits existing station-by-station processing

#### ❌ **Area Interpolation (Not Recommended)**
- Complex grid interpolation algorithms required
- Less accurate for health-focused AQHI calculations
- Over-engineering for Bangkok's station density
- Higher API usage with multiple grid calls

## Implementation Strategy

### Integration Point
Modify `aqhi-supabase.js` around line 260 in the station processing logic:

```javascript
// Current logic
if (averages && (averages.pm25 || averages.o3 || averages.no2)) {
    // Use stored 3-hour averages
    aqhiValue = calculateFromStoredData(averages);
} else {
    // NEW: Add OpenWeather fallback before realistic calculation
    const supplementaryData = await getOpenWeatherFallback(station);
    if (supplementaryData) {
        aqhiValue = calculateWithSupplementaryData(station, supplementaryData);
    } else {
        // Existing fallback to realistic calculation
        aqhiValue = calculateStationAQHIRealistic(station);
    }
}
```

### Required Components

#### 1. OpenWeather API Configuration
```javascript
// Add to js/config.js
export const OPENWEATHER_CONFIG = {
    API_KEY: 'YOUR_API_KEY', // Register at openweathermap.org
    API_URL: 'http://api.openweathermap.org/data/2.5/air_pollution',
    CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
    MAX_REQUESTS_PER_DAY: 1000
};
```

#### 2. OpenWeather API Client
```javascript
// New file: js/openweather-api.js
class OpenWeatherAirPollution {
    constructor() {
        this.cache = new Map();
        this.requestCount = 0;
        this.resetTime = Date.now() + 24 * 60 * 60 * 1000;
    }

    async getPollutionData(lat, lon) {
        // Implementation details:
        // - Check cache first
        // - Respect rate limits
        // - Handle API errors gracefully
        // - Return standardized format
    }

    formatForAQHI(apiResponse) {
        // Convert OpenWeather format to AQHI-compatible data
        // Units: μg/m³ for all pollutants
    }
}
```

#### 3. Fallback Logic
```javascript
// Add to aqhi-supabase.js
async function getOpenWeatherFallback(station) {
    // Only call if missing critical AQHI pollutants
    const needsO3 = !station.iaqi?.o3 && !averages?.o3;
    const needsNO2 = !station.iaqi?.no2 && !averages?.no2;

    if (needsO3 || needsNO2) {
        return await openWeatherClient.getPollutionData(
            station.lat,
            station.lon
        );
    }
    return null;
}
```

#### 4. Enhanced AQHI Calculation
```javascript
function calculateWithSupplementaryData(station, supplementaryData) {
    // Merge station data with OpenWeather data
    const mergedData = {
        pm25: station.iaqi?.pm25?.v || supplementaryData.pm25,
        o3: station.iaqi?.o3?.v || supplementaryData.o3,
        no2: station.iaqi?.no2?.v || supplementaryData.no2
    };

    // Apply Health Canada AQHI formula
    let aqhi = 0;
    if (mergedData.pm25) aqhi += (Math.exp(0.000487 * mergedData.pm25) - 1);
    if (mergedData.o3) aqhi += (Math.exp(0.000871 * mergedData.o3) - 1);
    if (mergedData.no2) aqhi += (Math.exp(0.000537 * mergedData.no2) - 1);

    return Math.max(0, Math.round((10.0 / 10.4) * 100 * aqhi));
}
```

## Data Quality Indicators

Update the existing data quality system to reflect supplementary data sources:

```javascript
// Enhanced quality indicators
const QUALITY_LEVELS = {
    EXCELLENT: { icon: '🎯', label: 'Excellent', source: '3h stored avg' },
    GOOD: { icon: '✅', label: 'Good', source: '2h stored avg' },
    FAIR: { icon: '⏳', label: 'Fair', source: '1h stored avg' },
    SUPPLEMENTED: { icon: '🌐', label: 'Enhanced', source: 'Station + OpenWeather' },
    LIMITED: { icon: '🔄', label: 'Limited', source: 'Building data' },
    ESTIMATED: { icon: '📊', label: 'Estimated', source: 'Current estimation' }
};
```

## Expected Benefits

### 1. **Improved AQHI Coverage**
- Stations with only PM2.5 will get complete AQHI calculations
- More accurate health risk assessments
- Reduced reliance on estimation algorithms

### 2. **Better User Experience**
- Consistent AQHI availability across all stations
- Clear data quality indicators
- More reliable health recommendations

### 3. **Enhanced Data Reliability**
- Multiple data sources provide redundancy
- Fallback chain ensures AQHI is always calculated
- Scientific accuracy maintained with real pollutant data

## Implementation Checklist

- [ ] Register for OpenWeather API key
- [ ] Add OpenWeather configuration to `js/config.js`
- [ ] Create `js/openweather-api.js` client
- [ ] Modify `aqhi-supabase.js` with fallback logic
- [ ] Update data quality indicators
- [ ] Add caching for API responses
- [ ] Implement rate limiting protection
- [ ] Test with stations lacking O3/NO2
- [ ] Monitor API usage and performance
- [ ] Update UI to show data source information

## Alternative APIs (Backup Options)

### AQICN API
- Same data source as current WAQI integration
- 1,000 requests/second free tier
- Familiar data format

### Open-Meteo Air Quality API
- 10,000 calls/day for non-commercial use
- High reliability and performance
- European weather service quality

## Notes

- Implementation should maintain backward compatibility
- Consider implementing request batching for multiple stations
- Monitor API quotas and implement graceful degradation
- Store supplementary data in Supabase for future 3-hour averages
- Test thoroughly with various station data scenarios

---

**Created**: 2025-01-23
**Status**: Ready for Implementation
**Priority**: High - Improves AQHI accuracy significantly