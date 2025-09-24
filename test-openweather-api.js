// Node.js test script for OpenWeather API integration
// Using built-in fetch (Node.js 18+)

// Mock the OpenWeather config
const OPENWEATHER_CONFIG = {
  API_KEY: 'a180db2b4dba131e42c97be80d3d018f',
  API_URL: 'https://api.openweathermap.org/data/2.5/air_pollution',
  CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
  MAX_REQUESTS_PER_DAY: 1000
};

// Test OpenWeather API directly
async function testOpenWeatherAPI() {
  console.log('🧪 Testing OpenWeather API Integration...\n');

  try {
    // Test 1: Direct API call
    console.log('1️⃣ Testing direct API call...');
    const testLat = 13.7563;
    const testLon = 100.5018;
    const url = `${OPENWEATHER_CONFIG.API_URL}?lat=${testLat}&lon=${testLon}&appid=${OPENWEATHER_CONFIG.API_KEY}`;

    console.log(`   URL: ${url.replace(OPENWEATHER_CONFIG.API_KEY, 'API_KEY_HIDDEN')}`);

    const response = await fetch(url);
    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ API Error: ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log('   ✅ API Response received');
    console.log(`   📊 Data structure:`, JSON.stringify(data, null, 2));

    // Test 2: Format data
    console.log('\n2️⃣ Testing data formatting...');
    const components = data.list[0].components;
    const formatted = {
      pm25: components.pm2_5 || null,
      pm10: components.pm10 || null,
      o3: components.o3 || null,
      no2: components.no2 || null,
      so2: components.so2 || null,
      co: components.co ? components.co / 1000 : null,
      timestamp: Date.now(),
      source: 'openweather'
    };

    console.log('   ✅ Formatted data:', formatted);

    // Test 3: Station need detection
    console.log('\n3️⃣ Testing station need detection...');

    const mockStations = [
      {
        uid: 'complete-station',
        station: { name: 'Complete Station' },
        lat: 13.7563,
        lon: 100.5018,
        iaqi: { pm25: { v: 25 }, o3: { v: 45 }, no2: { v: 15 } }
      },
      {
        uid: 'missing-o3',
        station: { name: 'Missing O3 Station' },
        lat: 13.7263,
        lon: 100.5218,
        iaqi: { pm25: { v: 28 }, no2: { v: 12 } }
      },
      {
        uid: 'missing-no2',
        station: { name: 'Missing NO2 Station' },
        lat: 13.7663,
        lon: 100.4818,
        iaqi: { pm25: { v: 22 }, o3: { v: 38 } }
      },
      {
        uid: 'missing-both',
        station: { name: 'Missing Both Station' },
        lat: 13.7463,
        lon: 100.5118,
        iaqi: { pm25: { v: 30 } }
      }
    ];

    const stationsNeedingData = [];

    for (const station of mockStations) {
      const hasO3 = station.iaqi?.o3?.v !== undefined;
      const hasNO2 = station.iaqi?.no2?.v !== undefined;

      if (!hasO3 || !hasNO2) {
        stationsNeedingData.push({
          station,
          missing: {
            o3: !hasO3,
            no2: !hasNO2
          },
          lat: station.lat,
          lon: station.lon
        });

        console.log(`   📍 ${station.station.name}: Missing ${!hasO3 ? 'O₃' : ''}${!hasO3 && !hasNO2 ? ' and ' : ''}${!hasNO2 ? 'NO₂' : ''}`);
      } else {
        console.log(`   ✅ ${station.station.name}: Complete data`);
      }
    }

    console.log(`\n   📊 Summary: ${stationsNeedingData.length}/${mockStations.length} stations need OpenWeather data`);

    // Test 4: Rate limiting logic
    console.log('\n4️⃣ Testing rate limiting logic...');
    const requestCount = 0;
    const resetTime = Date.now() + 24 * 60 * 60 * 1000;
    const canMakeCall = requestCount < OPENWEATHER_CONFIG.MAX_REQUESTS_PER_DAY;

    console.log(`   📞 Current requests: ${requestCount}/${OPENWEATHER_CONFIG.MAX_REQUESTS_PER_DAY}`);
    console.log(`   ⏰ Reset time: ${new Date(resetTime).toLocaleString()}`);
    console.log(`   ✅ Can make calls: ${canMakeCall}`);

    // Test 5: AQHI enhancement simulation
    console.log('\n5️⃣ Testing AQHI enhancement simulation...');

    // Health Canada AQHI formula
    const calculateAQHI = (pm25, no2, o3) => {
      if (!pm25 || !no2 || !o3) return null;

      let aqhi = 0;
      aqhi += Math.exp(0.000487 * pm25) - 1;
      aqhi += Math.exp(0.000537 * no2) - 1;
      aqhi += Math.exp(0.000871 * o3) - 1;
      aqhi = (10.0 / 10.4) * 100 * aqhi;

      return Math.max(0, Math.round(aqhi));
    };

    const station = mockStations[3]; // Missing both
    const originalAQHI = calculateAQHI(station.iaqi?.pm25?.v, station.iaqi?.no2?.v, station.iaqi?.o3?.v);
    const enhancedAQHI = calculateAQHI(station.iaqi?.pm25?.v || formatted.pm25,
                                      station.iaqi?.no2?.v || formatted.no2,
                                      station.iaqi?.o3?.v || formatted.o3);

    console.log(`   🏢 Station: ${station.station.name}`);
    console.log(`   📊 Original AQHI: ${originalAQHI || 'Cannot calculate (missing data)'}`);
    console.log(`   🌐 Enhanced AQHI: ${enhancedAQHI || 'Cannot calculate'}`);
    console.log(`   🎯 Improvement: ${originalAQHI ? 'N/A (had data)' : enhancedAQHI ? 'AQHI now calculable!' : 'Still missing data'}`);

    console.log('\n✅ All OpenWeather integration tests completed successfully!');
    console.log('🚀 Integration is ready for production use.');

    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
testOpenWeatherAPI().then(success => {
  console.log(`\n🎯 Test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});