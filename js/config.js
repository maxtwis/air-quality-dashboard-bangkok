// Modern Air Quality Dashboard Configuration
// Helper function to safely get environment variables
const getEnvVar = (name) => {
  // Try window first (for client-side), then process.env (for server-side)
  if (typeof window !== "undefined" && window[name]) {
    return window[name];
  }
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    return process.env[name];
  }
  return "";
};

export const CONFIG = {
  // API_TOKEN no longer needed client-side - handled by proxy endpoints
  API_TOKEN: "", // Kept for backward compatibility, but unused

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

  API_BASE_URL: "https://api.waqi.info",

  // Default indicator type (AQI or AQHI)
  DEFAULT_INDICATOR: "AQHI",

  TILE_LAYER: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },

  // Modern color scheme matching IQAir
  COLORS: {
    primary: "#1e40af",
    secondary: "#3b82f6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    purple: "#8b5cf6",
    gray: "#6b7280",
  },
};

// Thai AQI thresholds and colors (5 stages)
export const AQI_LEVELS = {
  VERY_GOOD: {
    max: 25,
    color: "#06b6d4", // cyan
    label: "ดีมาก",
    description:
      "คุณภาพอากาศดีมาก เหมาะสำหรับกิจกรรมกลางแจ้งและการออกกำลังกาย",
  },
  GOOD: {
    max: 50,
    color: "#10b981", // green
    label: "ดี",
    description:
      "คุณภาพอากาศอยู่ในเกณฑ์ที่น่าพอใจ และมลพิษทางอากาศมีความเสี่ยงน้อยหรือไม่มีเลย",
  },
  MODERATE: {
    max: 100,
    color: "#f59e0b", // yellow
    label: "ปานกลาง",
    description:
      "คุณภาพอากาศอยู่ในเกณฑ์ที่ยอมรับได้ อย่างไรก็ตาม อาจมีความเสี่ยงต่อบางคน โดยเฉพาะผู้ที่มีความไวต่อมลพิษทางอากาศผิดปกติ",
  },
  UNHEALTHY: {
    max: 200,
    color: "#f97316", // orange
    label: "เริ่มมีผลกระทบต่อสุขภาพ",
    description:
      "เริ่มมีผลกระทบต่อสุขภาพ โดยเฉพาะกลุ่มเสี่ยง ควรลดกิจกรรมกลางแจ้ง",
  },
  VERY_UNHEALTHY: {
    max: Infinity,
    color: "#ef4444", // red
    label: "มีผลกระทบต่อสุขภาพ",
    description:
      "มีผลกระทบต่อสุขภาพ ทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้ง",
  },
};

// Pollutant configuration
export const POLLUTANTS = {
  pm25: {
    name: "PM2.5",
    fullName: "Fine Particulate Matter",
    unit: "μg/m³",
    description: "Fine particles with diameter less than 2.5 micrometers",
    color: "#ef4444",
  },
  pm10: {
    name: "PM10",
    fullName: "Coarse Particulate Matter",
    unit: "μg/m³",
    description: "Particles with diameter less than 10 micrometers",
    color: "#f59e0b",
  },
  o3: {
    name: "O₃",
    fullName: "Ozone",
    unit: "μg/m³",
    description: "Ground-level ozone",
    color: "#3b82f6",
  },
  no2: {
    name: "NO₂",
    fullName: "Nitrogen Dioxide",
    unit: "μg/m³",
    description: "Nitrogen dioxide gas",
    color: "#8b5cf6",
  },
  so2: {
    name: "SO₂",
    fullName: "Sulfur Dioxide",
    unit: "μg/m³",
    description: "Sulfur dioxide gas",
    color: "#f97316",
  },
  co: {
    name: "CO",
    fullName: "Carbon Monoxide",
    unit: "mg/m³",
    description: "Carbon monoxide gas",
    color: "#6b7280",
  },
};

// Weather parameters
export const WEATHER_PARAMS = {
  t: {
    name: "Temperature",
    unit: "°C",
    color: "#f59e0b",
  },
  h: {
    name: "Humidity",
    unit: "%",
    color: "#3b82f6",
  },
  p: {
    name: "Pressure",
    unit: "hPa",
    color: "#6b7280",
  },
  w: {
    name: "Wind Speed",
    unit: "m/s",
    color: "#10b981",
  },
  wd: {
    name: "Wind Direction",
    unit: "°",
    color: "#8b5cf6",
  },
};
