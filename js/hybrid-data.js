// Hybrid Air Quality Data System
// Combines WAQI (primary) with Google API (fills missing pollutants)

import { fetchGoogleAirQualityPoint } from "./google-api.js";
import { storeGoogleDataInSupabase } from "./google-data-storage.js";

/**
 * Enhance WAQI stations with missing pollutants from Google API
 * Primary use: Fill in O3 and NO2 when WAQI doesn't have them
 *
 * @param {Array} waqiStations - Array of WAQI station data
 * @returns {Promise<Array>} Enhanced stations with Google data for missing pollutants
 */
export async function enhanceWAQIWithGooglePollutants(waqiStations) {
  console.log(
    `🔄 Analyzing ${waqiStations.length} WAQI stations for missing pollutants...`,
  );

  // Step 1: Identify which stations are missing O3 or NO2
  const stationsNeedingData = analyzeStationsForMissingPollutants(waqiStations);

  if (stationsNeedingData.length === 0) {
    console.log(
      "✅ All WAQI stations have complete O3 and NO2 data - no Google API needed!",
    );
    return waqiStations;
  }

  console.log(`📊 Found ${stationsNeedingData.length} stations missing O3/NO2`);
  console.log(
    `   Missing O3: ${stationsNeedingData.filter((s) => s.missingPollutants.includes("o3")).length}`,
  );
  console.log(
    `   Missing NO2: ${stationsNeedingData.filter((s) => s.missingPollutants.includes("no2")).length}`,
  );

  // Step 2: For each station needing data, fetch from nearest Google grid point
  const googleDataCache = {}; // Cache to avoid duplicate API calls
  const enhancedStations = await Promise.all(
    waqiStations.map(async (station) => {
      const needsData = stationsNeedingData.find((s) => s.uid === station.uid);

      if (!needsData) {
        // Station already has complete data
        return station;
      }

      // Find nearest grid point
      const nearestPoint = findNearestGridPoint(station.lat, station.lon);
      const cacheKey = `${nearestPoint.lat},${nearestPoint.lng}`;

      // Fetch Google data (or use cached)
      let googleData;
      if (googleDataCache[cacheKey]) {
        googleData = googleDataCache[cacheKey];
        console.log(
          `   ♻️  Using cached Google data for station ${station.uid}`,
        );
      } else {
        console.log(
          `   🌐 Fetching Google data for station ${station.uid} (${needsData.missingPollutants.join(", ")})`,
        );
        googleData = await fetchGoogleAirQualityPoint(
          nearestPoint.lat,
          nearestPoint.lng,
        );
        googleDataCache[cacheKey] = googleData;
      }

      if (!googleData) {
        console.warn(
          `   ⚠️  Failed to get Google data for station ${station.uid}`,
        );
        return station;
      }

      // Merge the missing pollutants
      return mergeGooglePollutants(
        station,
        googleData,
        needsData.missingPollutants,
      );
    }),
  );

  const uniqueApiCalls = Object.keys(googleDataCache).length;
  console.log(
    `✅ Enhanced ${stationsNeedingData.length} stations using ${uniqueApiCalls} Google API calls`,
  );
  console.log(
    `   💰 Cost savings: ${stationsNeedingData.length - uniqueApiCalls} API calls saved by caching`,
  );

  // Store the Google supplement data in Supabase
  const googleSupplements = Object.entries(googleDataCache).map(
    ([coords, data], index) => {
      const [lat, lng] = coords.split(",");
      return {
        uid: `google-supplement-${lat}-${lng}`,
        lat: parseFloat(lat),
        lon: parseFloat(lng),
        station: { name: `Google Supplement ${index + 1}` },
        _rawData: data,
        _source: "google-supplement",
        iaqi: extractPollutantsFromGoogle(data),
      };
    },
  );

  if (googleSupplements.length > 0) {
    console.log(
      `💾 Storing ${googleSupplements.length} Google supplement points in Supabase...`,
    );
    await storeGoogleDataInSupabase(googleSupplements);
  }

  return enhancedStations;
}

/**
 * Analyze WAQI stations to find which are missing O3 or NO2
 */
function analyzeStationsForMissingPollutants(waqiStations) {
  const stationsNeedingData = [];

  for (const station of waqiStations) {
    const missingPollutants = [];

    // Check for O3
    if (!station.iaqi?.o3?.v && station.iaqi?.o3?.v !== 0) {
      missingPollutants.push("o3");
    }

    // Check for NO2
    if (!station.iaqi?.no2?.v && station.iaqi?.no2?.v !== 0) {
      missingPollutants.push("no2");
    }

    if (missingPollutants.length > 0) {
      stationsNeedingData.push({
        uid: station.uid,
        lat: station.lat,
        lon: station.lon,
        name: station.station?.name || "Unknown",
        missingPollutants,
      });
    }
  }

  return stationsNeedingData;
}

/**
 * Find the nearest 3x3 grid point for a given station
 */
function findNearestGridPoint(stationLat, stationLon) {
  // Generate 3x3 grid points
  const gridPoints = [];
  const latStep = (14.0 - 13.5) / 2; // 0.25°
  const lngStep = (100.9 - 100.3) / 2; // 0.3°

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      gridPoints.push({
        lat: 13.5 + i * latStep,
        lng: 100.3 + j * lngStep,
      });
    }
  }

  // Find nearest point using distance formula
  let nearestPoint = gridPoints[0];
  let minDistance = Infinity;

  for (const point of gridPoints) {
    const distance = Math.sqrt(
      Math.pow(stationLat - point.lat, 2) + Math.pow(stationLon - point.lng, 2),
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  }

  return nearestPoint;
}

/**
 * Merge Google pollutant data into WAQI station
 * Only fills in missing pollutants (O3, NO2)
 */
function mergeGooglePollutants(waqiStation, googleData, missingPollutants) {
  // Clone the station to avoid mutation
  const enhanced = { ...waqiStation };

  if (!enhanced.iaqi) {
    enhanced.iaqi = {};
  }

  // Extract pollutants from Google data
  const googlePollutants = extractPollutantsFromGoogle(googleData);

  // Fill in only the missing pollutants
  for (const pollutant of missingPollutants) {
    if (googlePollutants[pollutant]) {
      enhanced.iaqi[pollutant] = {
        v: googlePollutants[pollutant].v,
        _source: "google", // Mark as Google-sourced
        _sourceType: "supplement", // Indicate it's supplementary data
      };
      console.log(
        `     ✓ Added ${pollutant.toUpperCase()} from Google: ${googlePollutants[pollutant].v}`,
      );
    }
  }

  // Mark station as hybrid
  enhanced._hybridData = true;
  enhanced._googleSupplemented = missingPollutants;

  return enhanced;
}

/**
 * Extract pollutant concentrations from Google API response
 */
function extractPollutantsFromGoogle(googleData) {
  const pollutants = {};

  if (!googleData || !googleData.pollutants) {
    return pollutants;
  }

  for (const pollutant of googleData.pollutants) {
    const code = pollutant.code?.toLowerCase();
    const value = pollutant.concentration?.value;

    if (code && value !== undefined) {
      // Convert units if needed (Google uses different units)
      let convertedValue = value;

      // Google returns concentrations in proper units:
      // PM2.5, PM10: μg/m³ (matches our format)
      // O3, NO2, SO2, CO: ppb (matches our format)

      pollutants[code] = {
        v: Math.round(convertedValue * 100) / 100, // Round to 2 decimals
        unit: pollutant.concentration?.units,
        _googleOriginal: value,
      };
    }
  }

  return pollutants;
}

/**
 * Get statistics on hybrid data usage
 */
export function getHybridDataStatistics(enhancedStations) {
  const stats = {
    total: enhancedStations.length,
    hybridStations: 0,
    o3Supplemented: 0,
    no2Supplemented: 0,
    fullyWAQI: 0,
    googleApiCalls: 0,
  };

  const gridPointsUsed = new Set();

  for (const station of enhancedStations) {
    if (station._hybridData) {
      stats.hybridStations++;

      if (station._googleSupplemented?.includes("o3")) {
        stats.o3Supplemented++;
      }
      if (station._googleSupplemented?.includes("no2")) {
        stats.no2Supplemented++;
      }

      // Count unique grid points
      const nearestPoint = findNearestGridPoint(station.lat, station.lon);
      gridPointsUsed.add(`${nearestPoint.lat},${nearestPoint.lng}`);
    } else {
      stats.fullyWAQI++;
    }
  }

  stats.googleApiCalls = gridPointsUsed.size;

  return stats;
}

/**
 * Check if a station has complete data for AQHI calculation
 */
export function hasCompleteAQHIData(station) {
  const hasO3 =
    station.iaqi?.o3?.v !== undefined && station.iaqi?.o3?.v !== null;
  const hasNO2 =
    station.iaqi?.no2?.v !== undefined && station.iaqi?.no2?.v !== null;
  const hasPM25 =
    station.iaqi?.pm25?.v !== undefined && station.iaqi?.pm25?.v !== null;

  return hasO3 && hasNO2 && hasPM25;
}

/**
 * Get data source breakdown for a station
 */
export function getStationDataSources(station) {
  const sources = {
    pm25: station.iaqi?.pm25?._source || "waqi",
    pm10: station.iaqi?.pm10?._source || "waqi",
    o3: station.iaqi?.o3?._source || "waqi",
    no2: station.iaqi?.no2?._source || "waqi",
    so2: station.iaqi?.so2?._source || "waqi",
    co: station.iaqi?.co?._source || "waqi",
  };

  const googleCount = Object.values(sources).filter(
    (s) => s === "google",
  ).length;
  const waqiCount = Object.values(sources).filter((s) => s === "waqi").length;

  return {
    sources,
    googleCount,
    waqiCount,
    isHybrid: googleCount > 0 && waqiCount > 0,
  };
}
