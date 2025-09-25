// Enhanced Vercel Serverless Function - includes OpenWeather data collection
// Collects both WAQI and OpenWeather data for comprehensive AQHI calculations

export default async function handler(req, res) {
  const allowedMethods = ["POST", "GET"];
  const userAgent = req.headers["user-agent"] || "";
  const origin = req.headers["origin"] || "";
  const referer = req.headers["referer"] || "";

  console.log("🔍 Enhanced data collection started:", {
    method: req.method,
    userAgent: userAgent,
    timestamp: new Date().toISOString(),
  });

  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({
      error: "Method not allowed",
      method: req.method,
      allowedMethods: allowedMethods,
    });
  }

  try {
    // Environment check
    const requiredEnvVars = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      AQICN_API_TOKEN: process.env.AQICN_API_TOKEN,
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.error("❌ Missing environment variables:", missingVars);
      return res.status(500).json({
        error: "Missing environment variables",
        missing: missingVars,
      });
    }

    // Initialize Supabase
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      requiredEnvVars.SUPABASE_URL,
      requiredEnvVars.SUPABASE_SERVICE_ROLE_KEY,
    );

    console.log("✅ Supabase initialized");

    // Phase 1: Collect WAQI data (existing logic)
    console.log("🌍 Phase 1: Collecting WAQI station data...");
    const waqiResults = await collectWAQIData(
      supabase,
      requiredEnvVars.AQICN_API_TOKEN,
    );

    // Phase 2: Collect OpenWeather data for stations missing O3/NO2
    console.log("🌐 Phase 2: Collecting OpenWeather supplementary data...");
    const openWeatherResults = await collectOpenWeatherData(
      supabase,
      requiredEnvVars.OPENWEATHER_API_KEY,
      waqiResults.stations,
    );

    // Cleanup old data
    await cleanupOldData(supabase);

    const totalResults = {
      success: true,
      timestamp: new Date().toISOString(),
      waqi: waqiResults,
      openweather: openWeatherResults,
      summary: {
        totalStations: waqiResults.stationsStored,
        totalReadings: waqiResults.readingsStored,
        openweatherReadings: openWeatherResults.collected,
        apiCallsUsed: openWeatherResults.apiCalls,
      },
    };

    console.log("🎉 Enhanced data collection completed:", totalResults.summary);

    return res.status(200).json(totalResults);
  } catch (error) {
    console.error("❌ Enhanced collection error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

// WAQI Data Collection (existing logic with minor enhancements)
async function collectWAQIData(supabase, apiToken) {
  const startTime = Date.now();

  // Fetch station list
  const stationListUrl = `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&networks=all&token=${apiToken}`;

  console.log("📡 Fetching station list from WAQI...");
  const response = await fetch(stationListUrl);
  const data = await response.json();

  if (data.status !== "ok" || !data.data) {
    throw new Error(`WAQI API error: ${data.status}`);
  }

  console.log(`📊 Found ${data.data.length} stations from WAQI`);

  // Get detailed station data
  const detailedStations = await fetchDetailedStationData(data.data, apiToken);
  console.log(`🔍 Got detailed data for ${detailedStations.length} stations`);

  // Store data
  const storeResult = await storeWAQIData(supabase, detailedStations);

  const duration = Date.now() - startTime;

  return {
    ...storeResult,
    duration,
    stations: detailedStations,
    message: `WAQI collection completed in ${duration}ms`,
  };
}

// OpenWeather Data Collection (new functionality)
async function collectOpenWeatherData(supabase, apiKey, stations) {
  const startTime = Date.now();

  // Check API usage limits
  const { data: usageData } = await supabase.rpc("get_api_usage_stats");
  const currentUsage = usageData?.[0]?.calls_used || 0;
  const dailyLimit = 950; // Buffer under 1000

  console.log(`📊 OpenWeather API usage: ${currentUsage}/${dailyLimit}`);

  if (currentUsage >= dailyLimit) {
    console.log("⚠️ Daily OpenWeather API limit reached");
    return {
      success: false,
      collected: 0,
      apiCalls: 0,
      message: "Daily API limit reached",
      usage: { used: currentUsage, limit: dailyLimit },
    };
  }

  // Identify stations that need supplementary data
  const stationsNeedingData = await identifyStationsNeedingSupplementaryData(
    supabase,
    stations,
  );

  console.log(
    `🎯 Found ${stationsNeedingData.length} stations needing OpenWeather data`,
  );

  if (stationsNeedingData.length === 0) {
    return {
      success: true,
      collected: 0,
      apiCalls: 0,
      message: "No stations need supplementary data",
      usage: { used: currentUsage, limit: dailyLimit },
    };
  }

  // Limit calls based on remaining quota and collection strategy
  const maxCallsToday = Math.min(
    stationsNeedingData.length,
    dailyLimit - currentUsage,
    50, // Don't use more than 50 calls per collection cycle
  );

  console.log(`📞 Planning ${maxCallsToday} OpenWeather API calls`);

  // Collect OpenWeather data
  const collectedData = [];
  let successfulCalls = 0;
  let failedCalls = 0;

  for (let i = 0; i < maxCallsToday; i++) {
    const station = stationsNeedingData[i];

    try {
      const openWeatherData = await fetchOpenWeatherData(
        apiKey,
        station.lat,
        station.lon,
      );

      if (openWeatherData) {
        // Increment API usage counter
        await supabase.rpc("check_and_increment_api_usage");

        collectedData.push({
          lat: parseFloat(station.lat.toFixed(7)),
          lon: parseFloat(station.lon.toFixed(7)),
          ...openWeatherData,
          api_source: "openweather",
          timestamp: new Date().toISOString(),
        });

        successfulCalls++;
        console.log(
          `✅ OpenWeather data collected for ${station.lat}, ${station.lon}`,
        );
      } else {
        failedCalls++;
        console.log(
          `❌ Failed to collect OpenWeather data for ${station.lat}, ${station.lon}`,
        );
      }

      // Small delay between calls to be respectful
      if (i < maxCallsToday - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      failedCalls++;
      console.error(
        `❌ Error collecting OpenWeather data for ${station.lat}, ${station.lon}:`,
        error.message,
      );
    }
  }

  // Store collected OpenWeather data
  let stored = false;
  if (collectedData.length > 0) {
    try {
      const { error } = await supabase
        .from("openweather_readings")
        .insert(collectedData);

      if (error) throw error;
      stored = true;
      console.log(`💾 Stored ${collectedData.length} OpenWeather readings`);
    } catch (error) {
      console.error("Error storing OpenWeather data:", error);
    }
  }

  const duration = Date.now() - startTime;
  const finalUsage = await supabase.rpc("get_api_usage_stats");

  return {
    success: stored && collectedData.length > 0,
    collected: collectedData.length,
    apiCalls: successfulCalls + failedCalls,
    successfulCalls,
    failedCalls,
    duration,
    usage: finalUsage?.[0] || { used: currentUsage, limit: dailyLimit },
    message: `OpenWeather collection completed: ${collectedData.length} readings in ${duration}ms`,
  };
}

// Helper function to identify stations needing supplementary data
async function identifyStationsNeedingSupplementaryData(supabase, stations) {
  const needingData = [];

  for (const station of stations) {
    const hasO3 = station.iaqi?.o3?.v !== undefined;
    const hasNO2 = station.iaqi?.no2?.v !== undefined;

    if (!hasO3 || !hasNO2) {
      // Check if we have recent OpenWeather data for this location
      const latTolerance = 0.01;
      const lonTolerance = 0.01;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { data: recentData } = await supabase
        .from("openweather_readings")
        .select("id")
        .gte("lat", station.lat - latTolerance)
        .lte("lat", station.lat + latTolerance)
        .gte("lon", station.lon - lonTolerance)
        .lte("lon", station.lon + lonTolerance)
        .gte("timestamp", oneHourAgo.toISOString())
        .limit(1);

      if (!recentData || recentData.length === 0) {
        needingData.push({
          uid: station.uid,
          lat: station.lat,
          lon: station.lon,
          missing: {
            o3: !hasO3,
            no2: !hasNO2,
          },
        });
      }
    }
  }

  return needingData;
}

// Fetch data from OpenWeather API
async function fetchOpenWeatherData(apiKey, lat, lon) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`OpenWeather API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data?.list?.[0]?.components) {
      console.error("Invalid OpenWeather API response format");
      return null;
    }

    const components = data.list[0].components;

    return {
      pm25: components.pm2_5 || null,
      pm10: components.pm10 || null,
      o3: components.o3 || null,
      no2: components.no2 || null,
      so2: components.so2 || null,
      co: components.co ? components.co / 1000 : null, // Convert to mg/m³
    };
  } catch (error) {
    console.error("Error fetching OpenWeather data:", error);
    return null;
  }
}

// Store WAQI data (FIXED: Now converts AQI to concentrations)
async function storeWAQIData(supabase, detailedStations) {
  const timestamp = new Date().toISOString();
  const stationsToStore = [];
  const readings = [];

  // CRITICAL FIX: Import AQI converter for server-side use
  const { convertStationDataForSupabase } = require('../lib/aqi-converter-node.js');

  console.log('🔄 Converting AQI values to concentrations for Supabase storage...');

  // Helper function to safely extract AQI values (kept for reference)
  function extractAQIValue(stationData, pollutant) {
    const value = stationData.iaqi?.[pollutant]?.v;
    return typeof value === "number" ? value : null;
  }

  // Process each station
  for (const stationData of detailedStations) {
    // Station metadata
    const station = {
      station_uid: stationData.uid,
      name: stationData.station?.name || `Station ${stationData.uid}`,
      latitude: stationData.lat,
      longitude: stationData.lon,
      city: "Bangkok",
      country: "Thailand",
      is_active: true,
    };

    if (!station.station_uid || !station.latitude || !station.longitude) {
      continue;
    }

    stationsToStore.push(station);

    // CRITICAL FIX: Convert AQI values to raw concentrations before storing
    const convertedConcentrations = convertStationDataForSupabase(stationData);

    // Reading data with CONVERTED CONCENTRATIONS instead of AQI values
    const reading = {
      station_uid: station.station_uid,
      timestamp: timestamp,
      lat: station.latitude,
      lon: station.longitude,
      aqi:
        typeof stationData.aqi === "number"
          ? stationData.aqi
          : typeof stationData.aqi === "string"
            ? parseInt(stationData.aqi)
            : null,

      // FIXED: Store converted concentrations (μg/m³) instead of AQI values
      pm25: convertedConcentrations.pm25 || null,
      pm10: convertedConcentrations.pm10 || null,
      o3: convertedConcentrations.o3 || null,
      no2: convertedConcentrations.no2 || null,
      so2: convertedConcentrations.so2 || null,
      co: convertedConcentrations.co || null,

      station_name: station.name,
    };

    readings.push(reading);
  }

  // Store stations (upsert)
  if (stationsToStore.length > 0) {
    const { error: stationsError } = await supabase
      .from("stations")
      .upsert(stationsToStore, {
        onConflict: "station_uid",
        ignoreDuplicates: false,
      });

    if (stationsError) throw stationsError;
  }

  // Store readings
  if (readings.length > 0) {
    const { error: readingsError } = await supabase
      .from("air_quality_readings")
      .insert(readings);

    if (readingsError) throw readingsError;
  }

  return {
    stationsStored: stationsToStore.length,
    readingsStored: readings.length,
  };
}

// Fetch detailed station data (existing logic)
async function fetchDetailedStationData(stations, apiToken) {
  const detailedStations = [];
  const batchSize = 5;

  console.log(`🚀 Fetching detailed data for ${stations.length} stations...`);

  for (let i = 0; i < stations.length; i += batchSize) {
    const batch = stations.slice(i, i + batchSize);

    const promises = batch.map(async (station) => {
      try {
        const url = `https://api.waqi.info/feed/@${station.uid}/?token=${apiToken}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "ok" && data.data) {
          return {
            ...data.data,
            uid: station.uid,
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching station ${station.uid}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    const validResults = batchResults.filter((result) => result !== null);
    detailedStations.push(...validResults);

    // Respectful delay between batches
    if (i + batchSize < stations.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return detailedStations;
}

// Cleanup old data
async function cleanupOldData(supabase) {
  try {
    // Cleanup OpenWeather data older than 7 days
    const { data: deletedCount } = await supabase.rpc(
      "cleanup_old_openweather_data",
    );

    if (deletedCount > 0) {
      console.log(`🗑️ Cleaned up ${deletedCount} old OpenWeather records`);
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}
