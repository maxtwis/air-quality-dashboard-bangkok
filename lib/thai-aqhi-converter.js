// Thai Health Department AQHI Converter
// Converts AQI values to the correct units for Thai AQHI calculation

/**
 * US EPA AQI Breakpoints (for conversion)
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

  // Ozone (8-hour average, ppm) - We need this in ppb for Thai formula
  o3_8hr: [
    [0, 50, 0.000, 0.054],       // Good (ppm)
    [51, 100, 0.055, 0.070],     // Moderate (ppm)
    [101, 150, 0.071, 0.085],    // Unhealthy for Sensitive (ppm)
    [151, 200, 0.086, 0.105],    // Unhealthy (ppm)
    [201, 300, 0.106, 0.200]     // Very Unhealthy (ppm)
  ],

  // NO2 (1-hour average, ppb) - Already in ppb, perfect for Thai formula
  no2: [
    [0, 50, 0, 53],              // Good (ppb)
    [51, 100, 54, 100],          // Moderate (ppb)
    [101, 150, 101, 360],        // Unhealthy for Sensitive (ppb)
    [151, 200, 361, 649],        // Unhealthy (ppb)
    [201, 300, 650, 1249],       // Very Unhealthy (ppb)
    [301, 500, 1250, 2049]       // Hazardous (ppb)
  ]
};

/**
 * Convert AQI value to concentration for Thai AQHI formula
 * @param {number} aqi - AQI value to convert
 * @param {string} pollutant - Pollutant type (pm25, o3, no2)
 * @returns {number|null} - Concentration in correct units for Thai AQHI
 */
function aqiToThaiAQHIUnits(aqi, pollutant) {
  if (typeof aqi !== 'number' || aqi < 0) {
    return null;
  }

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

  // EPA linear interpolation formula
  const concentration = ((aqi - aqiLo) / (aqiHi - aqiLo)) * (concHi - concLo) + concLo;

  // Convert to correct units for Thai AQHI formula
  let finalConcentration = concentration;

  if (pollutantKey === 'pm25') {
    // PM2.5: Already in μg/m³ ✅
    finalConcentration = concentration;
  } else if (pollutantKey === 'o3_8hr') {
    // O3: Convert ppm to ppb (multiply by 1000)
    finalConcentration = concentration * 1000;
  } else if (pollutantKey === 'no2') {
    // NO2: Already in ppb ✅
    finalConcentration = concentration;
  }

  return Math.round(finalConcentration * 100) / 100;
}

/**
 * Convert station data for Thai AQHI calculation
 * @param {Object} stationData - WAQI station data with iaqi pollutant values
 * @returns {Object} - Concentrations in correct units for Thai AQHI
 */
export function convertStationDataForThaiAQHI(stationData) {
  const conversions = {};
  const conversionLog = [];

  if (!stationData?.iaqi) {
    return conversions;
  }

  // Convert each pollutant to Thai AQHI units
  const pollutants = ['pm25', 'o3', 'no2'];

  pollutants.forEach(pollutant => {
    const aqiValue = stationData.iaqi[pollutant]?.v;

    if (typeof aqiValue === 'number') {
      const thaiUnit = aqiToThaiAQHIUnits(aqiValue, pollutant);
      if (thaiUnit !== null) {
        conversions[pollutant] = thaiUnit;

        let unit;
        if (pollutant === 'pm25') unit = 'μg/m³';
        else if (pollutant === 'o3' || pollutant === 'no2') unit = 'ppb';

        conversionLog.push(`${pollutant.toUpperCase()}: ${aqiValue} AQI → ${thaiUnit} ${unit}`);
      }
    }
  });

  const stationName = stationData.station?.name || stationData.uid || 'unknown';
  if (conversionLog.length > 0) {
    console.log(`🇹🇭 [THAI AQHI] Converting ${stationName}: ${conversionLog.join(', ')}`);
  }

  return conversions;
}

/**
 * Calculate Thai Health Department AQHI
 * Formula: AQHI = (10/C) × Total %ER
 * Where: %ER_i = 100 × (e^(βi × xi) - 1)
 *
 * @param {number} pm25 - PM2.5 in μg/m³
 * @param {number} o3 - O3 in ppb
 * @param {number} no2 - NO2 in ppb
 * @returns {number} - Thai AQHI value
 */
export function calculateThaiAQHI(pm25, o3, no2) {
  console.log(`🇹🇭 Calculating Thai AQHI: PM2.5=${pm25}μg/m³, O3=${o3}ppb, NO2=${no2}ppb`);

  // Thai Health Department coefficients
  const THAI_COEFFICIENTS = {
    c: 105.19,  // Scaling constant
    beta: {
      pm25: 0.0012,  // Per μg/m³
      o3: 0.0010,    // Per ppb
      no2: 0.0052    // Per ppb
    }
  };

  // Calculate Percentage Excess Risk (%ER) for each pollutant
  // Formula: %ER_i = 100 × (e^(βi × xi) - 1)
  const perErPM25 = pm25 ? 100 * (Math.exp(THAI_COEFFICIENTS.beta.pm25 * pm25) - 1) : 0;
  const perErO3 = o3 ? 100 * (Math.exp(THAI_COEFFICIENTS.beta.o3 * o3) - 1) : 0;
  const perErNO2 = no2 ? 100 * (Math.exp(THAI_COEFFICIENTS.beta.no2 * no2) - 1) : 0;

  // Calculate Total Percentage Excess Risk
  const totalPerER = perErPM25 + perErO3 + perErNO2;

  // Calculate AQHI: AQHI = (10 / C) × Total %ER
  const aqhi = (10 / THAI_COEFFICIENTS.c) * totalPerER;

  const finalAQHI = Math.max(1, Math.round(aqhi));

  console.log(`🎯 Thai AQHI %ER: PM2.5=${perErPM25.toFixed(2)}%, O3=${perErO3.toFixed(2)}%, NO2=${perErNO2.toFixed(2)}%, Total=${totalPerER.toFixed(2)}%`);
  console.log(`📊 Final Thai AQHI: ${finalAQHI}`);

  return finalAQHI;
}

export { aqiToThaiAQHIUnits };