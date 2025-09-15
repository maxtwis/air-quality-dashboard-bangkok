import { CONFIG } from './config.js';
import { formatBounds } from './utils.js';
import { calculateStationAQHIRealistic, initializeRealisticAQHI } from './aqhi-realistic.js';

// Enhanced API handling functions with pollutant data and AQHI calculations

export async function fetchAirQualityData() {
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
        
        // Initialize realistic AQHI on first call
        if (!fetchAirQualityData._initialized) {
            const stationsWithData = initializeRealisticAQHI();
            console.log(`🔄 Initialized realistic AQHI with data from ${stationsWithData} stations`);
            fetchAirQualityData._initialized = true;
        }
        
        // Enhance stations with realistic AQHI calculations
        const stations = data.data || [];
        const enhancedStations = stations.map(station => ({
            ...station,
            aqhi: calculateStationAQHIRealistic(station)
        }));

        // Client-side storage disabled - using server-side collection only
        console.log('📊 Server-side collection active - client storage disabled');

        return enhancedStations;
    } catch (error) {
        console.error('Error fetching air quality data:', error);
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