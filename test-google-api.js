// Test Google Air Quality API Integration
// Run with: node test-google-api.js

async function testGoogleAirQualityAPI() {
  const apiKey = process.env.GOOGLE_AIR_QUALITY_API_KEY || 'AIzaSyAQ5i2eXrmaliNTbImVPP43JvHM9oPa-zk';

  if (!apiKey) {
    console.error('❌ GOOGLE_AIR_QUALITY_API_KEY not set');
    process.exit(1);
  }

  console.log('🌐 Testing Google Air Quality API Integration\n');
  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}\n`);

  // Test location: Bangkok city center
  const testLocation = {
    latitude: 13.7563,
    longitude: 100.5018,
    name: 'Bangkok City Center'
  };

  console.log(`📍 Test Location: ${testLocation.name}`);
  console.log(`   Coordinates: ${testLocation.latitude}, ${testLocation.longitude}\n`);

  try {
    const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;

    console.log('⏳ Fetching air quality data...\n');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: {
          latitude: testLocation.latitude,
          longitude: testLocation.longitude
        },
        extraComputations: [
          "HEALTH_RECOMMENDATIONS",
          "DOMINANT_POLLUTANT_CONCENTRATION",
          "POLLUTANT_CONCENTRATION",
          "LOCAL_AQI",
          "POLLUTANT_ADDITIONAL_INFO"
        ],
        languageCode: "en"
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Error details:', JSON.stringify(errorData, null, 2));
      process.exit(1);
    }

    const data = await response.json();

    console.log('✅ Successfully fetched air quality data!\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Display AQI
    if (data.indexes && data.indexes.length > 0) {
      console.log('📊 AIR QUALITY INDEXES:\n');
      data.indexes.forEach(index => {
        console.log(`   ${index.displayName} (${index.code})`);
        console.log(`   AQI: ${index.aqi} - ${index.category}`);
        console.log(`   Color: RGB(${index.color.red}, ${index.color.green}, ${index.color.blue})`);
        console.log('');
      });
    }

    // Display pollutants
    if (data.pollutants && data.pollutants.length > 0) {
      console.log('🧪 POLLUTANT CONCENTRATIONS:\n');
      data.pollutants.forEach(pollutant => {
        console.log(`   ${pollutant.displayName} (${pollutant.code})`);
        console.log(`   Full Name: ${pollutant.fullName}`);
        console.log(`   Concentration: ${pollutant.concentration.value} ${pollutant.concentration.units}`);
        if (pollutant.additionalInfo) {
          console.log(`   Additional Info: ${pollutant.additionalInfo.sources || 'N/A'}`);
        }
        console.log('');
      });
    }

    // Display dominant pollutant
    if (data.dominantPollutant) {
      console.log(`🎯 DOMINANT POLLUTANT: ${data.dominantPollutant}\n`);
    }

    // Display health recommendations
    if (data.healthRecommendations) {
      console.log('💊 HEALTH RECOMMENDATIONS:\n');
      console.log(`   General: ${data.healthRecommendations.generalPopulation || 'N/A'}`);
      console.log(`   Elderly: ${data.healthRecommendations.elderly || 'N/A'}`);
      console.log(`   Lung Disease: ${data.healthRecommendations.lungDiseasePopulation || 'N/A'}`);
      console.log(`   Heart Disease: ${data.healthRecommendations.heartDiseasePopulation || 'N/A'}`);
      console.log(`   Athletes: ${data.healthRecommendations.athletes || 'N/A'}`);
      console.log(`   Pregnant Women: ${data.healthRecommendations.pregnantWomen || 'N/A'}`);
      console.log(`   Children: ${data.healthRecommendations.children || 'N/A'}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✨ Test completed successfully!\n');
    console.log('📝 Raw API Response saved to test-google-api-response.json');

    // Save raw response using ES modules
    const fs = await import('fs');
    fs.writeFileSync('test-google-api-response.json', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run the test
testGoogleAirQualityAPI();
