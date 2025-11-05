import { CONFIG } from "./config.js";
import { formatBounds } from "./utils.js";
// AQHI calculations are handled separately in specific modules
import { supabaseAQHI } from "./aqhi-supabase.js";
import { pm25OnlySupabaseAQHI } from "./aqhi-pm25-only.js";

// Enhanced API handling functions with pollutant data and AQHI calculations

// Fetch basic air quality data (fast, AQI only)
export async function fetchAirQualityData(includeAQHI = false) {
  try {
    // Use proxy endpoint to hide API keys
    const url = `/api/waqi-proxy?endpoint=bounds`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== "ok") {
      throw new Error(`API Error: ${data.data || "Unknown error"}`);
    }

    const stations = data.data || [];

    if (includeAQHI) {
      // Initialize Thai AQHI on first call
      if (!fetchAirQualityData._initialized) {
        fetchAirQualityData._initialized = true;
      }

      // Enhanced AQHI calculations using stored data
      const enhancedStations =
        await supabaseAQHI.enhanceStationsWithAQHI(stations);
      return enhancedStations;
    }

    return stations;
  } catch (error) {
    throw error;
  }
}

// Add AQHI calculations to existing station data
export async function enhanceStationsWithAQHI(stations) {
  try {
    // Initialize Thai AQHI on first call
    if (!fetchAirQualityData._initialized) {
      fetchAirQualityData._initialized = true;
    }
    const enhancedStations =
      await supabaseAQHI.enhanceStationsWithAQHI(stations);
    return enhancedStations;
  } catch (error) {
    throw error;
  }
}

// Add PM2.5-only AQHI calculations to existing station data
export async function enhanceStationsWithPM25OnlyAQHI(stations) {
  try {
    const enhancedStations =
      await pm25OnlySupabaseAQHI.enhanceStationsWithPM25OnlyAQHI(stations);
    return enhancedStations;
  } catch (error) {
    throw error;
  }
}

// Fetch detailed station data including pollutants
export async function fetchStationDetails(stationUID) {
  try {
    // Use proxy endpoint to hide API keys
    const url = `/api/waqi-proxy?endpoint=station&uid=${stationUID}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "ok") {
      throw new Error(`API Error: ${data.reason || "Unknown error"}`);
    }

    // Return station data without automatic AQHI calculation
    // AQHI will be calculated separately when needed
    const stationData = data.data;
    return stationData;
  } catch (error) {
    return null;
  }
}

// Get current location data
export async function fetchCurrentLocationData() {
  try {
    // Note: Current location endpoint may need geolocation or IP-based detection
    // For now, use a default Bangkok station as fallback
    const url = `/api/waqi-proxy?endpoint=bounds`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.status === "ok" && data.data && data.data.length > 0) {
      // Return the first station as current location fallback
      return data.data[0];
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Original current location function (kept for reference)
export async function fetchCurrentLocationDataDirect() {
  try {
    const url = `${CONFIG.API_BASE_URL}/v2/feed/here/?token=${CONFIG.API_TOKEN}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.status === "ok" ? data.data : null;
  } catch (error) {
    return null;
  }
}
