// Canadian AQHI Implementation using official Health Canada parameters
// Based on official Canadian AQHI formula from Health Canada

import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js';
import {
  convertStationToRawConcentrations,
  getRawConcentration
} from './aqi-to-concentration.js';

// Official Canadian AQHI Parameters from Health Canada
const CANADIAN_AQHI_PARAMS = {
  C: 10.4,  // Official Canadian scaling factor
  beta: {
    pm25: 0.000487,  // PM2.5 coefficient from Health Canada
    no2: 0.000871,   // NO2 coefficient from Health Canada
    o3: 0.000537,    // O3 coefficient from Health Canada
  },
};

// Canadian AQHI Categories (official Health Canada standards)
export const CANADIAN_AQHI_LEVELS = {
  LOW: {
    min: 1,
    max: 3,
    color: '#10b981',
    label: 'Low Risk',
    description: 'Ideal air quality for outdoor activities',
  },
  MODERATE: {
    min: 4,
    max: 6,
    color: '#f59e0b',
    label: 'Moderate Risk',
    description: 'No need to modify outdoor activities unless experiencing symptoms',
  },
  HIGH: {
    min: 7,
    max: 10,
    color: '#ef4444',
    label: 'High Risk',
    description: 'Consider reducing or rescheduling strenuous outdoor activities',
  },
  VERY_HIGH: {
    min: 11,
    max: Infinity,
    color: '#7f1d1d',
    label: 'Very High Risk',
    description: 'Reduce or reschedule strenuous outdoor activities',
  },
};

/**
 * Calculate Canadian AQHI using official Health Canada formula
 * AQHI = (10/10.4) × 100 × [(e^(0.000871*NO2) -1) + (e^(0.000537*O3) -1) + (e^(0.000487*PM2.5) -1)]
 *
 * @param {number} pm25 - PM2.5 concentration in μg/m³
 * @param {number} no2 - NO2 concentration in μg/m³
 * @param {number} o3 - O3 concentration in μg/m³
 * @returns {number} Canadian AQHI value (1-10+)
 */
export function calculateCanadianAQHI(pm25, no2, o3) {
  console.log(`🍁 Calculating Canadian AQHI with concentrations: PM2.5=${pm25}μg/m³, NO2=${no2}μg/m³, O3=${o3}μg/m³`);

  // Official Canadian AQHI formula
  const riskPM25 = pm25 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.pm25 * pm25) - 1 : 0;
  const riskO3 = o3 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.o3 * o3) - 1 : 0;
  const riskNO2 = no2 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.no2 * no2) - 1 : 0;

  const totalRiskSum = riskPM25 + riskO3 + riskNO2;
  const aqhi = (10.0 / CANADIAN_AQHI_PARAMS.C) * 100 * totalRiskSum;

  console.log(`🍁 Canadian AQHI risks: PM2.5=${riskPM25.toFixed(6)}, NO2=${riskNO2.toFixed(6)}, O3=${riskO3.toFixed(6)}, Total=${totalRiskSum.toFixed(6)} → AQHI=${Math.round(aqhi)}`);

  return Math.max(1, Math.round(aqhi)); // Canadian AQHI starts at 1, not 0
}

/**
 * Get Canadian AQHI level information
 */
export function getCanadianAQHILevel(aqhi) {
  for (const [key, level] of Object.entries(CANADIAN_AQHI_LEVELS)) {
    if (aqhi >= level.min && aqhi <= level.max) {
      return { ...level, key };
    }
  }
  return { ...CANADIAN_AQHI_LEVELS.VERY_HIGH, key: 'VERY_HIGH' };
}

/**
 * Canadian AQHI Supabase integration class
 */
class CanadianAQHISupabase {
  constructor() {
    this.supabase = null;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.isEnabled = false;
    this.initPromise = this.initialize();
  }

  async initialize() {
    try {
      if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        this.supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        this.isEnabled = true;
        console.log('🍁 Canadian AQHI Supabase integration initialized');
        return true;
      }
    } catch (error) {
      console.warn('🍁 Canadian AQHI Supabase initialization failed:', error);
      this.isEnabled = false;
    }
    return false;
  }

  async get3HourAverages(stationId) {
    if (!this.isEnabled) return null;

    try {
      await this.initPromise;

      const { data, error } = await this.supabase
        .from('air_quality_data')
        .select('*')
        .eq('station_id', stationId)
        .gte('timestamp', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        console.log(`🍁 No Canadian AQHI data found for station ${stationId}`);
        return null;
      }

      // Calculate 3-hour averages
      const validReadings = data.filter(reading =>
        reading.pm25_concentration > 0 ||
        reading.no2_concentration > 0 ||
        reading.o3_concentration > 0
      );

      if (validReadings.length === 0) return null;

      const averages = {
        pm25: 0,
        no2: 0,
        o3: 0,
        readingCount: validReadings.length
      };

      let counts = { pm25: 0, no2: 0, o3: 0 };

      validReadings.forEach(reading => {
        if (reading.pm25_concentration > 0) {
          averages.pm25 += reading.pm25_concentration;
          counts.pm25++;
        }
        if (reading.no2_concentration > 0) {
          averages.no2 += reading.no2_concentration;
          counts.no2++;
        }
        if (reading.o3_concentration > 0) {
          averages.o3 += reading.o3_concentration;
          counts.o3++;
        }
      });

      // Calculate final averages
      averages.pm25 = counts.pm25 > 0 ? averages.pm25 / counts.pm25 : 0;
      averages.no2 = counts.no2 > 0 ? averages.no2 / counts.no2 : 0;
      averages.o3 = counts.o3 > 0 ? averages.o3 / counts.o3 : 0;

      return averages;

    } catch (error) {
      console.error(`🍁 Error fetching Canadian AQHI 3h averages for ${stationId}:`, error);
      return null;
    }
  }

  async enhanceStationsWithCanadianAQHI(stations) {
    if (!stations || stations.length === 0) return stations;

    const enhancedStations = [];

    for (const station of stations) {
      const stationId = station.uid?.toString() || station.station?.name || 'unknown';

      try {
        // Convert AQI values to raw concentrations
        const stationWithConcentrations = convertStationToRawConcentrations(station);

        // Try to get 3-hour averages from Supabase
        const averages = await this.get3HourAverages(stationId);

        let pollutantsForCalculation;
        let calculationMethod;
        let dataQuality;

        if (averages && averages.readingCount >= 5) {
          // Use Supabase 3-hour averages
          pollutantsForCalculation = averages;
          calculationMethod = 'supabase-average';
          dataQuality = averages.readingCount >= 15 ? 'excellent' :
                       averages.readingCount >= 10 ? 'good' : 'fair';
        } else {
          // Fallback to current reading
          pollutantsForCalculation = {
            pm25: getRawConcentration(stationWithConcentrations, 'pm25') || 0,
            no2: getRawConcentration(stationWithConcentrations, 'no2') || 0,
            o3: getRawConcentration(stationWithConcentrations, 'o3') || 0,
          };
          calculationMethod = 'current-reading';
          dataQuality = 'limited';
        }

        const canadianAqhi = calculateCanadianAQHI(
          pollutantsForCalculation.pm25,
          pollutantsForCalculation.no2,
          pollutantsForCalculation.o3
        );

        const level = getCanadianAQHILevel(canadianAqhi);

        enhancedStations.push({
          ...station,
          canadianAqhi: {
            value: canadianAqhi,
            level,
            pollutants: pollutantsForCalculation,
            calculationMethod,
            dataQuality,
            readingCount: averages?.readingCount || 1,
            hasAllSensors: Object.values(pollutantsForCalculation).every(v => v > 0),
            missingSensors: Object.keys(pollutantsForCalculation).filter(
              k => pollutantsForCalculation[k] === 0
            ),
            note: this.getCalculationNote(calculationMethod, dataQuality, averages?.readingCount || 1),
          }
        });

      } catch (error) {
        console.error(`🍁 Error calculating Canadian AQHI for station ${stationId}:`, error);
        enhancedStations.push({
          ...station,
          canadianAqhi: {
            value: null,
            level: null,
            error: error.message,
            calculationMethod: 'failed',
            dataQuality: 'unavailable'
          }
        });
      }
    }

    return enhancedStations;
  }

  getCalculationNote(method, quality, readingCount) {
    switch (method) {
      case 'current-reading':
        return 'Using current reading (Canadian formula)';
      case 'supabase-average':
        if (quality === 'excellent')
          return `Canadian AQHI with 3-hour average (${readingCount} readings)`;
        if (quality === 'good')
          return `Canadian AQHI with 2+ hour average (${readingCount} readings)`;
        if (quality === 'fair')
          return `Canadian AQHI with partial average (${readingCount} readings)`;
        return `Canadian AQHI with limited data (${readingCount} readings)`;
      default:
        return 'Canadian AQHI calculation method unknown';
    }
  }
}

// Create singleton instance
export const canadianAQHI = new CanadianAQHISupabase();

/**
 * Calculate Canadian AQHI statistics for multiple stations
 */
export function calculateCanadianAQHIStatistics(stations) {
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
    if (station.canadianAqhi && typeof station.canadianAqhi.value === 'number') {
      aqhiValues.push(station.canadianAqhi.value);
      categoryCounts[station.canadianAqhi.level.key]++;
      stationsWithData++;
    }
  });

  if (aqhiValues.length === 0) {
    return null;
  }

  const average = aqhiValues.reduce((sum, val) => sum + val, 0) / aqhiValues.length;
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

/**
 * Format Canadian AQHI for display
 */
export function formatCanadianAQHI(aqhi) {
  if (aqhi === null || aqhi === undefined || isNaN(aqhi)) {
    return 'N/A';
  }
  const rounded = Math.round(aqhi);
  if (rounded > 10) return `${rounded}+`;
  return rounded.toString();
}