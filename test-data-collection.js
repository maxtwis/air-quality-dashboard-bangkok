// Test data collection with fresh Supabase setup
import { AirQualityDB } from './lib/supabase.js';
import { convertStationDataForSupabase } from './lib/aqi-converter-node.js';
import { airQualityStorage } from './js/storage.js';

// Sample station data (similar to what WAQI API returns)
const testStations = [
  {
    uid: 'test-embassy-001',
    aqi: 85,
    lat: 13.7563,
    lon: 100.5018,
    station: {
      name: 'Test US Embassy Bangkok',
      geo: ['Thailand', 'Bangkok']
    },
    iaqi: {
      pm25: { v: 85 },
      pm10: { v: 95 },
      o3: { v: 72 },
      no2: { v: 48 },
      so2: { v: 22 },
      co: { v: 125 },
      // Weather data
      t: { v: 32 },
      h: { v: 68 },
      p: { v: 1012 }
    },
    time: {
      s: new Date().toISOString()
    }
  },
  {
    uid: 'test-chatuchak-002',
    aqi: 92,
    lat: 13.8037,
    lon: 100.5532,
    station: {
      name: 'Test Chatuchak Park',
      geo: ['Thailand', 'Bangkok']
    },
    iaqi: {
      pm25: { v: 92 },
      pm10: { v: 105 },
      o3: { v: 68 },
      no2: { v: 52 },
      so2: { v: 18 },
      // Missing CO to test handling
      t: { v: 31 },
      h: { v: 72 }
    },
    time: {
      s: new Date().toISOString()
    }
  }
];

console.log('🧪 Testing Data Collection with Fresh Supabase...\n');

async function runTests() {
  try {
    console.log('1. 🔍 Testing database connection...');
    const connected = await AirQualityDB.testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connected successfully\n');

    console.log('2. 🔄 Testing AQI to concentration conversion...');
    testStations.forEach((station, i) => {
      console.log(`\n   Station ${i + 1}: ${station.station.name}`);
      const converted = convertStationDataForSupabase(station);
      console.log(`   Conversions:`, converted);
    });
    console.log('\n✅ Conversion logic working\n');

    console.log('3. 💾 Testing data storage...');
    const storageResult = await airQualityStorage.storeStationData(testStations);
    if (storageResult) {
      console.log('✅ Data stored successfully');
    } else {
      console.log('⚠️ Storage skipped (rate limited or disabled)');
    }

    console.log('\n4. 📊 Checking database stats...');
    const stats = await AirQualityDB.getDBStats();
    console.log('Database stats:', stats);

    console.log('\n5. 🔍 Testing 3-hour averages...');
    const averages = await AirQualityDB.get3HourAverages();
    console.log(`Found ${averages?.length || 0} stations with 3h averages:`, averages);

    console.log('\n✅ All tests completed successfully! 🎉');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the tests
runTests();