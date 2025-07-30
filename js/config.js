// Configuration constants
export const CONFIG = {
    API_TOKEN: '354eb1b871693ef55f777c69e44e81bcaf215d40',
    
    BANGKOK_BOUNDS: {
        southwest: { lat: 13.5, lng: 100.3 },
        northeast: { lat: 14.0, lng: 100.9 }
    },
    
    MAP_CENTER: [13.7563, 100.5018],
    MAP_ZOOM: 11,
    
    REFRESH_INTERVAL: 600000, // 10 minutes in milliseconds
    
    API_BASE_URL: 'https://api.waqi.info',
    
    TILE_LAYER: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors'
    }
};

// AQI thresholds and colors
export const AQI_LEVELS = {
    GOOD: { max: 50, color: '#27ae60', label: 'Good' },
    MODERATE: { max: 100, color: '#f39c12', label: 'Moderate' },
    UNHEALTHY_SENSITIVE: { max: 150, color: '#e67e22', label: 'Unhealthy for Sensitive Groups' },
    UNHEALTHY: { max: 200, color: '#e74c3c', label: 'Unhealthy' },
    VERY_UNHEALTHY: { max: 300, color: '#8e44ad', label: 'Very Unhealthy' },
    HAZARDOUS: { max: Infinity, color: '#2c3e50', label: 'Hazardous' }
};