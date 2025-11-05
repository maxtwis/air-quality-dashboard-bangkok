// AQHI calculations for Google Air Quality data
// Uses stored Google data from Supabase for 3-hour moving averages

import {
  supabaseAQHI,
  calculateThaiAQHI,
  getAQHILevel,
} from "./aqhi-supabase.js";
import { getGoogle3HourAverages } from "./google-data-storage.js";

/**
 * Enhance Google stations with AQHI calculations
 * Uses 3-hour averages from Supabase if available
 * @param {Array} googleStations - Array of Google station data
 * @returns {Promise<Array>} Stations with AQHI data
 */
export async function enhanceGoogleStationsWithAQHI(googleStations) {

  if (!googleStations || googleStations.length === 0) {
    return [];
  }

  try {
    // Get station UIDs
    const stationUids = googleStations.map((s) => s.uid).filter(Boolean);

    // Fetch 3-hour averages for Google stations from Supabase
    const averagesMap = await getGoogle3HourAverages(stationUids);


    // Enhance each station with AQHI
    const enhancedStations = googleStations.map((station) => {
      const stationId = station.uid;
      const averages = averagesMap[stationId];

      let aqhiData;

      if (
        averages &&
        (averages.avg_pm25 || averages.avg_o3 || averages.avg_no2)
      ) {
        // We have 3-hour averages - calculate AQHI
        const aqhiValue = calculateThaiAQHI(
          averages.avg_pm25 || 0,
          averages.avg_no2 || 0,
          averages.avg_o3 || 0,
        );

        const readingCount = averages.reading_count || 0;
        const dataQuality = getDataQuality(readingCount);

        aqhiData = {
          value: aqhiValue,
          level: getAQHILevel(aqhiValue),
          calculationMethod: "3h_avg",
          readingCount: readingCount,
          dataQuality: dataQuality.level,
          dataQualityIcon: dataQuality.icon,
          dataSources: "google_supabase",
          averages: {
            pm25: averages.avg_pm25,
            pm10: averages.avg_pm10,
            o3: averages.avg_o3,
            no2: averages.avg_no2,
            so2: averages.avg_so2,
            co: averages.avg_co,
          },
          timeRange: {
            earliest: averages.earliest_reading,
            latest: averages.latest_reading,
          },
        };

      } else {
        // No 3-hour averages yet - use current reading
        const currentPM25 = station.iaqi?.pm25?.v || 0;
        const currentNO2 = station.iaqi?.no2?.v || 0;
        const currentO3 = station.iaqi?.o3?.v || 0;

        if (currentPM25 || currentNO2 || currentO3) {
          const aqhiValue = calculateThaiAQHI(
            currentPM25,
            currentNO2,
            currentO3,
          );

          aqhiData = {
            value: aqhiValue,
            level: getAQHILevel(aqhiValue),
            calculationMethod: "current",
            readingCount: 0,
            dataQuality: "limited",
            dataQualityIcon: "🔄",
            dataSources: "google_current",
            note: "Using current reading - 3-hour average not yet available",
          };

        } else {
          // No data at all
          aqhiData = {
            value: null,
            level: null,
            calculationMethod: "none",
            readingCount: 0,
            dataQuality: "no_data",
            dataQualityIcon: "❌",
            dataSources: "none",
            note: "No pollutant data available",
          };

        }
      }

      return {
        ...station,
        aqhi: aqhiData,
      };
    });

    const validCount = enhancedStations.filter(
      (s) => s.aqhi?.value !== null,
    ).length;

    return enhancedStations;
  } catch (error) {

    // Return stations with error indicator
    return googleStations.map((station) => ({
      ...station,
      aqhi: {
        value: null,
        level: null,
        calculationMethod: "error",
        error: error.message,
        dataQuality: "error",
        dataQualityIcon: "⚠️",
      },
    }));
  }
}

/**
 * Determine data quality based on number of readings
 * @param {number} readingCount - Number of readings in 3-hour window
 * @returns {Object} Data quality info
 */
function getDataQuality(readingCount) {
  if (readingCount >= 15) {
    return {
      level: "excellent",
      icon: "🎯",
      label: "Excellent (15+ readings)",
    };
  } else if (readingCount >= 10) {
    return { level: "good", icon: "✅", label: "Good (10+ readings)" };
  } else if (readingCount >= 5) {
    return { level: "fair", icon: "⏳", label: "Fair (5+ readings)" };
  } else if (readingCount >= 1) {
    return { level: "limited", icon: "🔄", label: "Limited (<5 readings)" };
  } else {
    return { level: "no_data", icon: "❌", label: "No data" };
  }
}

/**
 * Get AQHI statistics for Google stations
 * @param {Array} enhancedStations - Stations with AQHI data
 * @returns {Object} Statistics
 */
export function calculateGoogleAQHIStatistics(enhancedStations) {
  const validStations = enhancedStations.filter((s) => s.aqhi?.value !== null);

  if (validStations.length === 0) {
    return {
      count: 0,
      average: null,
      min: null,
      max: null,
      distribution: {},
    };
  }

  const aqhiValues = validStations.map((s) => s.aqhi.value);
  const average =
    aqhiValues.reduce((sum, val) => sum + val, 0) / aqhiValues.length;
  const min = Math.min(...aqhiValues);
  const max = Math.max(...aqhiValues);

  // Distribution by level
  const distribution = {
    low: 0,
    moderate: 0,
    high: 0,
    very_high: 0,
  };

  validStations.forEach((station) => {
    const levelKey = station.aqhi.level?.key?.toLowerCase() || "unknown";
    if (distribution[levelKey] !== undefined) {
      distribution[levelKey]++;
    }
  });

  return {
    count: validStations.length,
    total: enhancedStations.length,
    average: Math.round(average * 10) / 10,
    min,
    max,
    distribution,
    dataSource: "google",
  };
}
