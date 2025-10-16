// US EPA AQI to Raw Concentration Converter
// Critical for AQHI calculations which require μg/m³ values, not AQI values

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

  // Ozone (1-hour average, ppm) - Only for AQI > 100
  o3_1hr: [
    [101, 150, 0.125, 0.164],    // Unhealthy for Sensitive
    [151, 200, 0.165, 0.204],    // Unhealthy
    [201, 300, 0.205, 0.404],    // Very Unhealthy
    [301, 500, 0.405, 0.604]     // Hazardous
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
  // O3: ppm to μg/m³ (molecular weight 48)
  o3_ppm_to_ugm3: 1962,

  // NO2: ppb to μg/m³ (molecular weight 46)
  no2_ppb_to_ugm3: 1.88,

  // SO2: ppb to μg/m³ (molecular weight 64)
  so2_ppb_to_ugm3: 2.62,

  // CO: ppm to mg/m³ (molecular weight 28)
  co_ppm_to_mgm3: 1.15
};

/**
 * Convert AQI value back to raw concentration using EPA linear interpolation formula
 * Formula: CP = ((IP - ILo) / (IHi - ILo)) * (CHi - CLo) + CLo
 *
 * @param {number} aqi - AQI value to convert
 * @param {string} pollutant - Pollutant type (pm25, pm10, o3, no2, so2, co)
 * @param {string} avgPeriod - Averaging period (8hr, 1hr) - only for O3
 * @returns {number|null} - Raw concentration in μg/m³ (or mg/m³ for CO) or null if invalid
 */
function aqiToConcentration(aqi, pollutant, avgPeriod = '8hr') {
  // Validate inputs
  if (typeof aqi !== 'number' || aqi < 0) {
    console.warn(`Invalid AQI value: ${aqi}`);
    return null;
  }

  // Handle ozone special case with averaging period
  let pollutantKey = pollutant.toLowerCase();
  if (pollutantKey === 'o3') {
    pollutantKey = avgPeriod === '1hr' ? 'o3_1hr' : 'o3_8hr';
  }

  const breakpoints = EPA_AQI_BREAKPOINTS[pollutantKey];
  if (!breakpoints) {
    console.warn(`Unknown pollutant: ${pollutant}`);
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
    console.warn(`AQI value ${aqi} out of range for ${pollutant}`);
    return null;
  }

  const [aqiLo, aqiHi, concLo, concHi] = selectedBreakpoint;

  // EPA linear interpolation formula (reverse)
  // CP = ((IP - ILo) / (IHi - ILo)) * (CHi - CLo) + CLo
  const concentration = ((aqi - aqiLo) / (aqiHi - aqiLo)) * (concHi - concLo) + concLo;

  // Convert units if needed
  let finalConcentration = concentration;

  if (pollutantKey === 'o3_8hr' || pollutantKey === 'o3_1hr') {
    // Convert ppm to μg/m³
    finalConcentration = concentration * CONVERSION_FACTORS.o3_ppm_to_ugm3;
  } else if (pollutantKey === 'no2') {
    // Convert ppb to μg/m³
    finalConcentration = concentration * CONVERSION_FACTORS.no2_ppb_to_ugm3;
  } else if (pollutantKey === 'so2') {
    // Convert ppb to μg/m³
    finalConcentration = concentration * CONVERSION_FACTORS.so2_ppb_to_ugm3;
  } else if (pollutantKey === 'co') {
    // Convert ppm to mg/m³
    finalConcentration = concentration * CONVERSION_FACTORS.co_ppm_to_mgm3;
  }
  // pm25 and pm10 are already in μg/m³

  return Math.round(finalConcentration * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert WAQI station data from AQI values to raw concentrations
 * This is crucial for AQHI calculations which require μg/m³ values
 *
 * @param {Object} station - WAQI station data with iaqi pollutant values
 * @returns {Object} - Station data with converted raw concentrations
 */
export function convertStationToRawConcentrations(station) {
  if (!station?.iaqi) {
    console.warn('Station missing iaqi data:', station?.uid || 'unknown');
    return station;
  }

  const rawConcentrations = {};
  const conversionLog = [];
  const skippedParams = [];

  // WAQI weather/non-pollutant parameters to skip
  const WEATHER_PARAMETERS = ['h', 't', 'p', 'w', 'wd', 'r', 'dew'];

  // Convert each available pollutant (skip weather parameters)
  Object.keys(station.iaqi).forEach(pollutant => {
    const aqiValue = station.iaqi[pollutant]?.v;

    if (typeof aqiValue === 'number') {
      // Skip weather parameters
      if (WEATHER_PARAMETERS.includes(pollutant)) {
        skippedParams.push(`${pollutant}=${aqiValue} (weather)`);
        return;
      }

      const rawConc = aqiToConcentration(aqiValue, pollutant);
      if (rawConc !== null) {
        rawConcentrations[pollutant] = {
          aqi: aqiValue,
          concentration: rawConc,
          unit: pollutant === 'co' ? 'mg/m³' : 'μg/m³'
        };
        conversionLog.push(`${pollutant.toUpperCase()}: ${aqiValue} AQI → ${rawConc} ${rawConcentrations[pollutant].unit}`);
      } else {
        skippedParams.push(`${pollutant}=${aqiValue} (unsupported)`);
      }
    }
  });

  const stationName = station.station?.name || station.uid || 'unknown';
  console.log(`🔄 AQI→Concentration conversion for station ${stationName}:`);
  if (conversionLog.length > 0) {
    console.log(`   Converted: ${conversionLog.join(', ')}`);
  }
  if (skippedParams.length > 0) {
    console.log(`   Skipped: ${skippedParams.join(', ')}`);
  }

  return {
    ...station,
    rawConcentrations,
    _conversionApplied: true,
    _conversionTimestamp: Date.now()
  };
}

/**
 * Get raw concentration value for AQHI calculation
 * Returns concentration in μg/m³ for the specified pollutant
 *
 * @param {Object} stationData - Converted station data
 * @param {string} pollutant - Pollutant name (pm25, no2, o3, so2)
 * @returns {number|null} - Concentration in μg/m³ or null if unavailable
 */
export function getRawConcentration(stationData, pollutant) {
  if (!stationData?.rawConcentrations?.[pollutant]) {
    return null;
  }

  return stationData.rawConcentrations[pollutant].concentration;
}

/**
 * Get concentration in units required for Thai AQHI formula
 * - PM2.5: μg/m³
 * - O3: ppb (NOT μg/m³)
 * - NO2: ppb (NOT μg/m³)
 *
 * @param {Object} stationData - Converted station data
 * @param {string} pollutant - Pollutant name (pm25, no2, o3)
 * @returns {number|null} - Concentration in AQHI-required units or null if unavailable
 */
export function getConcentrationForAQHI(stationData, pollutant) {
  if (!stationData?.rawConcentrations?.[pollutant]) {
    return null;
  }

  const concInUgM3 = stationData.rawConcentrations[pollutant].concentration;

  // PM2.5 is already in μg/m³ (correct for AQHI)
  if (pollutant === 'pm25' || pollutant === 'pm10') {
    return concInUgM3;
  }

  // O3 and NO2 need to be converted from μg/m³ back to ppb for Thai AQHI formula
  if (pollutant === 'o3') {
    // Convert μg/m³ back to ppb (reverse of ppm → μg/m³ conversion)
    // We stored as μg/m³, need to convert back to ppb
    // O3 μg/m³ → ppm → ppb
    const ppm = concInUgM3 / CONVERSION_FACTORS.o3_ppm_to_ugm3;
    const ppb = ppm * 1000; // ppm to ppb
    return ppb;
  }

  if (pollutant === 'no2') {
    // Convert μg/m³ back to ppb (reverse of ppb → μg/m³ conversion)
    const ppb = concInUgM3 / CONVERSION_FACTORS.no2_ppb_to_ugm3;
    return ppb;
  }

  if (pollutant === 'so2') {
    // Convert μg/m³ back to ppb (reverse of ppb → μg/m³ conversion)
    const ppb = concInUgM3 / CONVERSION_FACTORS.so2_ppb_to_ugm3;
    return ppb;
  }

  // Default: return as is
  return concInUgM3;
}

/**
 * Validate conversion accuracy with known test cases
 * @returns {boolean} - True if all tests pass
 */
export function validateConversions() {
  const testCases = [
    // [pollutant, aqi, expected_concentration, tolerance]
    ['pm25', 50, 9.0, 0.1],      // Good/Moderate boundary
    ['pm25', 100, 35.4, 0.1],    // Moderate/USG boundary
    ['pm25', 150, 55.4, 0.1],    // USG/Unhealthy boundary
    ['o3', 50, 105.95, 5],       // O3 8-hour (0.054 ppm * 1962)
    ['no2', 100, 188, 5],        // NO2 (100 ppb * 1.88)
    ['so2', 50, 91.7, 5]         // SO2 (35 ppb * 2.62)
  ];

  console.log('🧪 Running AQI conversion validation tests...');
  let allPassed = true;

  testCases.forEach(([pollutant, aqi, expected, tolerance]) => {
    const result = aqiToConcentration(aqi, pollutant);
    const diff = Math.abs(result - expected);
    const passed = diff <= tolerance;

    console.log(`${passed ? '✅' : '❌'} ${pollutant.toUpperCase()} AQI ${aqi} → ${result} μg/m³ (expected: ${expected}, diff: ${diff.toFixed(2)})`);

    if (!passed) allPassed = false;
  });

  console.log(`🧪 Validation ${allPassed ? 'PASSED' : 'FAILED'} - Conversion accuracy verified`);
  return allPassed;
}

// Export main conversion function and breakpoints
export {
  aqiToConcentration,
  EPA_AQI_BREAKPOINTS,
  CONVERSION_FACTORS
};

// Make available globally for testing
if (typeof window !== 'undefined') {
  window.aqiConverter = {
    aqiToConcentration,
    convertStationToRawConcentrations,
    getRawConcentration,
    getConcentrationForAQHI,
    validateConversions,
    EPA_AQI_BREAKPOINTS,
    CONVERSION_FACTORS
  };

  console.log('🔧 AQI Converter loaded globally as window.aqiConverter');
}