// Google Air Quality Data Storage to Supabase
// Stores Google API data for 3-hour AQHI calculations

import { supabase } from "../lib/supabase.js";

/**
 * Store Google Air Quality data in Supabase
 * @param {Array} googleStations - Array of stations with Google API data
 * @returns {Promise<Object>} Storage result
 */
export async function storeGoogleDataInSupabase(googleStations) {
  if (!supabase) {
    console.warn("⚠️ Supabase not configured, skipping Google data storage");
    return { stored: false, reason: "Supabase not configured" };
  }

  try {
    console.log(
      `🔄 Storing ${googleStations.length} Google stations in Supabase...`,
    );

    const timestamp = new Date().toISOString();
    const stationsToStore = [];
    const readings = [];

    for (const googleStation of googleStations) {
      // Extract station metadata
      const station = {
        station_uid: googleStation.uid,
        name: googleStation.station?.name || "Unknown",
        latitude: googleStation.lat,
        longitude: googleStation.lon,
        city: "Bangkok",
        country: "Thailand",
        data_source: "GOOGLE",
        is_active: true,
      };

      if (!station.station_uid || !station.latitude || !station.longitude) {
        console.warn(`⚠️ Skipping invalid Google station:`, googleStation);
        continue;
      }

      stationsToStore.push(station);

      // Extract pollutant concentrations from Google data
      const concentrations = extractGoogleConcentrations(googleStation);

      // Create reading record
      const reading = {
        station_uid: station.station_uid,
        timestamp: timestamp,
        aqi: googleStation.aqi || null,
        data_source: "GOOGLE",

        // Pollutant concentrations (already in correct units from Google)
        pm25: concentrations.pm25,
        pm10: concentrations.pm10,
        o3: concentrations.o3,
        no2: concentrations.no2,
        so2: concentrations.so2,
        co: concentrations.co,

        // Store raw Google data for debugging
        raw_data: googleStation._rawData || googleStation,
      };

      readings.push(reading);
    }

    // Store stations (upsert - update if exists, insert if new)
    let stationsResult = null;
    if (stationsToStore.length > 0) {
      const { data, error } = await supabase
        .from("stations")
        .upsert(stationsToStore, {
          onConflict: "station_uid",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("❌ Error storing Google stations:", error);
        throw error;
      }

      stationsResult = { stored: stationsToStore.length };
      console.log(`✅ Stored ${stationsToStore.length} Google stations`);
    }

    // Store readings
    let readingsResult = null;
    if (readings.length > 0) {
      const { data, error } = await supabase
        .from("air_quality_readings")
        .insert(readings);

      if (error) {
        console.error("❌ Error storing Google readings:", error);
        throw error;
      }

      readingsResult = { stored: readings.length };
      console.log(`✅ Stored ${readings.length} Google readings`);
    }

    const result = {
      stored: true,
      timestamp: timestamp,
      stations: stationsResult?.stored || 0,
      readings: readingsResult?.stored || 0,
    };

    console.log("✅ Google data storage complete:", result);
    return result;
  } catch (error) {
    console.error("❌ Error storing Google data in Supabase:", error);
    return {
      stored: false,
      error: error.message,
    };
  }
}

/**
 * Extract pollutant concentrations from Google API response
 * Google provides concentrations in proper units already
 * @param {Object} googleStation - Google station data
 * @returns {Object} Pollutant concentrations in μg/m³ (except CO in mg/m³)
 */
function extractGoogleConcentrations(googleStation) {
  const concentrations = {
    pm25: null,
    pm10: null,
    o3: null,
    no2: null,
    so2: null,
    co: null,
  };

  // Google data is in iaqi object (formatted like WAQI)
  if (!googleStation.iaqi) {
    console.warn("⚠️ No iaqi data in Google station:", googleStation.uid);
    return concentrations;
  }

  // Extract values from iaqi
  for (const [pollutant, key] of [
    ["pm25", "pm25"],
    ["pm10", "pm10"],
    ["o3", "o3"],
    ["no2", "no2"],
    ["so2", "so2"],
    ["co", "co"],
  ]) {
    if (googleStation.iaqi[key]?.v !== undefined) {
      concentrations[pollutant] = parseFloat(googleStation.iaqi[key].v);
    }
  }

  return concentrations;
}

/**
 * Get 3-hour averages for Google stations from Supabase
 * @param {Array<string>} stationUids - Array of station UIDs to get averages for
 * @returns {Promise<Object>} Map of station_uid to 3-hour averages
 */
export async function getGoogle3HourAverages(stationUids) {
  if (!supabase) {
    console.warn("⚠️ Supabase not configured");
    return {};
  }

  try {
    const { data, error } = await supabase
      .from("current_3h_averages_by_source")
      .select("*")
      .eq("data_source", "GOOGLE")
      .in("station_uid", stationUids);

    if (error) throw error;

    // Convert array to map for easy lookup
    const averagesMap = {};
    for (const row of data || []) {
      averagesMap[row.station_uid] = {
        avg_pm25: row.avg_pm25,
        avg_pm10: row.avg_pm10,
        avg_o3: row.avg_o3,
        avg_no2: row.avg_no2,
        avg_so2: row.avg_so2,
        avg_co: row.avg_co,
        aqhi: row.aqhi,
        reading_count: row.reading_count,
        latest_reading: row.latest_reading,
        earliest_reading: row.earliest_reading,
      };
    }

    console.log(
      `✅ Retrieved 3-hour averages for ${Object.keys(averagesMap).length} Google stations`,
    );
    return averagesMap;
  } catch (error) {
    console.error("❌ Error getting Google 3-hour averages:", error);
    return {};
  }
}

/**
 * Clean up old Google data (older than 7 days)
 * @returns {Promise<Object>} Cleanup result
 */
export async function cleanupOldGoogleData() {
  if (!supabase) {
    return { cleaned: false, reason: "Supabase not configured" };
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from("air_quality_readings")
      .delete()
      .eq("data_source", "GOOGLE")
      .lt("timestamp", sevenDaysAgo.toISOString());

    if (error) throw error;

    console.log(`✅ Cleaned up old Google data (older than 7 days)`);
    return { cleaned: true, deletedCount: data?.length || 0 };
  } catch (error) {
    console.error("❌ Error cleaning up old Google data:", error);
    return { cleaned: false, error: error.message };
  }
}
