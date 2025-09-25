// Fresh Supabase test - Test connectivity and data conversion
import { convertStationDataForSupabase } from './lib/aqi-converter-node.js';
import { AirQualityDB } from './lib/supabase.js';

// Test sample station data
const sampleStationData = {
  uid: 'test-123',
  aqi: 75,
  lat: 13.7563,
  lon: 100.5018,
  station: { name: 'Test Station' },
  iaqi: {
    pm25: { v: 75 },
    pm10: { v: 85 },
    o3: { v: 65 },
    no2: { v: 45 },
    so2: { v: 25 },
    co: { v: 115 },
    // Weather data (should be ignored)
    t: { v: 28 },
    h: { v: 65 }
  }
};

console.log('🧪 Testing fresh Supabase setup...');

// Test 1: AQI to concentration conversion
console.log('\n1. Testing AQI to concentration conversion:');
const converted = convertStationDataForSupabase(sampleStationData);
console.log('Converted concentrations:', converted);

// Test 2: Database connection
console.log('\n2. Testing database connection:');
try {
  const connectionResult = await AirQualityDB.testConnection();
  console.log('Connection result:', connectionResult);

  if (connectionResult) {
    console.log('\n3. Testing database stats:');
    const stats = await AirQualityDB.getDBStats();
    console.log('Database stats:', stats);

    console.log('\n4. Testing station insertion (dry run):');
    const testStation = {
      station_uid: 'test-fresh-123',
      name: 'Fresh Test Station',
      latitude: 13.7563,
      longitude: 100.5018,
      city: 'Bangkok',
      country: 'Thailand',
      is_active: true
    };

    console.log('Would insert station:', testStation);

    const testReading = {
      station_uid: 'test-fresh-123',
      timestamp: new Date().toISOString(),
      aqi: sampleStationData.aqi,
      ...converted,
      raw_data: JSON.stringify(sampleStationData)
    };

    console.log('Would insert reading:', testReading);

    console.log('\n✅ Fresh Supabase setup appears to be working!');
  } else {
    console.log('❌ Database connection failed');
  }
} catch (error) {
  console.error('❌ Test failed:', error.message);
}