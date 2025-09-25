// Node.js compatible AQI to concentration converter for server-side data collection
// Same logic as client-side but CommonJS compatible for Vercel functions

/**
 * US EPA AQI Breakpoints (Updated 2024 for PM2.5)
 * Format: [AQI_low, AQI_high, Conc_low, Conc_high]
 */
const EPA_AQI_BREAKPOINTS = {
  // PM2.5 (24-hour average, μg/m³) - Updated 2024
  pm25: [
    [0, 50, 0.0, 9.0],           // Good
    [51, 100, 9.1, 35.4],        // Moderate
    [101, 150, 35.5, 55.4],      // Unhealthy for Sensitive
    [151, 200, 55.5, 125.4],     // Unhealthy
    [201, 300, 125.5, 225.4],    // Very Unhealthy
    [301, 500, 225.5, 325.4],    // Hazardous
    [501, 999, 325.5, 500.4]     // Hazardous (extended)
  ],

  // PM10 (24-hour average, μg/m³)
  pm10: [
    [0, 50, 0, 54],              // Good
    [51, 100, 55, 154],          // Moderate
    [101, 150, 155, 254],        // Unhealthy for Sensitive
    [151, 200, 255, 354],        // Unhealthy
    [201, 300, 355, 424],        // Very Unhealthy
    [301, 500, 425, 604],        // Hazardous
    [501, 999, 605, 1004]        // Hazardous (extended)
  ],

  // Ozone (8-hour average, ppm) - Convert to μg/m³ using factor 1962
  o3_8hr: [
    [0, 50, 0.000, 0.054],       // Good
    [51, 100, 0.055, 0.070],     // Moderate
    [101, 150, 0.071, 0.085],    // Unhealthy for Sensitive
    [151, 200, 0.086, 0.105],    // Unhealthy
    [201, 300, 0.106, 0.200]     // Very Unhealthy
  ],

  // NO2 (1-hour average, ppb) - Convert to μg/m³ using factor 1.88
  no2: [
    [0, 50, 0, 53],              // Good
    [51, 100, 54, 100],          // Moderate
    [101, 150, 101, 360],        // Unhealthy for Sensitive
    [151, 200, 361, 649],        // Unhealthy
    [201, 300, 650, 1249],       // Very Unhealthy
    [301, 500, 1250, 2049]       // Hazardous
  ],

  // SO2 (1-hour average, ppb) - Convert to μg/m³ using factor 2.62
  so2: [
    [0, 50, 0, 35],              // Good
    [51, 100, 36, 75],           // Moderate
    [101, 150, 76, 185],         // Unhealthy for Sensitive
    [151, 200, 186, 304],        // Unhealthy
    [201, 300, 305, 604],        // Very Unhealthy
    [301, 500, 605, 1004]        // Hazardous
  ],

  // CO (8-hour average, ppm) - Convert to mg/m³ using factor 1.15
  co: [
    [0, 50, 0.0, 4.4],           // Good
    [51, 100, 4.5, 9.4],         // Moderate
    [101, 150, 9.5, 12.4],       // Unhealthy for Sensitive
    [151, 200, 12.5, 15.4],      // Unhealthy
    [201, 300, 15.5, 30.4],      // Very Unhealthy
    [301, 500, 30.5, 50.4]       // Hazardous
  ]
};

/**
 * Unit conversion factors (pollutant ppm/ppb to μg/m³ at 25°C, 1 atm)
 */
const CONVERSION_FACTORS = {
  o3_ppm_to_ugm3: 1962,
  no2_ppb_to_ugm3: 1.88,
  so2_ppb_to_ugm3: 2.62,
  co_ppm_to_mgm3: 1.15
};

/**
 * Convert AQI value back to raw concentration using EPA linear interpolation formula
 * @param {number} aqi - AQI value to convert
 * @param {string} pollutant - Pollutant type (pm25, pm10, o3, no2, so2, co)
 * @returns {number|null} - Raw concentration in μg/m³ (or mg/m³ for CO) or null if invalid
 */
function aqiToConcentration(aqi, pollutant) {
  if (typeof aqi !== 'number' || aqi < 0) {
    return null;
  }

  // Handle ozone special case with 8hr averaging period
  let pollutantKey = pollutant.toLowerCase();
  if (pollutantKey === 'o3') {
    pollutantKey = 'o3_8hr';
  }

  const breakpoints = EPA_AQI_BREAKPOINTS[pollutantKey];
  if (!breakpoints) {
    return null;
  }

  // Find the correct breakpoint range
  let selectedBreakpoint = null;
  for (const breakpoint of breakpoints) {
    const [aqiLo, aqiHi, concLo, concHi] = breakpoint;
    if (aqi >= aqiLo && aqi <= aqiHi) {
      selectedBreakpoint = breakpoint;
      break;
    }
  }

  if (!selectedBreakpoint) {
    return null;
  }

  const [aqiLo, aqiHi, concLo, concHi] = selectedBreakpoint;

  // EPA linear interpolation formula (reverse)
  const concentration = ((aqi - aqiLo) / (aqiHi - aqiLo)) * (concHi - concLo) + concLo;

  // Convert units if needed
  let finalConcentration = concentration;

  if (pollutantKey === 'o3_8hr') {
    finalConcentration = concentration * CONVERSION_FACTORS.o3_ppm_to_ugm3;
  } else if (pollutantKey === 'no2') {
    finalConcentration = concentration * CONVERSION_FACTORS.no2_ppb_to_ugm3;
  } else if (pollutantKey === 'so2') {
    finalConcentration = concentration * CONVERSION_FACTORS.so2_ppb_to_ugm3;
  } else if (pollutantKey === 'co') {
    finalConcentration = concentration * CONVERSION_FACTORS.co_ppm_to_mgm3;
  }

  return Math.round(finalConcentration * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert station data from AQI values to raw concentrations for Supabase storage
 * @param {Object} stationData - WAQI station data with iaqi pollutant values
 * @returns {Object} - Converted concentrations
 */
function convertStationDataForSupabase(stationData) {
  const conversions = {};
  const conversionLog = [];

  if (!stationData?.iaqi) {
    return conversions;
  }

  // Weather/non-pollutant parameters to skip
  const WEATHER_PARAMETERS = ['h', 't', 'p', 'w', 'wd', 'r', 'dew'];

  // Convert each available pollutant
  Object.keys(stationData.iaqi).forEach(pollutant => {
    const aqiValue = stationData.iaqi[pollutant]?.v;

    if (typeof aqiValue === 'number' && !WEATHER_PARAMETERS.includes(pollutant)) {
      const rawConc = aqiToConcentration(aqiValue, pollutant);
      if (rawConc !== null) {
        conversions[pollutant] = rawConc;
        conversionLog.push(`${pollutant.toUpperCase()}: ${aqiValue} AQI → ${rawConc} ${pollutant === 'co' ? 'mg/m³' : 'μg/m³'}`);
      }
    }
  });

  const stationName = stationData.station?.name || stationData.uid || 'unknown';
  if (conversionLog.length > 0) {
    console.log(`🔄 [SUPABASE] Converting ${stationName}: ${conversionLog.join(', ')}`);
  }

  return conversions;
}

module.exports = {
  aqiToConcentration,
  convertStationDataForSupabase,
  EPA_AQI_BREAKPOINTS,
  CONVERSION_FACTORS
};