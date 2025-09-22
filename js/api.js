import { CONFIG } from './config.js';
import { formatBounds } from './utils.js';
import { calculateStationAQHIRealistic, initializeRealisticAQHI } from './aqhi-realistic.js';
import { supabaseAQHI } from './aqhi-supabase.js';
import { pm25OnlySupabaseAQHI } from './aqhi-pm25-only.js';

// Enhanced API handling functions with pollutant data and AQHI calculations

// Fetch basic air quality data (fast, AQI only)
export async function fetchAirQualityData(includeAQHI = false) {
    try {
        const boundsStr = formatBounds(CONFIG.BANGKOK_BOUNDS);
        const url = `${CONFIG.API_BASE_URL}/v2/map/bounds/?latlng=${boundsStr}&token=${CONFIG.API_TOKEN}`;

        console.log('Fetching data from:', url);

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
            // Initialize realistic AQHI on first call
            if (!fetchAirQualityData._initialized) {
                const stationsWithData = initializeRealisticAQHI();
                console.log(`🔄 Initialized realistic AQHI with data from ${stationsWithData} stations`);
                fetchAirQualityData._initialized = true;
            }

            // Enhanced AQHI calculations using stored data
            console.log('🔄 Calculating enhanced AQHI using stored 3-hour averages...');
            const enhancedStations = await supabaseAQHI.enhanceStationsWithAQHI(stations);

            console.log('📊 Server-side collection active - client storage disabled');
            console.log(`✅ Enhanced AQHI calculated for ${enhancedStations.length} stations`);

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
        // Initialize realistic AQHI on first call
        if (!fetchAirQualityData._initialized) {
            const stationsWithData = initializeRealisticAQHI();
            console.log(`🔄 Initialized realistic AQHI with data from ${stationsWithData} stations`);
            fetchAirQualityData._initialized = true;
        }

        console.log('🔄 Enhancing existing stations with AQHI calculations...');
        const enhancedStations = await supabaseAQHI.enhanceStationsWithAQHI(stations);
        console.log(`✅ Enhanced ${enhancedStations.length} stations with AQHI calculations`);

        return enhancedStations;
    } catch (error) {
        console.error('Error enhancing stations with AQHI:', error);
        throw error;
    }
}

// Add PM2.5-only AQHI calculations to existing station data
export async function enhanceStationsWithPM25OnlyAQHI(stations) {
    try {
        console.log('🔄 Enhancing existing stations with PM2.5-only AQHI calculations...');
        const enhancedStations = await pm25OnlySupabaseAQHI.enhanceStationsWithPM25OnlyAQHI(stations);
        console.log(`✅ Enhanced ${enhancedStations.length} stations with PM2.5-only AQHI calculations`);

        return enhancedStations;
    } catch (error) {
        console.error('Error enhancing stations with PM2.5-only AQHI:', error);
        throw error;
    }
}

// Fetch detailed station data including pollutants
export async function fetchStationDetails(stationUID) {
    try {
        const url = `${CONFIG.API_BASE_URL}/feed/@${stationUID}/?token=${CONFIG.API_TOKEN}`;
        console.log('Fetching station details:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'ok') {
            throw new Error(`API Error: ${data.reason || 'Unknown error'}`);
        }
        
        // Enhance station details with realistic AQHI
        const stationData = data.data;
        return {
            ...stationData,
            aqhi: calculateStationAQHIRealistic(stationData)
        };
    } catch (error) {
        console.error('Error fetching station details:', error);
        return null;
    }
}

// Get current location data
export async function fetchCurrentLocationData() {
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