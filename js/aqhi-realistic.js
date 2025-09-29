// Realistic AQHI Implementation for Real-World API Limitations
// Since WAQI API doesn't provide historical data, we'll implement practical solutions

import {
  saveHistoricalData,
  loadHistoricalData,
  initializeDataStore,
} from './dataStore.js';
import {
  convertStationToRawConcentrations,
  getRawConcentration
} from './aqi-to-concentration.js';

// AQHI Parameters (reverted to original Thai values)
const AQHI_PARAMS = {
  C: 1,  
  beta: {
    pm25: 0.0012,  
    o3: 0.0010, 
    no2: 0.0052, 
  },
};

// AQHI Categories (Thai documentation standards matching AQI colors)
export const AQHI_LEVELS = {
  LOW: {
    min: 0,
    max: 3.9,
    color: '#10b981',
    label: 'Low',
    description: 'Ideal air quality for outdoor activities',
  },
  MODERATE: {
    min: 4,
    max: 6.9,
    color: '#f59e0b',
    label: 'Moderate',
    description:
      'No need to modify outdoor activities unless experiencing symptoms',
  },
  HIGH: {
    min: 7,
    max: 10.9,
    color: '#ef4444',
    label: 'High',
    description:
      'Consider reducing or rescheduling strenuous outdoor activities',
  },
  VERY_HIGH: {
    min: 11,
    max: Infinity,
    color: '#7f1d1d',
    label: 'Very High',
    description: 'Reduce or reschedule strenuous outdoor activities',
  },
};

// Client-side data storage
let clientHistoricalData = initializeDataStore();

/**
 * SOLUTION 1: Client-Side 3-Hour Collection
 * Collect current readings every 10 minutes to build our own 3-hour average
 */
export function collectCurrentReading(
  stationId,
  pollutants,
  timestamp = new Date(),
) {
  if (!clientHistoricalData.has(stationId)) {
    clientHistoricalData.set(stationId, []);
  }

  const stationHistory = clientHistoricalData.get(stationId);

  // Add current reading
  stationHistory.push({ timestamp, pollutants });

  // Keep only last 3 hours (18 readings at 10-minute intervals)
  const threeHoursAgo = new Date(timestamp.getTime() - 3 * 60 * 60 * 1000);
  const filtered = stationHistory.filter(
    (entry) => entry.timestamp > threeHoursAgo,
  );
  clientHistoricalData.set(stationId, filtered);

  saveHistoricalData(clientHistoricalData);
  return filtered.length;
}

/**
 * Calculate moving average from collected client-side data
 */
export function calculateClientSideMovingAverage(stationId) {
  const stationHistory = clientHistoricalData.get(stationId) || [];

  if (stationHistory.length === 0) return null;

  // Calculate averages from available data
  const sums = { pm25: 0, no2: 0, o3: 0 };
  const counts = { pm25: 0, no2: 0, o3: 0 };

  stationHistory.forEach((entry) => {
    Object.keys(sums).forEach((pollutant) => {
      if (entry.pollutants[pollutant] > 0) {
        sums[pollutant] += entry.pollutants[pollutant];
        counts[pollutant]++;
      }
    });
  });

  const averages = {};
  Object.keys(sums).forEach((pollutant) => {
    averages[pollutant] =
      counts[pollutant] > 0 ? sums[pollutant] / counts[pollutant] : 0;
  });

  const timeSpanHours =
    stationHistory.length > 0
      ? (new Date() - stationHistory[0].timestamp) / (1000 * 60 * 60)
      : 0;

  return {
    ...averages,
    dataPoints: stationHistory.length,
    timeSpanHours,
    quality: getDataQuality(timeSpanHours, stationHistory.length),
  };
}

/**
 * SOLUTION 2: Estimation Methods for Immediate Use
 * When we don't have 3 hours of data yet
 */
export function estimateMovingAverage(currentReading, options = {}) {
  const {
    variabilityFactor = 0.15, // Assume 15% variability
    seasonalAdjustment = 1.0, // Seasonal adjustment factor
    timeOfDayAdjustment = 1.0, // Time-of-day adjustment
  } = options;

  // Simple estimation: current reading ± some variability
  const estimated = {};
  Object.keys(currentReading).forEach((pollutant) => {
    const current = currentReading[pollutant];
    const variation = current * variabilityFactor;

    // Apply adjustments
    estimated[pollutant] = Math.max(
      0,
      current * seasonalAdjustment * timeOfDayAdjustment +
        (Math.random() - 0.5) * variation * 2,
    );
  });

  return estimated;
}

/**
 * SOLUTION 3: Alternative API Integration
 * Prepare structure for other APIs that might have historical data
 */
export async function fetchFromAlternativeAPI(location, options = {}) {
  // Placeholder for alternative APIs like:
  // - Google Air Quality API
  // - OpenWeatherMap Air Pollution API
  // - BreezoMeter API

  const { apiType = 'openweather', hours = 3 } = options;

  try {
    switch (apiType) {
      case 'openweather':
        // return await fetchOpenWeatherHistorical(location, hours);
        console.log('OpenWeatherMap API integration not implemented yet');
        return null;

      case 'google':
        // return await fetchGoogleAirQuality(location, hours);
        console.log('Google Air Quality API integration not implemented yet');
        return null;

      default:
        return null;
    }
  } catch (error) {
    console.error(`Error fetching from ${apiType}:`, error);
    return null;
  }
}

/**
 * Calculate AQHI with realistic approach using RAW CONCENTRATIONS (μg/m³)
 * CRITICAL: This function expects raw concentrations, NOT AQI values!
 *
 * @param {number} pm25 - PM2.5 concentration in μg/m³ (NOT AQI!)
 * @param {number} no2 - NO2 concentration in μg/m³ (NOT AQI!)
 * @param {number} o3 - O3 concentration in μg/m³ (NOT AQI!)
 * @returns {number} AQHI value (0-10+)
 */
export function calculateRealisticAQHI(pm25, no2, o3) {
  console.log(`🧮 Calculating AQHI with RAW concentrations: PM2.5=${pm25}μg/m³, NO2=${no2}μg/m³, O3=${o3}μg/m³`);

  // Correct AQHI formula: AQHI = (10/c) × 100 × [sum of excess risk terms]
  const riskPM25 = pm25 ? Math.exp(AQHI_PARAMS.beta.pm25 * pm25) - 1 : 0;
  const riskO3 = o3 ? Math.exp(AQHI_PARAMS.beta.o3 * o3) - 1 : 0;
  const riskNO2 = no2 ? Math.exp(AQHI_PARAMS.beta.no2 * no2) - 1 : 0;

  const totalRiskSum = riskPM25 + riskO3 + riskNO2;
  const aqhi = (10 / AQHI_PARAMS.C) * 100 * totalRiskSum;

  console.log(`📊 AQHI risks: PM2.5=${riskPM25.toFixed(4)}, NO2=${riskNO2.toFixed(4)}, O3=${riskO3.toFixed(4)}, Total=${totalRiskSum.toFixed(4)} → AQHI=${Math.round(aqhi)}`);

  return Math.max(0, Math.round(aqhi));
}

/**
 * Get AQHI level information
 */
export function getAQHILevel(aqhi) {
  for (const [key, level] of Object.entries(AQHI_LEVELS)) {
    if (aqhi >= level.min && aqhi <= level.max) {
      return { ...level, key };
    }
  }
  return { ...AQHI_LEVELS.VERY_HIGH, key: 'VERY_HIGH' };
}

/**
 * Main AQHI calculation for station with realistic approach
 * FIXED: Now properly converts AQI values to raw concentrations before calculation
 */
export function calculateStationAQHIRealistic(station) {
  const stationId = station.uid || station.station?.name || 'unknown';

  // CRITICAL FIX: Convert AQI values to raw concentrations first
  console.log(`🔄 Converting station ${stationId} AQI values to raw concentrations...`);
  const stationWithConcentrations = convertStationToRawConcentrations(station);

  // Extract raw concentrations (μg/m³) instead of AQI values
  const currentConcentrations = {
    pm25: getRawConcentration(stationWithConcentrations, 'pm25') || 0,
    no2: getRawConcentration(stationWithConcentrations, 'no2') || 0,
    o3: getRawConcentration(stationWithConcentrations, 'o3') || 0,
  };

  console.log(`📊 Raw concentrations for ${stationId}:`, currentConcentrations);

  // Store current reading for building our own moving average (now with raw concentrations)
  const dataPoints = collectCurrentReading(stationId, currentConcentrations);

  // Try to get moving average from our collected data
  const movingAverageData = calculateClientSideMovingAverage(stationId);

  let pollutantsForCalculation = currentConcentrations;
  let calculationMethod = 'current';
  let dataQuality = 'limited';

  if (movingAverageData && movingAverageData.timeSpanHours >= 1) {
    // Use our collected moving average if we have at least 1 hour of data
    pollutantsForCalculation = movingAverageData;
    calculationMethod = 'client-average';
    dataQuality = movingAverageData.quality;
  } else if (dataPoints === 1) {
    // For first reading, try estimation
    pollutantsForCalculation = estimateMovingAverage(currentPollutants);
    calculationMethod = 'estimated';
    dataQuality = 'estimated';
  }

  const aqhi = calculateRealisticAQHI(
    pollutantsForCalculation.pm25,
    pollutantsForCalculation.no2,
    pollutantsForCalculation.o3,
  );

  const level = getAQHILevel(aqhi);

  return {
    value: aqhi,
    level,
    pollutants: currentConcentrations, // Fixed: use currentConcentrations instead of undefined currentPollutants
    calculationMethod,
    dataQuality,
    dataPoints,
    timeSpanHours: movingAverageData?.timeSpanHours || 0,
    hasAllSensors: Object.values(currentConcentrations).every((v) => v > 0),
    missingSensors: Object.keys(currentConcentrations).filter(
      (k) => currentConcentrations[k] === 0,
    ),
    note: getCalculationNote(calculationMethod, dataQuality, dataPoints),
  };
}

/**
 * Get data quality assessment
 */
function getDataQuality(timeSpanHours, dataPoints) {
  if (timeSpanHours >= 3 && dataPoints >= 15) return 'excellent';
  if (timeSpanHours >= 2 && dataPoints >= 10) return 'good';
  if (timeSpanHours >= 1 && dataPoints >= 5) return 'fair';
  return 'limited';
}

/**
 * Get explanation note for calculation method
 */
function getCalculationNote(method, quality, dataPoints) {
  switch (method) {
    case 'current':
      return 'Using current reading (collecting data for moving average)';
    case 'estimated':
      return 'Using estimated 3-hour average based on current conditions';
    case 'client-average':
      if (quality === 'excellent')
        return `Full 3-hour moving average (${dataPoints} readings)`;
      if (quality === 'good')
        return `2+ hour moving average (${dataPoints} readings)`;
      if (quality === 'fair')
        return `1+ hour moving average (${dataPoints} readings)`;
      return `Partial average (${dataPoints} readings)`;
    default:
      return 'Calculation method unknown';
  }
}

/**
 * Format AQHI for display
 */
export function formatAQHI(aqhi) {
  if (aqhi === null || aqhi === undefined || isNaN(aqhi)) {
    return 'N/A';
  }
  const rounded = Math.round(aqhi);
  if (rounded > 10) return `${rounded}+`;
  return rounded.toString();
}

/**
 * Initialize the realistic AQHI system
 */
export function initializeRealisticAQHI() {
  console.log('🌍 Initializing Realistic AQHI System');
  console.log('📊 Building 3-hour moving averages from 10-minute intervals');
  console.log(
    '⚠️ Note: True 3-hour averages will be available after 3 hours of operation',
  );

  // Clean old data on startup
  const now = new Date();
  const cleaned = new Map();

  clientHistoricalData.forEach((entries, stationId) => {
    const validEntries = entries.filter((entry) => {
      const age = (now - new Date(entry.timestamp)) / (1000 * 60 * 60);
      return age <= 3;
    });

    if (validEntries.length > 0) {
      cleaned.set(stationId, validEntries);
    }
  });

  clientHistoricalData = cleaned;
  saveHistoricalData(clientHistoricalData);

  return clientHistoricalData.size;
}

/**
 * Calculate statistics for multiple stations with AQHI data
 * @param {Array} stations - Array of station data with .aqhi property
 * @returns {Object} Statistics including average, min, max, and category counts
 */
export function calculateAQHIStatistics(stations) {
  if (!stations || stations.length === 0) {
    return null;
  }

  const aqhiValues = [];
  const categoryCounts = {
    LOW: 0,
    MODERATE: 0,
    HIGH: 0,
    VERY_HIGH: 0,
  };

  let stationsWithData = 0;

  stations.forEach((station) => {
    if (station.aqhi && typeof station.aqhi.value === 'number') {
      aqhiValues.push(station.aqhi.value);
      categoryCounts[station.aqhi.level.key]++;
      stationsWithData++;
    }
  });

  if (aqhiValues.length === 0) {
    return null;
  }

  const average =
    aqhiValues.reduce((sum, val) => sum + val, 0) / aqhiValues.length;
  const min = Math.min(...aqhiValues);
  const max = Math.max(...aqhiValues);

  return {
    average: Math.round(average),
    min: Math.round(min),
    max: Math.round(max),
    categoryCounts,
    totalStations: stations.length,
    stationsWithData,
    percentComplete: Math.round((stationsWithData / stations.length) * 100),
  };
}
