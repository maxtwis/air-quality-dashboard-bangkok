// Google Air Quality Supplement Collection (Runs Every 60 Minutes)
// Supplements WAQI stations with missing O3/NO2 from Google API

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleApiKey = process.env.GOOGLE_AIR_QUALITY_API_KEY;

export default async function handler(req, res) {
  console.log('🌐 Starting Google O3/NO2 supplement collection...');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase configuration');
    return res.status(500).json({
      error: 'Supabase not configured',
      message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required',
    });
  }

  if (!googleApiKey) {
    console.log('⚠️ Google API key not configured - skipping supplements');
    return res.status(200).json({
      success: true,
      message: 'Google API key not configured - no supplements collected',
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Get all stations from stations table
    console.log('📊 Fetching stations from database...');
    const { data: stations, error: stationsError } = await supabase
      .from('stations')
      .select('uid, name, lat, lon');

    if (stationsError) {
      throw new Error(`Failed to fetch stations: ${stationsError.message}`);
    }

    if (!stations || stations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No stations found in database',
        stationsChecked: 0,
        supplementsAdded: 0,
      });
    }

    console.log(`📍 Found ${stations.length} stations in database`);

    // Step 2: Check latest_station_readings or current_3h_averages for O3/NO2
    const { data: latestReadings, error: readingsError } = await supabase
      .from('latest_station_readings')
      .select('station_uid, o3, no2');

    if (readingsError) {
      console.log('⚠️ Could not fetch latest readings:', readingsError.message);
      console.log('⚠️ Assuming all stations need supplements');
    }

    // Step 3: Identify stations missing O3/NO2
    const stationsNeedingSupplements = stations.filter((station) => {
      if (!latestReadings || latestReadings.length === 0) return true;

      const reading = latestReadings.find((r) => r.station_uid === station.uid);
      if (!reading) return true; // No recent reading

      // Check if has complete O3 and NO2
      const hasO3 = reading.o3 !== null && reading.o3 !== undefined && reading.o3 > 0;
      const hasNO2 = reading.no2 !== null && reading.no2 !== undefined && reading.no2 > 0;

      return !hasO3 || !hasNO2; // Need supplement if missing either
    });

    if (stationsNeedingSupplements.length === 0) {
      console.log('✅ All stations have complete O3/NO2 data');
      return res.status(200).json({
        success: true,
        message: 'All stations have complete O3/NO2 data',
        stationsChecked: stations.length,
        supplementsAdded: 0,
      });
    }

    console.log(
      `📊 Found ${stationsNeedingSupplements.length}/${stations.length} stations needing O3/NO2 supplements`
    );

    // Step 4: Map stations to nearest grid points (smart caching)
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

    // Step 5: Fetch Google data for each unique grid point
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
          googleDataMap[cacheKey] = extractGooglePollutants(googleData);
          console.log(
            `✅ Got Google data for ${cacheKey}: O3=${googleDataMap[cacheKey].o3 || 'N/A'}, NO2=${googleDataMap[cacheKey].no2 || 'N/A'}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Failed to fetch Google data for ${cacheKey}:`,
          error.message
        );
      }
    }

    console.log(
      `💾 Fetched Google data from ${Object.keys(googleDataMap).length} grid points`
    );

    // Step 6: Create supplement readings for Supabase
    const supplementReadings = [];
    const timestamp = new Date().toISOString();

    for (const [cacheKey, { stations: stationGroup }] of Object.entries(
      gridCache
    )) {
      const googleData = googleDataMap[cacheKey];
      if (!googleData || (!googleData.o3 && !googleData.no2)) continue;

      for (const station of stationGroup) {
        supplementReadings.push({
          station_uid: station.uid,
          timestamp: timestamp,
          o3: googleData.o3 || null,
          no2: googleData.no2 || null,
          data_source: 'GOOGLE_SUPPLEMENT',
        });
      }
    }

    // Step 7: Store supplements in database
    if (supplementReadings.length > 0) {
      const { error: insertError } = await supabase
        .from('air_quality_readings')
        .insert(supplementReadings);

      if (insertError) {
        throw new Error(`Failed to store supplements: ${insertError.message}`);
      }

      console.log(
        `✅ Stored ${supplementReadings.length} supplement readings in database`
      );
    }

    console.log(`💰 Total Google API calls: ${Object.keys(googleDataMap).length}`);

    return res.status(200).json({
      success: true,
      timestamp: timestamp,
      stationsChecked: stations.length,
      stationsNeedingSupplements: stationsNeedingSupplements.length,
      gridPointsUsed: Object.keys(googleDataMap).length,
      googleApiCalls: Object.keys(googleDataMap).length,
      supplementsAdded: supplementReadings.length,
      message: `Successfully added O3/NO2 supplements for ${supplementReadings.length} station readings`,
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
  const latStep = (latMax - latMin) / 2; // 3x3 grid
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

// Fetch Google Air Quality data for a specific point
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

// Extract O3 and NO2 from Google API response
function extractGooglePollutants(googleData) {
  const result = { o3: null, no2: null };

  if (!googleData.pollutants) return result;

  for (const pollutant of googleData.pollutants) {
    if (pollutant.code === 'o3' && pollutant.concentration?.value) {
      // Convert ppb to µg/m³ for O3: multiply by 2.0
      result.o3 = Math.round(pollutant.concentration.value * 2.0 * 10) / 10;
    } else if (pollutant.code === 'no2' && pollutant.concentration?.value) {
      // Convert ppb to µg/m³ for NO2: multiply by 1.88
      result.no2 = Math.round(pollutant.concentration.value * 1.88 * 10) / 10;
    }
  }

  return result;
}
