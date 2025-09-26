// Test the corrected AQHI formula directly (Node.js compatible)

console.log('🧪 Testing Corrected AQHI Formula\n');

// Corrected AQHI parameters
const AQHI_PARAMS = {
  C: 105.19,  // Scaling factor for hospital admissions
  beta: {
    pm25: 0.0022,  // PM2.5 coefficient (corrected)
    o3: 0.0010,    // O3 coefficient (corrected)
    no2: 0.0030,   // NO2 coefficient (corrected)
  },
};

function calculateCorrectedAQHI(pm25, no2, o3) {
  console.log(`🧮 Calculating AQHI with concentrations: PM2.5=${pm25}μg/m³, NO2=${no2}μg/m³, O3=${o3}μg/m³`);

  // Calculate individual excess risk terms
  const riskPM25 = pm25 ? Math.exp(AQHI_PARAMS.beta.pm25 * pm25) - 1 : 0;
  const riskO3 = o3 ? Math.exp(AQHI_PARAMS.beta.o3 * o3) - 1 : 0;
  const riskNO2 = no2 ? Math.exp(AQHI_PARAMS.beta.no2 * no2) - 1 : 0;

  // Sum the risks first
  const totalRiskSum = riskPM25 + riskO3 + riskNO2;

  // Apply scaling: The * 100 is applied to the SUM of the risks
  const aqhi = (10 / AQHI_PARAMS.C) * 100 * totalRiskSum;

  console.log(`📊 AQHI risks: PM2.5=${riskPM25.toFixed(4)}, NO2=${riskNO2.toFixed(4)}, O3=${riskO3.toFixed(4)}, Total=${totalRiskSum.toFixed(4)} → AQHI=${Math.round(aqhi)}`);

  return Math.max(0, Math.round(aqhi));
}

// Test with realistic Bangkok concentrations
const testCases = [
  { pm25: 12, no2: 25, o3: 60, scenario: 'Good day' },
  { pm25: 25, no2: 40, o3: 80, scenario: 'Typical weekday' },
  { pm25: 35, no2: 60, o3: 100, scenario: 'Heavy traffic' },
  { pm25: 50, no2: 80, o3: 120, scenario: 'Pollution episode' },
];

console.log('📋 Corrected Formula Parameters:');
console.log('- c = 105.19 (scaling factor for hospital admissions)');
console.log('- β_PM2.5 = 0.0022');
console.log('- β_O3 = 0.0010');
console.log('- β_NO2 = 0.0030');
console.log('');

console.log('🧮 Corrected Formula Structure:');
console.log('AQHI = (10/c) × 100 × [risk_PM2.5 + risk_O3 + risk_NO2]');
console.log('Where:');
console.log('- risk_PM2.5 = exp(β_PM2.5 × PM2.5) - 1');
console.log('- risk_O3 = exp(β_O3 × O3) - 1');
console.log('- risk_NO2 = exp(β_NO2 × NO2) - 1');
console.log('');

testCases.forEach(test => {
  console.log(`📊 Testing ${test.scenario}:`);
  console.log(`   Input: PM2.5=${test.pm25}μg/m³, NO2=${test.no2}μg/m³, O3=${test.o3}μg/m³`);

  const aqhi = calculateCorrectedAQHI(test.pm25, test.no2, test.o3);
  console.log(`   AQHI Result: ${aqhi}`);

  let riskLevel;
  if (aqhi <= 3) riskLevel = 'Low Risk';
  else if (aqhi <= 6) riskLevel = 'Moderate Risk';
  else if (aqhi <= 10) riskLevel = 'High Risk';
  else riskLevel = 'Very High Risk';

  console.log(`   Risk Level: ${riskLevel}`);
  console.log('');
});

console.log('✅ Corrected AQHI formula testing completed!');
console.log('🎯 The formula should now return proper AQHI values instead of 0');