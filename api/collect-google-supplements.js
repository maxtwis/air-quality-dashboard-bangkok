// Google Air Quality Supplement Collection (Simple Version)
// Fetches O3/NO2 from Google API for WAQI stations missing these pollutants

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleApiKey = process.env.GOOGLE_AIR_QUALITY_API_KEY;

export default async function handler(req, res) {
  console.log('🌐 Starting Google O3/NO2 supplement collection...');

  if (!googleApiKey) {
    console.log('⚠️ Google API key not configured');
    return res.status(200).json({
      success: true,
      message: 'Google API key not configured - no supplements collected',
    });
  }

  try {
    // Step 1: Get latest WAQI data from waqi-proxy endpoint
    console.log('📊 Fetching WAQI stations...');
    const waqiUrl = 'https://clean-air-bkk.vercel.app/api/waqi-proxy?endpoint=bounds&latlng=13.5,100.3,14.0,100.9';
    const waqiResponse = await fetch(waqiUrl);
    const waqiData = await waqiResponse.json();

    if (!waqiData || !waqiData.data) {
      throw new Error(`Failed to fetch WAQI stations: ${JSON.stringify(waqiData)}`);
    }

    const waqiStations = waqiData.data;
    console.log(`📍 Found ${waqiStations.length} WAQI stations`);

    // Step 2: Find stations missing O3 or NO2
    const stationsNeedingSupplements = waqiStations.filter((station) => {
      const hasO3 = station.o3 !== undefined && station.o3 !== null;
      const hasNO2 = station.no2 !== undefined && station.no2 !== null;
      return !hasO3 || !hasNO2;
    });

    if (stationsNeedingSupplements.length === 0) {
      console.log('✅ All stations have complete O3/NO2 data');
      return res.status(200).json({
        success: true,
        message: 'All stations have complete O3/NO2 data',
        stationsChecked: waqiStations.length,
        supplementsAdded: 0,
      });
    }

    console.log(
      `📊 Found ${stationsNeedingSupplements.length}/${waqiStations.length} stations needing supplements`
    );

    // Step 3: Map stations to nearest grid points (3x3 grid)
    const gridCache = {};

    for (const station of stationsNeedingSupplements) {
      const gridPoint = findNearestGridPoint(station.lat, station.lon);
      const cacheKey = `${gridPoint.lat},${gridPoint.lng}`;

      if (!gridCache[cacheKey]) {
        gridCache[cacheKey] = {
          gridPoint,
          stations: [],
        };
      }
      gridCache[cacheKey].stations.push(station);
    }

    const uniqueGridPoints = Object.keys(gridCache).length;
    console.log(
      `🎯 ${uniqueGridPoints} unique grid points needed for ${stationsNeedingSupplements.length} stations`
    );

    // Step 4: Fetch Google data for each grid point
    const googleDataMap = {};

    for (const [cacheKey, { gridPoint }] of Object.entries(gridCache)) {
      try {
        console.log(`🌐 Fetching Google data for grid point ${cacheKey}...`);
        const googleData = await fetchGoogleAirQuality(
          gridPoint.lat,
          gridPoint.lng,
          googleApiKey
        );

        if (googleData) {
          googleDataMap[cacheKey] = extractPollutants(googleData);
          console.log(
            `✅ Got Google data: O3=${googleDataMap[cacheKey].o3 || 'N/A'}, NO2=${googleDataMap[cacheKey].no2 || 'N/A'}`
          );
        }
      } catch (error) {
        console.error(`❌ Failed to fetch Google data for ${cacheKey}:`, error.message);
      }
    }

    console.log(`💾 Fetched Google data from ${Object.keys(googleDataMap).length} grid points`);

    // Step 5: Create supplement records
    const supplementRecords = [];
    const timestamp = new Date().toISOString();

    for (const [cacheKey, { gridPoint, stations }] of Object.entries(gridCache)) {
      const googleData = googleDataMap[cacheKey];
      if (!googleData || (!googleData.o3 && !googleData.no2)) continue;

      for (const station of stations) {
        supplementRecords.push({
          station_uid: station.uid,
          timestamp: timestamp,
          o3: googleData.o3 || null,
          no2: googleData.no2 || null,
          grid_lat: gridPoint.lat,
          grid_lon: gridPoint.lng,
        });
      }
    }

    // Step 6: Store in Supabase (if configured)
    let stored = 0;
    if (supabaseUrl && supabaseKey && supplementRecords.length > 0) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error: insertError } = await supabase
          .from('google_supplements')
          .insert(supplementRecords);

        if (insertError) {
          console.error('❌ Failed to store in Supabase:', insertError.message);
        } else {
          stored = supplementRecords.length;
          console.log(`✅ Stored ${stored} supplement records in Supabase`);
        }
      } catch (dbError) {
        console.error('❌ Database error:', dbError.message);
      }
    }

    console.log(`💰 Total Google API calls: ${Object.keys(googleDataMap).length}`);

    return res.status(200).json({
      success: true,
      timestamp: timestamp,
      stationsChecked: waqiStations.length,
      stationsNeedingSupplements: stationsNeedingSupplements.length,
      gridPointsUsed: Object.keys(googleDataMap).length,
      googleApiCalls: Object.keys(googleDataMap).length,
      supplementsAdded: supplementRecords.length,
      storedInDatabase: stored,
      message: `Successfully added O3/NO2 supplements for ${supplementRecords.length} stations`,
    });
  } catch (error) {
    console.error('❌ Error in Google supplement collection:', error);
    return res.status(500).json({
      error: 'Collection failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Find nearest 3x3 grid point for a station
function findNearestGridPoint(stationLat, stationLon) {
  const gridPoints = [];
  const latMin = 13.5;
  const latMax = 14.0;
  const lngMin = 100.3;
  const lngMax = 100.9;
  const latStep = (latMax - latMin) / 2;
  const lngStep = (lngMax - lngMin) / 2;

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      gridPoints.push({
        lat: Math.round((latMin + i * latStep) * 1000) / 1000,
        lng: Math.round((lngMin + j * lngStep) * 1000) / 1000,
      });
    }
  }

  let nearest = gridPoints[0];
  let minDist = Infinity;

  for (const point of gridPoints) {
    const dist = Math.sqrt(
      Math.pow(stationLat - point.lat, 2) +
        Math.pow(stationLon - point.lng, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }

  return nearest;
}

// Fetch Google Air Quality data
async function fetchGoogleAirQuality(lat, lng, apiKey) {
  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: { latitude: lat, longitude: lng },
      extraComputations: ['POLLUTANT_CONCENTRATION', 'LOCAL_AQI'],
      languageCode: 'en',
    }),
  });

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  return await response.json();
}

// Extract O3 and NO2 from Google response
function extractPollutants(googleData) {
  const result = { o3: null, no2: null };

  if (!googleData.pollutants) return result;

  for (const pollutant of googleData.pollutants) {
    if (pollutant.code === 'o3' && pollutant.concentration?.value) {
      // Convert ppb to µg/m³: multiply by 2.0
      result.o3 = Math.round(pollutant.concentration.value * 2.0 * 10) / 10;
    } else if (pollutant.code === 'no2' && pollutant.concentration?.value) {
      // Convert ppb to µg/m³: multiply by 1.88
      result.no2 = Math.round(pollutant.concentration.value * 1.88 * 10) / 10;
    }
  }

  return result;
}
