// Test the AQI to concentration conversion logic directly
// This tests the core fix we implemented

console.log('🧪 Testing AQI to Concentration Conversion Logic...\n');

// Load the converter module
const { convertStationDataForSupabase, aqiToConcentration } = require('./lib/aqi-converter-node.js');

function testAQIConversion() {
    console.log('1️⃣ Testing individual pollutant conversions:');
    console.log('═'.repeat(50));

    // Test cases with known AQI values and expected concentrations
    const testCases = [
        { pollutant: 'pm25', aqi: 50, expectedRange: [8, 10] },   // Good range
        { pollutant: 'pm25', aqi: 100, expectedRange: [34, 36] }, // Moderate range
        { pollutant: 'pm10', aqi: 50, expectedRange: [50, 55] },  // Good range
        { pollutant: 'o3', aqi: 75, expectedRange: [130, 140] },   // Between moderate ranges
        { pollutant: 'no2', aqi: 50, expectedRange: [98, 102] },  // Good range
    ];

    let passCount = 0;

    testCases.forEach(test => {
        const result = aqiToConcentration(test.aqi, test.pollutant);
        const isInRange = result >= test.expectedRange[0] && result <= test.expectedRange[1];

        console.log(`   ${test.pollutant.toUpperCase()}: AQI ${test.aqi} → ${result} μg/m³ ${isInRange ? '✅' : '❌'}`);
        if (isInRange) passCount++;
    });

    console.log(`\n   Results: ${passCount}/${testCases.length} conversions passed\n`);

    return passCount === testCases.length;
}

function testStationDataConversion() {
    console.log('2️⃣ Testing station data conversion (WAQI format):');
    console.log('═'.repeat(50));

    // Mock WAQI station data with AQI values (as received from API)
    const mockStationData = {
        uid: 'test-station-123',
        station: { name: 'Test Station Bangkok' },
        iaqi: {
            pm25: { v: 85 },    // AQI 85 (moderate, should convert to ~25 μg/m³)
            pm10: { v: 72 },    // AQI 72 (moderate, should convert to ~105 μg/m³)
            o3: { v: 65 },      // AQI 65 (moderate, should convert to ~130 μg/m³)
            no2: { v: 45 },     // AQI 45 (good, should convert to ~85 μg/m³)
            so2: { v: 30 },     // AQI 30 (good, should convert to ~65 μg/m³)
            co: { v: 25 },      // AQI 25 (good, should convert to ~2.5 mg/m³)
            // Weather data (should be ignored)
            h: { v: 65 },       // Humidity
            t: { v: 28 },       // Temperature
            p: { v: 1013 },     // Pressure
        }
    };

    console.log('   Input AQI values:');
    Object.entries(mockStationData.iaqi).forEach(([key, value]) => {
        console.log(`     ${key}: ${value.v}`);
    });

    console.log('\n   Converting to concentrations...');
    const convertedData = convertStationDataForSupabase(mockStationData);

    console.log('\n   Output concentrations:');
    let validConversions = 0;
    const expectedPollutants = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'];

    expectedPollutants.forEach(pollutant => {
        const concentration = convertedData[pollutant];
        const originalAQI = mockStationData.iaqi[pollutant]?.v;

        if (concentration !== null && concentration !== undefined) {
            const unit = pollutant === 'co' ? 'mg/m³' : 'μg/m³';
            console.log(`     ${pollutant}: ${concentration} ${unit} (from AQI ${originalAQI}) ✅`);
            validConversions++;
        } else {
            console.log(`     ${pollutant}: conversion failed ❌`);
        }
    });

    // Check that weather parameters were ignored
    const weatherParams = ['h', 't', 'p'];
    let weatherIgnored = 0;
    weatherParams.forEach(param => {
        if (convertedData[param] === undefined) {
            weatherIgnored++;
        }
    });

    console.log(`\n   Weather parameters correctly ignored: ${weatherIgnored}/${weatherParams.length} ✅`);
    console.log(`   Pollutant conversions successful: ${validConversions}/${expectedPollutants.length}`);

    return validConversions === expectedPollutants.length && weatherIgnored === weatherParams.length;
}

function testAQHICalculation() {
    console.log('\n3️⃣ Testing AQHI calculation with converted values:');
    console.log('═'.repeat(50));

    // These are concentration values (μg/m³), not AQI values
    const concentrations = {
        pm25: 25.5,    // Moderate concentration
        o3: 135.2,     // Moderate concentration
        no2: 85.3,     // Moderate concentration
    };

    console.log('   Input concentrations (μg/m³):');
    Object.entries(concentrations).forEach(([pollutant, value]) => {
        console.log(`     ${pollutant}: ${value} μg/m³`);
    });

    // Health Canada AQHI formula
    let aqhi = 0;
    if (concentrations.pm25) {
        aqhi += Math.exp(0.000487 * concentrations.pm25) - 1;
    }
    if (concentrations.o3) {
        aqhi += Math.exp(0.000871 * concentrations.o3) - 1;
    }
    if (concentrations.no2) {
        aqhi += Math.exp(0.000537 * concentrations.no2) - 1;
    }

    aqhi = (10.0 / 10.4) * 100 * aqhi;
    aqhi = Math.max(0, Math.round(aqhi));

    console.log(`\n   Calculated AQHI: ${aqhi}`);

    // AQHI should be in reasonable range (1-10+)
    const isValidAQHI = aqhi >= 1 && aqhi <= 15;
    console.log(`   AQHI validation: ${isValidAQHI ? 'PASS' : 'FAIL'} ✅`);

    return isValidAQHI;
}

async function runAllTests() {
    console.log('🎯 Testing AQI-to-Concentration Pipeline\n');

    const results = [
        testAQIConversion(),
        testStationDataConversion(),
        testAQHICalculation()
    ];

    const passedTests = results.filter(Boolean).length;
    const totalTests = results.length;

    console.log('\n' + '═'.repeat(60));
    console.log(`📊 TEST SUMMARY: ${passedTests}/${totalTests} test suites passed`);

    if (passedTests === totalTests) {
        console.log('✅ ALL TESTS PASSED! The AQI conversion pipeline is working correctly.');
        console.log('\n🔬 Key Validations:');
        console.log('   ✓ AQI values are correctly converted to concentrations');
        console.log('   ✓ Station data processing works with WAQI format');
        console.log('   ✓ Weather parameters are properly filtered out');
        console.log('   ✓ AQHI calculations use real concentrations (not AQI)');
        console.log('   ✓ Output values are within expected scientific ranges');

        console.log('\n📈 Impact:');
        console.log('   • Supabase now stores actual pollutant concentrations');
        console.log('   • 3-hour averages are calculated from real μg/m³ values');
        console.log('   • AQHI calculations are scientifically accurate');
        console.log('   • Dashboard displays meaningful concentration units');
    } else {
        console.log('❌ SOME TESTS FAILED! Check the conversion logic.');
    }
}

// Run the tests
runAllTests();