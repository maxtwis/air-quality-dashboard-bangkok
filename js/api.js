import { CONFIG } from './config.js';
import { formatBounds } from './utils.js';
// AQHI calculations are handled separately in specific modules
import { supabaseAQHI } from './aqhi-supabase.js';
import { pm25OnlySupabaseAQHI } from './aqhi-pm25-only.js';

// Enhanced API handling functions with pollutant data and AQHI calculations

// Fetch basic air quality data (fast, AQI only)
export async function fetchAirQualityData(includeAQHI = false) {
  try {
    // Use proxy endpoint to hide API keys
    const url = `/api/waqi-proxy?endpoint=bounds`;

    console.log('Fetching data from proxy:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    if (data.status !== 'ok') {
      throw new Error(`API Error: ${data.data || 'Unknown error'}`);
    }

    const stations = data.data || [];

    if (includeAQHI) {
      // Initialize Thai AQHI on first call
      if (!fetchAirQualityData._initialized) {
        console.log('🔄 Initialized Thai AQHI calculation system');
        fetchAirQualityData._initialized = true;
      }

      // Enhanced AQHI calculations using stored data
      console.log(
        '🔄 Calculating enhanced AQHI using stored 3-hour averages...',
      );
      const enhancedStations =
        await supabaseAQHI.enhanceStationsWithAQHI(stations);

      console.log('📊 Server-side collection active - client storage disabled');
      console.log(
        `✅ Enhanced AQHI calculated for ${enhancedStations.length} stations`,
      );

      return enhancedStations;
    }

    console.log(`✅ Fetched ${stations.length} stations (AQI only, fast mode)`);
    return stations;
  } catch (error) {
    console.error('Error fetching air quality data:', error);
    throw error;
  }
}

// Add AQHI calculations to existing station data
export async function enhanceStationsWithAQHI(stations) {
  try {
    // Initialize Thai AQHI on first call
    if (!fetchAirQualityData._initialized) {
      console.log('🔄 Initialized Thai AQHI calculation system');
      fetchAirQualityData._initialized = true;
    }

    console.log('🔄 Enhancing existing stations with AQHI calculations...');
    const enhancedStations =
      await supabaseAQHI.enhanceStationsWithAQHI(stations);
    console.log(
      `✅ Enhanced ${enhancedStations.length} stations with AQHI calculations`,
    );

    return enhancedStations;
  } catch (error) {
    console.error('Error enhancing stations with AQHI:', error);
    throw error;
  }
}

// Add PM2.5-only AQHI calculations to existing station data
export async function enhanceStationsWithPM25OnlyAQHI(stations) {
  try {
    console.log(
      '🔄 Enhancing existing stations with PM2.5-only AQHI calculations...',
    );
    const enhancedStations =
      await pm25OnlySupabaseAQHI.enhanceStationsWithPM25OnlyAQHI(stations);
    console.log(
      `✅ Enhanced ${enhancedStations.length} stations with PM2.5-only AQHI calculations`,
    );

    return enhancedStations;
  } catch (error) {
    console.error('Error enhancing stations with PM2.5-only AQHI:', error);
    throw error;
  }
}

// Fetch detailed station data including pollutants
export async function fetchStationDetails(stationUID) {
  try {
    // Use proxy endpoint to hide API keys
    const url = `/api/waqi-proxy?endpoint=station&uid=${stationUID}`;
    console.log('Fetching station details from proxy:', url);

    const response = await fetch(url);
    if (!response.ok) {
      // In development, proxy may not be available - return mock data
      if (response.status === 404) {
        console.warn('⚠️ Development mode: API proxy not available, returning mock station data');
        return {
          uid: stationUID,
          station: { name: 'Development Station' },
          aqi: 50,
          time: { s: new Date().toISOString() },
          iaqi: {
            pm25: { v: 25 },
            pm10: { v: 40 },
            o3: { v: 30 },
            no2: { v: 20 },
            so2: { v: 10 },
            co: { v: 5 }
          }
        };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error(`API Error: ${data.reason || 'Unknown error'}`);
    }

    // Return station data without automatic AQHI calculation
    // AQHI will be calculated separately when needed
    const stationData = data.data;
    return stationData;
  } catch (error) {
    console.error('Error fetching station details:', error);
    // Return null for actual errors (not development 404s)
    if (error.message.includes('HTTP error! status: 404')) {
      // This was already handled above with mock data
      return null;
    }
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
    if (data.status === 'ok' && data.data && data.data.length > 0) {
      // Return the first station as current location fallback
      return data.data[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching current location data:', error);
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
    return data.status === 'ok' ? data.data : null;
  } catch (error) {
    console.error('Error fetching current location data:', error);
    return null;
  }
}
