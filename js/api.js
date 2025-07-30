import { CONFIG } from './config.js';
import { formatBounds } from './utils.js';

// Enhanced API handling functions with pollutant data

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
        
        return data.data || [];
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
        
        return data.data;
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