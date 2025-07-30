// Modern Air Quality Dashboard Configuration
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
    },

    // Modern color scheme matching IQAir
    COLORS: {
        primary: '#1e40af',
        secondary: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        purple: '#8b5cf6',
        gray: '#6b7280'
    }
};

// AQI thresholds and modern colors
export const AQI_LEVELS = {
    GOOD: { 
        max: 50, 
        color: '#10b981', 
        label: 'Good',
        description: 'Air quality is satisfactory, and air pollution poses little or no risk.'
    },
    MODERATE: { 
        max: 100, 
        color: '#f59e0b', 
        label: 'Moderate',
        description: 'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.'
    },
    UNHEALTHY_SENSITIVE: { 
        max: 150, 
        color: '#f97316', 
        label: 'Unhealthy for Sensitive Groups',
        description: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.'
    },
    UNHEALTHY: { 
        max: 200, 
        color: '#ef4444', 
        label: 'Unhealthy',
        description: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.'
    },
    VERY_UNHEALTHY: { 
        max: 300, 
        color: '#8b5cf6', 
        label: 'Very Unhealthy',
        description: 'Health alert: The risk of health effects is increased for everyone.'
    },
    HAZARDOUS: { 
        max: Infinity, 
        color: '#6b7280', 
        label: 'Hazardous',
        description: 'Health warning of emergency conditions: everyone is more likely to be affected.'
    }
};