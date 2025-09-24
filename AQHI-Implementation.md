# AQHI Implementation for Real-World API Constraints

## Overview

This document explains how we've implemented AQHI (Air Quality Health Index) calculations in the Bangkok Air Quality Dashboard while dealing with real-world API limitations.

## The Challenge: No Historical Data from WAQI API

**Problem**: AQHI should be calculated using 3-hour moving averages of pollutant concentrations, but:

- WAQI API only provides current/latest readings
- No historical data access for individual requests
- We need PM2.5, NO₂, O₃, and SO₂ data for proper AQHI calculation

## Our Solutions

### 1. Client-Side Data Collection 🔄

**How it works**:

- Dashboard refreshes every 10 minutes (configurable)
- We store each reading in browser localStorage
- Build our own 3-hour moving average over time
- After 3 hours of operation, we have true 3-hour averages

**Benefits**:

- Scientifically accurate after 3+ hours
- Persistent across browser sessions
- Automatic data cleanup (removes >3h old data)

**Timeline**:

- **First 10 minutes**: Uses current readings with estimation
- **1+ hours**: Uses partial moving average (improving accuracy)
- **3+ hours**: Full 3-hour moving average (scientifically accurate)

### 2. Estimation Methods 📊

For immediate AQHI values when we don't have historical data yet:

**Estimation Approach**:

- Applies variability factors to current readings
- Uses seasonal and time-of-day adjustments
- Shows clear indication that values are estimated

**Formula for Estimation**:

```javascript
estimated_value = current_value × seasonal_factor × time_factor ± variability
```

### 3. Comprehensive AQHI Formula

**Complete Formula** (includes all 4 pollutants):

```
AQHI = (10/105.19) × [
  100 × (exp(0.0012 × PM2.5_3hr) - 1) +
  (exp(0.001 × O3_3hr) - 1) +
  (exp(0.0052 × NO2_3hr) - 1) +
  (exp(0.0038 × SO2_3hr) - 1)
]
```

**Where**:

- PM2.5_3hr, NO2_3hr, O3_3hr, SO2_3hr are 3-hour moving averages
- β coefficients are based on health impact studies
- C = 105.19 (scaling constant)

## Data Quality Indicators

The system provides transparent data quality feedback:

### Quality Levels

- **🎯 Excellent**: 3+ hours of data, 15+ readings
- **✅ Good**: 2+ hours of data, 10+ readings
- **⏳ Fair**: 1+ hours of data, 5+ readings
- **🔄 Limited**: Building data, <1 hour
- **📊 Estimated**: Using current reading estimation

### Calculation Methods

1. **Current**: Using current readings (first visit)
2. **Estimated**: Using estimation algorithms
3. **Client-Average**: Using our collected moving average

## User Interface Features

### 1. Indicator Toggle

- Switch between AQI and AQHI modes
- Clear labeling of which indicator is active

### 2. Data Quality Display

- Real-time feedback on calculation method
- Progress indicators for data collection
- Warnings about missing sensors

### 3. Statistics Panel

- Breakdown of stations by data quality
- Number of stations using each calculation method
- Missing pollutant sensor information

## Technical Implementation

### Files Structure

```
js/
├── aqhi-realistic.js     # Main AQHI implementation
├── dataStore.js          # localStorage persistence
├── api.js               # Enhanced API calls
├── ui.js                # UI updates for AQHI
└── statistics.js        # AQHI statistics
```

### Key Functions

- `calculateStationAQHIRealistic()`: Main calculation with fallbacks
- `collectCurrentReading()`: Store current readings
- `calculateClientSideMovingAverage()`: Build moving averages
- `estimateMovingAverage()`: Fallback estimation

## Limitations & Considerations

### Current Limitations

1. **First 3 hours**: Not scientifically accurate (using estimation)
2. **Missing sensors**: Some stations lack NO₂, O₃, or SO₂ sensors
3. **Browser dependency**: Data stored locally (doesn't persist across devices)

### Future Enhancements

1. **Alternative APIs**: Integration with OpenWeatherMap, Google Air Quality
2. **Server-side storage**: For cross-device persistence
3. **Machine learning**: Better estimation algorithms
4. **Sensor network expansion**: More comprehensive pollutant coverage

## Alternative API Options

### OpenWeatherMap Air Pollution API

- Provides historical data up to 1 year
- Includes PM2.5, PM10, CO, NO, NO₂, O₃, SO₂, NH₃
- Hourly granularity perfect for 3-hour averages

### Google Air Quality API

- Historical data up to 30 days
- Hourly resolution
- Professional-grade accuracy

### BreezoMeter API

- Real-time and historical data
- Customizable time periods
- High precision pollution data

## Usage Instructions

### For Developers

1. The system automatically initializes on first data fetch
2. No additional configuration needed
3. Data quality improves automatically over time
4. Check `station.aqhi.calculationMethod` for current method

### For Users

1. **First visit**: AQHI shows estimated values
2. **After 1+ hours**: Partial averages with quality indicators
3. **After 3+ hours**: Full scientific accuracy
4. Toggle between AQI/AQHI using the sidebar switch

## Conclusion

While we can't get historical data from WAQI API directly, our implementation provides:

✅ **Immediate AQHI values** (with clear quality indicators)  
✅ **Progressive accuracy improvement** over time  
✅ **Scientific accuracy after 3+ hours** of operation  
✅ **Transparent data quality feedback**  
✅ **Graceful handling of missing sensors**

This approach balances scientific accuracy with practical usability, providing meaningful AQHI values from day one while building toward full accuracy over time.

---

**Last Updated**: September 2025  
**Version**: 1.0  
**Dashboard**: Bangkok Air Quality Monitor
