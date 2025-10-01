// Canadian AQHI Implementation using official Health Canada parameters
// Based on official Canadian AQHI formula from Health Canada

import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js';
// Import will be added dynamically when needed for fallback calculations

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


  async enhanceStationsWithCanadianAQHI(stations) {
    if (!stations || stations.length === 0) return stations;

    const enhancedStations = [];

    for (const station of stations) {
      const stationId = station.uid?.toString() || station.station?.name || 'unknown';

      try {
        // Use the same 3-hour averages from regular AQHI calculation but apply Canadian formula
        let aqhi, pollutants, calculationMethod, dataQuality, readingCount;

        // Try multiple data sources in priority order
        const mergedData = await this.getMergedConcentrations(stationId);

        if (mergedData && (mergedData.pm25 > 0 || mergedData.no2 > 0 || mergedData.o3 > 0)) {
          // Calculate Canadian AQHI using the same concentrations as Thai AQHI
          const riskPM25 = mergedData.pm25 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.pm25 * mergedData.pm25) - 1 : 0;
          const riskO3 = mergedData.o3 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.o3 * mergedData.o3) - 1 : 0;
          const riskNO2 = mergedData.no2 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.no2 * mergedData.no2) - 1 : 0;

          const totalRiskSum = riskPM25 + riskO3 + riskNO2;
          aqhi = (10.0 / CANADIAN_AQHI_PARAMS.C) * 100 * totalRiskSum;

          pollutants = mergedData;
          calculationMethod = mergedData.source || 'supabase-average';
          dataQuality = mergedData.readingCount >= 15 ? 'excellent' :
                       mergedData.readingCount >= 10 ? 'good' :
                       mergedData.readingCount >= 5 ? 'fair' : 'limited';
          readingCount = mergedData.readingCount || 1;

          console.log(`🍁 Canadian AQHI for ${stationId}: PM2.5=${mergedData.pm25?.toFixed(1)}, NO2=${mergedData.no2?.toFixed(1)}, O3=${mergedData.o3?.toFixed(1)} → AQHI=${Math.round(aqhi)} (${calculationMethod})`);
        } else {
          // Fallback to current station data when Supabase data unavailable
          try {
            const { convertStationToRawConcentrations } = await import('./aqi-to-concentration.js');
            const fallbackConcentrations = convertStationToRawConcentrations(station);

            if (fallbackConcentrations && (fallbackConcentrations.pm25 > 0 || fallbackConcentrations.no2 > 0 || fallbackConcentrations.o3 > 0)) {
              const riskPM25 = fallbackConcentrations.pm25 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.pm25 * fallbackConcentrations.pm25) - 1 : 0;
              const riskO3 = fallbackConcentrations.o3 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.o3 * fallbackConcentrations.o3) - 1 : 0;
              const riskNO2 = fallbackConcentrations.no2 ? Math.exp(CANADIAN_AQHI_PARAMS.beta.no2 * fallbackConcentrations.no2) - 1 : 0;

              const totalRiskSum = riskPM25 + riskO3 + riskNO2;
              aqhi = (10.0 / CANADIAN_AQHI_PARAMS.C) * 100 * totalRiskSum;

              pollutants = fallbackConcentrations;
              calculationMethod = 'current-reading';
              dataQuality = 'current';
              readingCount = 1;

              console.log(`🍁 Canadian AQHI for ${stationId} (fallback): PM2.5=${fallbackConcentrations.pm25?.toFixed(1)}, NO2=${fallbackConcentrations.no2?.toFixed(1)}, O3=${fallbackConcentrations.o3?.toFixed(1)} → AQHI=${Math.round(aqhi)} (current)`);
            } else {
              // No data available at all
              aqhi = 1; // Minimum Canadian AQHI value
              pollutants = { pm25: 0, no2: 0, o3: 0 };
              calculationMethod = 'no-data';
              dataQuality = 'unavailable';
              readingCount = 0;
              console.log(`🍁 No data for Canadian AQHI calculation for station ${stationId}`);
            }
          } catch (conversionError) {
            console.error(`🍁 Error in fallback concentration conversion for ${stationId}:`, conversionError);
            aqhi = 1;
            pollutants = { pm25: 0, no2: 0, o3: 0 };
            calculationMethod = 'no-data';
            dataQuality = 'unavailable';
            readingCount = 0;
          }
        }

        const canadianAqhiValue = Math.max(1, Math.round(aqhi));
        const level = getCanadianAQHILevel(canadianAqhiValue);

        enhancedStations.push({
          ...station,
          canadianAqhi: {
            value: canadianAqhiValue,
            level,
            pollutants,
            calculationMethod,
            dataQuality,
            readingCount,
            hasAllSensors: Object.values(pollutants).every(v => v > 0),
            missingSensors: Object.keys(pollutants).filter(k => pollutants[k] === 0),
            note: this.getCalculationNote(calculationMethod, dataQuality, readingCount),
          }
        });

      } catch (error) {
        console.error(`🍁 Error calculating Canadian AQHI for station ${stationId}:`, error);
        enhancedStations.push({
          ...station,
          canadianAqhi: {
            value: 1,
            level: getCanadianAQHILevel(1),
            error: error.message,
            calculationMethod: 'failed',
            dataQuality: 'unavailable'
          }
        });
      }
    }

    return enhancedStations;
  }

  async getMergedConcentrations(stationId) {
    if (!this.isEnabled) return null;

    try {
      await this.initPromise;

      // Use the same current_3h_averages view as Thai AQHI and PM2.5 AQHI
      const { data: aqicnData, error: aqicnError } = await this.supabase
        .from('current_3h_averages')
        .select('*')
        .eq('station_uid', stationId)
        .single();

      if (aqicnError && aqicnError.code !== 'PGRST116') {
        console.warn(`🍁 Error fetching AQICN 3h averages for ${stationId}:`, aqicnError.message);
      }

      // Get OpenWeather data as fallback
      const { data: openweatherData, error: openweatherError } = await this.supabase
        .from('current_openweather_station_3h_averages')
        .select('*')
        .eq('station_uid', stationId)
        .single();

      if (openweatherError && openweatherError.code !== 'PGRST116') {
        console.warn(`🍁 Error fetching OpenWeather 3h averages for ${stationId}:`, openweatherError.message);
      }

      // Merge data prioritizing AQICN, supplementing with OpenWeather
      if (aqicnData || openweatherData) {
        const mergedData = {
          pm25: aqicnData?.avg_pm25 || openweatherData?.avg_pm25 || 0,
          pm10: aqicnData?.avg_pm10 || openweatherData?.avg_pm10 || 0,
          o3: aqicnData?.avg_o3 || openweatherData?.avg_o3 || 0,
          no2: aqicnData?.avg_no2 || openweatherData?.avg_no2 || 0,
          so2: aqicnData?.avg_so2 || openweatherData?.avg_so2 || 0,
          co: aqicnData?.avg_co || openweatherData?.avg_co || 0,
          readingCount: aqicnData?.reading_count || openweatherData?.reading_count || 1,
          source: aqicnData ? 'aqicn-3h-average' : 'openweather-3h-average'
        };

        // Only return if we have meaningful pollutant data
        if (mergedData.pm25 > 0 || mergedData.no2 > 0 || mergedData.o3 > 0) {
          return mergedData;
        }
      }

      return null;

    } catch (error) {
      console.error(`🍁 Error fetching merged concentrations for ${stationId}:`, error);
      return null;
    }
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