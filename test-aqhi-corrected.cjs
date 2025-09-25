// Test the corrected AQHI calculation

console.log('🧪 Testing Corrected AQHI Calculation\n');

// Sample concentrations from our conversion test
const concentrations = {
  pm25: 21.98,  // μg/m³
  no2: 89.68,   // μg/m³
  o3: 116.32    // μg/m³
};

console.log('Input concentrations:');
console.log(`- PM2.5: ${concentrations.pm25} μg/m³`);
console.log(`- NO2: ${concentrations.no2} μg/m³`);
console.log(`- O3: ${concentrations.o3} μg/m³`);

// Health Canada AQHI formula with CORRECTED coefficients
console.log('\n🔬 Applying Health Canada AQHI Formula:');
console.log('AQHI = (10/10.4) × 100 × [');
console.log('  (exp(0.000487 × PM2.5) - 1) +');
console.log('  (exp(0.000537 × NO2) - 1) +');
console.log('  (exp(0.000871 × O3) - 1)');
console.log(']');

// Calculate each component
const pm25Component = Math.exp(0.000487 * concentrations.pm25) - 1;
const no2Component = Math.exp(0.000537 * concentrations.no2) - 1;
const o3Component = Math.exp(0.000871 * concentrations.o3) - 1;

console.log('\n📊 Component calculations:');
console.log(`- PM2.5 component: exp(0.000487 × ${concentrations.pm25}) - 1 = ${pm25Component.toFixed(6)}`);
console.log(`- NO2 component: exp(0.000537 × ${concentrations.no2}) - 1 = ${no2Component.toFixed(6)}`);
console.log(`- O3 component: exp(0.000871 × ${concentrations.o3}) - 1 = ${o3Component.toFixed(6)}`);

// Sum components
const sumComponents = pm25Component + no2Component + o3Component;
console.log(`\n📈 Sum of components: ${sumComponents.toFixed(6)}`);

// Apply scaling factor
const aqhi = (10.0 / 10.4) * 100 * sumComponents;
const finalAQHI = Math.max(0, Math.round(aqhi));

console.log(`\n🎯 Final AQHI calculation:`);
console.log(`- Raw AQHI: (10/10.4) × 100 × ${sumComponents.toFixed(6)} = ${aqhi.toFixed(2)}`);
console.log(`- Rounded AQHI: ${finalAQHI}`);

// AQHI level interpretation
let level, color, description;
if (finalAQHI <= 3) {
  level = 'Low Risk';
  color = '🟢';
  description = 'Ideal air quality for outdoor activities';
} else if (finalAQHI <= 6) {
  level = 'Moderate Risk';
  color = '🟡';
  description = 'Acceptable for most people';
} else if (finalAQHI <= 10) {
  level = 'High Risk';
  color = '🟠';
  description = 'Consider reducing outdoor activities';
} else {
  level = 'Very High Risk';
  color = '🔴';
  description = 'Avoid outdoor activities';
}

console.log(`\n${color} AQHI Level: ${finalAQHI} (${level})`);
console.log(`📋 Health advice: ${description}`);

console.log('\n✅ AQHI calculation with corrected coefficients completed!');

// Compare with old (incorrect) calculation
console.log('\n🔍 Comparison with old incorrect coefficients:');
const oldNO2Component = Math.exp(0.000871 * concentrations.no2) - 1;  // Wrong coefficient
const oldO3Component = Math.exp(0.000537 * concentrations.o3) - 1;    // Wrong coefficient
const oldSum = pm25Component + oldNO2Component + oldO3Component;
const oldAQHI = Math.round((10.0 / 10.4) * 100 * oldSum);

console.log(`- Old (incorrect) AQHI: ${oldAQHI}`);
console.log(`- New (correct) AQHI: ${finalAQHI}`);
console.log(`- Difference: ${finalAQHI - oldAQHI} points`);

if (finalAQHI !== oldAQHI) {
  console.log('🎯 AQHI values are now more accurate with corrected coefficients!');
} else {
  console.log('ℹ️ Same result, but formula is now mathematically correct.');
}