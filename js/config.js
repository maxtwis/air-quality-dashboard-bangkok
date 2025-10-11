// Modern Air Quality Dashboard Configuration
// Helper function to safely get environment variables
const getEnvVar = (name) => {
  // Try window first (for client-side), then process.env (for server-side)
  if (typeof window !== 'undefined' && window[name]) {
    return window[name];
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return process.env[name];
  }
  return '';
};

export const CONFIG = {
  // API_TOKEN no longer needed client-side - handled by proxy endpoints
  API_TOKEN: '', // Kept for backward compatibility, but unused

  BANGKOK_BOUNDS: {
    southwest: { lat: 13.5, lng: 100.3 },
    northeast: { lat: 14.0, lng: 100.9 },
  },

  MAP_CENTER: [13.7563, 100.5018],
  MAP_ZOOM: 11,

  // Refresh intervals per data source (in milliseconds)
  REFRESH_INTERVAL: 600000, // 10 minutes for WAQI (default)
  REFRESH_INTERVAL_WAQI: 600000, // 10 minutes for WAQI
  REFRESH_INTERVAL_GOOGLE: 3600000, // 1 hour for Google (to reduce API costs)

  API_BASE_URL: 'https://api.waqi.info',

  // Default indicator type (AQI or AQHI)
  DEFAULT_INDICATOR: 'AQI',

  TILE_LAYER: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },

  // Modern color scheme matching IQAir
  COLORS: {
    primary: '#1e40af',
    secondary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    gray: '#6b7280',
  },
};

// AQI thresholds and modern colors
export const AQI_LEVELS = {
  GOOD: {
    max: 50,
    color: '#10b981',
    label: 'Good',
    description:
      'Air quality is satisfactory, and air pollution poses little or no risk.',
  },
  MODERATE: {
    max: 100,
    color: '#f59e0b',
    label: 'Moderate',
    description:
      'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.',
  },
  UNHEALTHY_SENSITIVE: {
    max: 150,
    color: '#f97316',
    label: 'Unhealthy for Sensitive Groups',
    description:
      'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
  },
  UNHEALTHY: {
    max: 200,
    color: '#ef4444',
    label: 'Unhealthy',
    description:
      'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
  },
  VERY_UNHEALTHY: {
    max: 300,
    color: '#8b5cf6',
    label: 'Very Unhealthy',
    description:
      'Health alert: The risk of health effects is increased for everyone.',
  },
  HAZARDOUS: {
    max: Infinity,
    color: '#6b7280',
    label: 'Hazardous',
    description:
      'Health warning of emergency conditions: everyone is more likely to be affected.',
  },
};

// Pollutant configuration
export const POLLUTANTS = {
  pm25: {
    name: 'PM2.5',
    fullName: 'Fine Particulate Matter',
    unit: 'μg/m³',
    description: 'Fine particles with diameter less than 2.5 micrometers',
    icon: '🌫️',
    color: '#ef4444',
  },
  pm10: {
    name: 'PM10',
    fullName: 'Coarse Particulate Matter',
    unit: 'μg/m³',
    description: 'Particles with diameter less than 10 micrometers',
    icon: '💨',
    color: '#f59e0b',
  },
  o3: {
    name: 'O₃',
    fullName: 'Ozone',
    unit: 'μg/m³',
    description: 'Ground-level ozone',
    icon: '☀️',
    color: '#3b82f6',
  },
  no2: {
    name: 'NO₂',
    fullName: 'Nitrogen Dioxide',
    unit: 'μg/m³',
    description: 'Nitrogen dioxide gas',
    icon: '🏭',
    color: '#8b5cf6',
  },
  so2: {
    name: 'SO₂',
    fullName: 'Sulfur Dioxide',
    unit: 'μg/m³',
    description: 'Sulfur dioxide gas',
    icon: '🌋',
    color: '#f97316',
  },
  co: {
    name: 'CO',
    fullName: 'Carbon Monoxide',
    unit: 'mg/m³',
    description: 'Carbon monoxide gas',
    icon: '🚗',
    color: '#6b7280',
  },
};

// Weather parameters
export const WEATHER_PARAMS = {
  t: {
    name: 'Temperature',
    unit: '°C',
    icon: '🌡️',
    color: '#f59e0b',
  },
  h: {
    name: 'Humidity',
    unit: '%',
    icon: '💧',
    color: '#3b82f6',
  },
  p: {
    name: 'Pressure',
    unit: 'hPa',
    icon: '🌊',
    color: '#6b7280',
  },
  w: {
    name: 'Wind Speed',
    unit: 'm/s',
    icon: '💨',
    color: '#10b981',
  },
  wd: {
    name: 'Wind Direction',
    unit: '°',
    icon: '🧭',
    color: '#8b5cf6',
  },
};
