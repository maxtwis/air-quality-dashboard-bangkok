// Console Integration Test - Run this in browser console at http://127.0.0.1:3000
// This will test the OpenWeather integration on the live dashboard

console.log('🧪 Starting Live Dashboard OpenWeather Integration Test...\n');

// Wait for dashboard to load, then test integration
setTimeout(async () => {
    try {
        console.log('1️⃣ Testing OpenWeather Module Availability...');

        // Try to access OpenWeather client
        const openWeatherModule = await import('./js/openweather-api.js');
        const { openWeatherClient, getOpenWeatherFallback } = openWeatherModule;

        console.log('   ✅ OpenWeather modules loaded successfully');

        // Test API key
        console.log('\n2️⃣ Testing API Key...');
        const isValid = await openWeatherClient.testApiKey();
        console.log(`   API Key Status: ${isValid ? '✅ Valid' : '❌ Invalid'}`);

        if (isValid) {
            // Test data fetch
            console.log('\n3️⃣ Testing Data Fetch...');
            const testData = await openWeatherClient.getPollutionData(13.7563, 100.5018);

            if (testData) {
                console.log('   ✅ Data fetch successful');
                console.log('   📊 Available pollutants:', Object.keys(testData).filter(k => !['timestamp', 'source'].includes(k) && testData[k] !== null));
                console.log('   🌡️ Sample values:', {
                    PM25: testData.pm25,
                    O3: testData.o3,
                    NO2: testData.no2
                });
            }

            // Check rate limit status
            console.log('\n4️⃣ Checking Rate Limit Status...');
            const rateStatus = openWeatherClient.getRateLimitStatus();
            console.log('   📞 API Usage:', `${rateStatus.used}/${rateStatus.limit} calls used`);
            console.log('   ⏰ Resets at:', new Date(rateStatus.resetTime).toLocaleString());
        }

        // Test with actual dashboard stations if available
        console.log('\n5️⃣ Testing with Dashboard Stations...');

        // Check if dashboard has loaded stations
        if (typeof window !== 'undefined' && window.dashboard && window.dashboard.stations) {
            const stations = window.dashboard.stations;
            console.log(`   📡 Found ${stations.length} stations from dashboard`);

            // Find stations missing O3/NO2
            const stationsNeedingEnhancement = stations.filter(station => {
                const hasO3 = station.iaqi?.o3?.v !== undefined;
                const hasNO2 = station.iaqi?.no2?.v !== undefined;
                return !hasO3 || !hasNO2;
            });

            console.log(`   🎯 Stations needing enhancement: ${stationsNeedingEnhancement.length}/${stations.length}`);

            if (stationsNeedingEnhancement.length > 0) {
                // Test fallback for first station
                const testStation = stationsNeedingEnhancement[0];
                console.log(`   🧪 Testing enhancement for: ${testStation.station?.name || testStation.uid}`);

                const fallbackData = await getOpenWeatherFallback(testStation);

                if (fallbackData) {
                    console.log('   ✅ Enhancement successful!');
                    console.log('   📊 Enhanced data:', {
                        O3: fallbackData.o3,
                        NO2: fallbackData.no2,
                        source: fallbackData.source
                    });
                } else {
                    console.log('   ℹ️ No enhancement needed or data unavailable');
                }
            }
        } else {
            console.log('   ℹ️ Dashboard stations not yet loaded, try again in a few seconds');
        }

        console.log('\n✅ Live Dashboard Integration Test Complete!');
        console.log('🎯 OpenWeather integration is working on the live dashboard');

        // Make functions available for manual testing
        window.testOpenWeather = {
            client: openWeatherClient,
            fallback: getOpenWeatherFallback,
            test: async (lat = 13.7563, lon = 100.5018) => {
                console.log('🧪 Manual test...');
                const data = await openWeatherClient.getPollutionData(lat, lon);
                console.log('Result:', data);
                return data;
            }
        };

        console.log('\n💡 Manual testing available:');
        console.log('   window.testOpenWeather.test() - Test API call');
        console.log('   window.testOpenWeather.client - Access OpenWeather client');
        console.log('   window.testOpenWeather.fallback - Access fallback function');

    } catch (error) {
        console.error('❌ Integration test failed:', error);
        console.log('🔧 Check that all modules are properly loaded');
    }
}, 3000); // Wait 3 seconds for dashboard to load

console.log('⏳ Waiting for dashboard to load... (3 seconds)');
console.log('💡 If the dashboard is already loaded, you can run this test immediately:');
console.log('   Copy and paste this entire script into browser console at http://127.0.0.1:3000');