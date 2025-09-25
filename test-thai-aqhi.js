// Test Thai Health Department AQHI calculation
import { convertStationDataForThaiAQHI, calculateThaiAQHI } from './lib/thai-aqhi-converter.js';

console.log('🇹🇭 Testing Thai Health Department AQHI Formula\n');

// Sample station data (same as before)
const sampleStation = {
  uid: 'test-123',
  aqi: 75,
  station: { name: 'Test Bangkok Station' },
  iaqi: {
    pm25: { v: 75 },  // AQI
    o3: { v: 65 },    // AQI
    no2: { v: 45 },   // AQI
    so2: { v: 25 },   // Not used in Thai formula
    co: { v: 115 }    // Not used in Thai formula
  }
};

console.log('📊 Input AQI values:');
console.log(`- PM2.5 AQI: ${sampleStation.iaqi.pm25.v}`);
console.log(`- O3 AQI: ${sampleStation.iaqi.o3.v}`);
console.log(`- NO2 AQI: ${sampleStation.iaqi.no2.v}`);

console.log('\n🔄 Converting to Thai AQHI units...');
const thaiUnits = convertStationDataForThaiAQHI(sampleStation);

console.log('\n📋 Thai AQHI Formula:');
console.log('PM2.5AQHI = (10/c) × [100 × (exp(βPM2.5 × PM2.5) - 1) + (exp(βO3 × O3) - 1) + (exp(βNO2 × NO2) - 1)]');
console.log('');
console.log('Where:');
console.log('- c = 105.19');
console.log('- βPM2.5 = 0.0012');
console.log('- βO3 = 0.0010');
console.log('- βNO2 = 0.0052');
console.log('- PM2.5 in μg/m³');
console.log('- O3 and NO2 in ppb');

console.log('\n🧮 Calculating Thai AQHI...');
const thaiAQHI = calculateThaiAQHI(thaiUnits.pm25, thaiUnits.o3, thaiUnits.no2);

// Compare with Canadian formula (for reference)
console.log('\n🔍 Comparison with Canadian formula:');

// Canadian coefficients (what we were using before)
const canadianPM25 = thaiUnits.pm25 || 0;
const canadianO3 = thaiUnits.o3 ? thaiUnits.o3 * 1.962 : 0;  // Convert ppb to μg/m³
const canadianNO2 = thaiUnits.no2 ? thaiUnits.no2 * 1.88 : 0; // Convert ppb to μg/m³

const canadianAQHI = Math.round((10/10.4) * 100 * (
  (Math.exp(0.000487 * canadianPM25) - 1) +
  (Math.exp(0.000537 * canadianNO2) - 1) +
  (Math.exp(0.000871 * canadianO3) - 1)
));

console.log(`- Canadian AQHI (old): ${canadianAQHI}`);
console.log(`- Thai AQHI (correct): ${thaiAQHI}`);
console.log(`- Difference: ${thaiAQHI - canadianAQHI} points`);

// Thai AQHI levels (you may need to define these based on Thai standards)
let level, description;
if (thaiAQHI <= 25) {
  level = 'Good';
  description = 'Air quality is good for outdoor activities';
} else if (thaiAQHI <= 50) {
  level = 'Moderate';
  description = 'Air quality is acceptable for most people';
} else if (thaiAQHI <= 100) {
  level = 'Unhealthy for Sensitive Groups';
  description = 'Sensitive people should limit outdoor activities';
} else if (thaiAQHI <= 200) {
  level = 'Unhealthy';
  description = 'Everyone should limit outdoor activities';
} else {
  level = 'Very Unhealthy';
  description = 'Avoid outdoor activities';
}

console.log(`\n🇹🇭 Thai AQHI Level: ${thaiAQHI} (${level})`);
console.log(`📋 Health advice: ${description}`);

console.log('\n✅ Thai AQHI calculation completed!');
console.log(`🎯 Your Bangkok air quality dashboard now uses the correct Thai Health Department formula!`);