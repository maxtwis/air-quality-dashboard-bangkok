#!/usr/bin/env node

// Test script for AQI to concentration conversion accuracy
// Run with: node test-aqi-conversion.js

import {
  aqiToConcentration,
  convertStationToRawConcentrations,
  getRawConcentration,
  validateConversions,
  EPA_AQI_BREAKPOINTS,
  CONVERSION_FACTORS
} from './js/aqi-to-concentration.js';

console.log('🧪 Testing AQI to Raw Concentration Conversion');
console.log('='.repeat(50));

// Test 1: Basic conversion validation
console.log('\n1️⃣ Running built-in validation tests...');
const validationPassed = validateConversions();

// Test 2: Specific test cases with expected values
console.log('\n2️⃣ Testing specific AQI boundary conversions...');

const testCases = [
  // PM2.5 Tests (2024 updated breakpoints)
  { pollutant: 'pm25', aqi: 0, expected: 0, desc: 'PM2.5 minimum' },
  { pollutant: 'pm25', aqi: 50, expected: 9.0, desc: 'PM2.5 Good/Moderate boundary' },
  { pollutant: 'pm25', aqi: 100, expected: 35.4, desc: 'PM2.5 Moderate/USG boundary' },
  { pollutant: 'pm25', aqi: 150, expected: 55.4, desc: 'PM2.5 USG/Unhealthy boundary' },
  { pollutant: 'pm25', aqi: 200, expected: 125.4, desc: 'PM2.5 Unhealthy/Very Unhealthy boundary' },

  // PM10 Tests
  { pollutant: 'pm10', aqi: 50, expected: 54, desc: 'PM10 Good/Moderate boundary' },
  { pollutant: 'pm10', aqi: 100, expected: 154, desc: 'PM10 Moderate/USG boundary' },

  // O3 Tests (8-hour, converted to μg/m³)
  { pollutant: 'o3', aqi: 50, expected: 105.95, tolerance: 5, desc: 'O3 8hr Good/Moderate (0.054ppm → μg/m³)' },
  { pollutant: 'o3', aqi: 100, expected: 137.34, tolerance: 5, desc: 'O3 8hr Moderate/USG (0.07ppm → μg/m³)' },

  // NO2 Tests (converted to μg/m³)
  { pollutant: 'no2', aqi: 50, expected: 99.64, tolerance: 5, desc: 'NO2 Good/Moderate (53ppb → μg/m³)' },
  { pollutant: 'no2', aqi: 100, expected: 188, tolerance: 5, desc: 'NO2 Moderate/USG (100ppb → μg/m³)' },

  // SO2 Tests (converted to μg/m³)
  { pollutant: 'so2', aqi: 50, expected: 91.7, tolerance: 5, desc: 'SO2 Good/Moderate (35ppb → μg/m³)' },
  { pollutant: 'so2', aqi: 100, expected: 196.5, tolerance: 5, desc: 'SO2 Moderate/USG (75ppb → μg/m³)' }
];

let testsPassed = 0;
let totalTests = testCases.length;

testCases.forEach((test, index) => {
  const { pollutant, aqi, expected, tolerance = 0.1, desc } = test;
  const result = aqiToConcentration(aqi, pollutant);
  const diff = Math.abs(result - expected);
  const passed = diff <= tolerance;

  console.log(`${passed ? '✅' : '❌'} Test ${index + 1}: ${desc}`);
  console.log(`   Input: ${aqi} AQI → Output: ${result} μg/m³ (Expected: ${expected}, Diff: ${diff.toFixed(2)})`);

  if (passed) testsPassed++;
});

console.log(`\n📊 Individual Tests: ${testsPassed}/${totalTests} passed`);

// Test 3: Real station data simulation
console.log('\n3️⃣ Testing real station data conversion...');

const mockStation = {
  uid: 'test-station',
  station: { name: 'Bangkok Test Station' },
  iaqi: {
    pm25: { v: 85 },    // AQI 85 (Moderate)
    pm10: { v: 120 },   // AQI 120 (Unhealthy for Sensitive)
    o3: { v: 65 },      // AQI 65 (Moderate)
    no2: { v: 45 },     // AQI 45 (Good)
    so2: { v: 30 }      // AQI 30 (Good)
  }
};

console.log('🏭 Mock Station Data (AQI values):');
Object.entries(mockStation.iaqi).forEach(([pollutant, data]) => {
  console.log(`   ${pollutant.toUpperCase()}: ${data.v} AQI`);
});

const convertedStation = convertStationToRawConcentrations(mockStation);

console.log('\n🔬 Converted to Raw Concentrations:');
Object.entries(convertedStation.rawConcentrations).forEach(([pollutant, data]) => {
  console.log(`   ${pollutant.toUpperCase()}: ${data.concentration} ${data.unit} (was ${data.aqi} AQI)`);
});

// Test 4: AQHI calculation impact
console.log('\n4️⃣ Testing AQHI calculation impact...');

// Before conversion (using AQI values - WRONG!)
const wrongAQHI = calculateTestAQHI(
  mockStation.iaqi.pm25.v,
  mockStation.iaqi.no2.v,
  mockStation.iaqi.o3.v
);

// After conversion (using raw concentrations - CORRECT!)
const correctAQHI = calculateTestAQHI(
  getRawConcentration(convertedStation, 'pm25'),
  getRawConcentration(convertedStation, 'no2'),
  getRawConcentration(convertedStation, 'o3')
);

console.log(`❌ WRONG AQHI (using AQI values): ${wrongAQHI}`);
console.log(`✅ CORRECT AQHI (using raw concentrations): ${correctAQHI}`);
console.log(`📊 Difference: ${Math.abs(correctAQHI - wrongAQHI)} AQHI points`);

console.log('\n🎯 Summary:');
console.log(`Built-in validation: ${validationPassed ? 'PASSED' : 'FAILED'}`);
console.log(`Boundary tests: ${testsPassed}/${totalTests} passed`);
console.log(`AQHI impact: ${Math.abs(correctAQHI - wrongAQHI)} point difference when using correct concentrations`);

if (validationPassed && testsPassed === totalTests) {
  console.log('\n🎉 ALL TESTS PASSED - AQI conversion is working correctly!');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED - Check conversion implementation');
  process.exit(1);
}

// Helper function to simulate AQHI calculation
function calculateTestAQHI(pm25, no2, o3) {
  const AQHI_PARAMS = {
    C: 105.19,
    beta: { pm25: 0.0012, o3: 0.001, no2: 0.0052 }
  };

  const pm25Component = 100 * (Math.exp(AQHI_PARAMS.beta.pm25 * (pm25 || 0)) - 1);
  const o3Component = Math.exp(AQHI_PARAMS.beta.o3 * (o3 || 0)) - 1;
  const no2Component = Math.exp(AQHI_PARAMS.beta.no2 * (no2 || 0)) - 1;

  const aqhi = (10 / AQHI_PARAMS.C) * (pm25Component + o3Component + no2Component);
  return Math.round(aqhi);
}