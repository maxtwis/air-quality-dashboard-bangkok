// Google Air Quality API Integration

import { storeGoogleDataInSupabase } from "./google-data-storage.js";

/**
 * Fetch air quality data for Bangkok area using Google Air Quality API
 * Note: Google API requires individual lat/lng lookups (no bounding box query)
 * We'll query a grid of points across Bangkok to get comprehensive coverage
 * @param {boolean} storeData - Whether to store data in Supabase (default: true)
 */
export async function fetchGoogleAirQualityData(storeData = true) {
  try {
    // Create a grid of points across Bangkok
    const bangkokGrid = generateBangkokGrid();


    // Fetch data for all grid points in parallel
    const promises = bangkokGrid.map((point) =>
      fetchGoogleAirQualityPoint(point.lat, point.lng),
    );
    const results = await Promise.all(promises);

    // Filter out failed requests and format as stations
    const stations = results
      .filter((result) => result !== null)
      .map((data, index) =>
        formatGoogleDataAsStation(data, bangkokGrid[index]),
      );


    // Store data in Supabase for 3-hour averages and AQHI calculations
    if (storeData && stations.length > 0) {
      const storeResult = await storeGoogleDataInSupabase(stations);
      if (storeResult.stored) {
      } else {
      }
    }

    return stations;
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch air quality data for a single point
 */
export async function fetchGoogleAirQualityPoint(lat, lng) {
  try {
    const url = `/api/google-air-quality-proxy?lat=${lat}&lng=${lng}`;

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a grid of sampling points across Bangkok
 * Bangkok bounds: 13.5-14.0 lat, 100.3-100.9 lng
 */
function generateBangkokGrid() {
  const grid = [];

  // Create a 3x3 grid (9 points) for cost-effective coverage
  // Reduced from 5x5 (25 points) to save API costs
  const latStep = (14.0 - 13.5) / 2; // 3 points from 13.5 to 14.0
  const lngStep = (100.9 - 100.3) / 2; // 3 points from 100.3 to 100.9

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const lat = 13.5 + i * latStep;
      const lng = 100.3 + j * lngStep;
      grid.push({
        lat: Math.round(lat * 1000) / 1000,
        lng: Math.round(lng * 1000) / 1000,
        name: `Bangkok Grid ${i + 1}-${j + 1}`,
      });
    }
  }

  return grid;
}

/**
 * Format Google Air Quality API response to match WAQI station format
 */
function formatGoogleDataAsStation(googleData, gridPoint) {
  // Extract AQI from indexes array (US EPA AQI)
  const usAqi = googleData.indexes?.find((idx) => idx.code === "uaqi");
  const aqi = usAqi?.aqi || 0;

  // Extract pollutant concentrations
  const pollutants = {};

  if (googleData.pollutants) {
    googleData.pollutants.forEach((pollutant) => {
      const code = pollutant.code?.toLowerCase();
      const value = pollutant.concentration?.value;

      if (code && value !== undefined) {
        pollutants[code] = {
          v: Math.round(value * 10) / 10,
        };
      }
    });
  }

  // Format as WAQI-compatible station object
  return {
    uid: `google-${gridPoint.lat}-${gridPoint.lng}`,
    aqi: Math.round(aqi),
    station: {
      name: gridPoint.name,
      geo: [gridPoint.lat, gridPoint.lng],
      url: `google-station-${gridPoint.lat}-${gridPoint.lng}`,
      country: "TH",
    },
    lat: gridPoint.lat,
    lon: gridPoint.lng,
    _source: "google",
    _rawData: googleData,

    // Add pollutant data if available
    iaqi: pollutants,

    // Add dominant pollutant info
    dominantPollutant: googleData.dominantPollutant?.toLowerCase(),

    // Add health recommendations if available
    healthRecommendations: googleData.healthRecommendations,

    // Add timestamp
    time: {
      s: new Date().toISOString(),
      tz: "+07:00",
      v: Math.floor(Date.now() / 1000),
    },
  };
}

/**
 * Get detailed pollutant data from Google API response
 */
export function extractGooglePollutants(googleData) {
  const pollutants = {};

  if (googleData.pollutants) {
    googleData.pollutants.forEach((pollutant) => {
      const code = pollutant.code?.toLowerCase();
      if (!code) return;

      pollutants[code] = {
        concentration: pollutant.concentration?.value,
        unit: pollutant.concentration?.units,
        fullName: pollutant.fullName,
        displayName: pollutant.displayName,
        additionalInfo: pollutant.additionalInfo,
      };
    });
  }

  return pollutants;
}

/**
 * Convert Google AQI to traditional color coding
 */
export function getGoogleAqiColor(aqi) {
  if (aqi <= 50) return "#10b981"; // Good - Green
  if (aqi <= 100) return "#f59e0b"; // Moderate - Yellow
  if (aqi <= 150) return "#f97316"; // Unhealthy for Sensitive - Orange
  if (aqi <= 200) return "#ef4444"; // Unhealthy - Red
  if (aqi <= 300) return "#8b5cf6"; // Very Unhealthy - Purple
  return "#6b7280"; // Hazardous - Maroon
}

/**
 * Compare Google data reliability vs WAQI
 * Returns analysis of data sources
 */
export async function compareDataSources(lat, lng) {
  try {
    const [googleData, waqiData] = await Promise.all([
      fetchGoogleAirQualityPoint(lat, lng),
      // You would need to implement WAQI point fetch
      null,
    ]);

    return {
      google: googleData
        ? {
            aqi: googleData.indexes?.find((idx) => idx.code === "uaqi")?.aqi,
            pollutants: googleData.pollutants?.length || 0,
            timestamp: googleData._proxy?.timestamp,
          }
        : null,
      waqi: waqiData,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return null;
  }
}
