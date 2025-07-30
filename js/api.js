import { CONFIG } from './config.js';
import { formatBounds } from './utils.js';

// API handling functions

export async function fetchAirQualityData() {
    try {
        const boundsStr = formatBounds(CONFIG.BANGKOK_BOUNDS);
        const url = `${CONFIG.API_BASE_URL}/map/bounds?token=${CONFIG.API_TOKEN}&latlng=${boundsStr}`;
        
        console.log('Fetching data from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        if (data.status !== 'ok') {
            throw new Error(`API Error: ${data.message || 'Unknown error'}`);
        }
        
        return data.data || [];
    } catch (error) {
        console.error('Error fetching air quality data:', error);
        throw error;
    }
}

// Fetch data for specific station (if needed for detailed info)
export async function fetchStationDetails(stationId) {
    try {
        const url = `${CONFIG.API_BASE_URL}/feed/@${stationId}/?token=${CONFIG.API_TOKEN}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.status === 'ok' ? data.data : null;
    } catch (error) {
        console.error('Error fetching station details:', error);
        return null;
    }
}