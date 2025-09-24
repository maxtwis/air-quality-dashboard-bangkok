// Test Enhanced Data Collection API with OpenWeather Integration
// This simulates what your cron-job.org will call

console.log('🧪 Testing Enhanced Data Collection API...\n');

async function testEnhancedCollection() {
    try {
        const apiUrl = 'http://127.0.0.1:3000/api/collect-data';

        console.log('📞 Calling enhanced collection API...');
        console.log(`   URL: ${apiUrl}`);

        // Set environment variable for testing (in real deployment, this goes in Vercel)
        if (typeof process !== 'undefined' && process.env) {
            process.env.OPENWEATHER_API_KEY = 'a180db2b4dba131e42c97be80d3d018f';
            console.log('   🔑 OpenWeather API key set for testing');
        }

        const startTime = Date.now();

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'cron-job.org/test'
            }
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`   ⏱️ Request completed in ${duration}ms`);
        console.log(`   📊 Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API call failed:', errorText);
            return false;
        }

        const result = await response.json();

        console.log('\n✅ API Response Received:');
        console.log('═'.repeat(50));

        console.log(`📡 WAQI Stations: ${result.stored || 0} fetched`);
        console.log(`🔍 Detailed Data: ${result.detailedStations || 0} stations with pollutant data`);

        if (result.openWeatherData !== undefined) {
            console.log(`🌐 OpenWeather Enhancement:`);
            console.log(`   📊 Data collected: ${result.openWeatherData} readings`);
            console.log(`   📞 API calls made: ${result.openWeatherApiCalls || 0}`);

            if (result.openWeatherResult) {
                const ow = result.openWeatherResult;
                console.log(`   🎯 Stations needing data: ${ow.stationsNeeding || 0}`);
                console.log(`   ✅ Successful calls: ${ow.successfulCalls || 0}`);
                console.log(`   ❌ Failed calls: ${ow.failedCalls || 0}`);
                console.log(`   💾 Stored in Supabase: ${ow.stored || 0} readings`);
            }
        } else {
            console.log('🌐 OpenWeather: Not integrated yet (normal for first test)');
        }

        console.log(`💾 Database Storage: ${result.databaseWorking ? '✅ Working' : '❌ Failed'}`);
        console.log(`⏰ Timestamp: ${result.timestamp}`);

        console.log('\n💬 Message:');
        console.log(`   "${result.message}"`);

        // Analyze the results
        console.log('\n🔍 Analysis:');
        if (result.openWeatherData > 0) {
            console.log(`   ✅ OpenWeather integration is working!`);
            console.log(`   🎯 Enhanced ${result.openWeatherData} stations with missing O₃/NO₂`);
            console.log(`   📈 API usage: ${result.openWeatherApiCalls}/1000 daily limit`);
        } else {
            console.log(`   ℹ️ No stations needed OpenWeather enhancement`);
            console.log(`   📋 Possible reasons:`);
            console.log(`      • All stations have complete O₃/NO₂ data`);
            console.log(`      • OpenWeather API key not set in environment`);
            console.log(`      • API rate limit reached`);
        }

        if (result.databaseWorking) {
            console.log(`   ✅ Data is being stored in Supabase for 3-hour averages`);
        } else {
            console.log(`   ⚠️ Database storage failed - check Supabase configuration`);
        }

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// Instructions for setting up environment variables
function showSetupInstructions() {
    console.log('\n📋 Setup Instructions:');
    console.log('═'.repeat(50));

    console.log('\n1️⃣ **Add Environment Variable in Vercel:**');
    console.log('   Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables');
    console.log('   Add:');
    console.log('     Name: OPENWEATHER_API_KEY');
    console.log('     Value: a180db2b4dba131e42c97be80d3d018f');
    console.log('     Environments: Production, Preview, Development (check all)');

    console.log('\n2️⃣ **Redeploy Your Project:**');
    console.log('   After adding the environment variable, trigger a new deployment');
    console.log('   The enhanced collection will start on next cron-job.org call');

    console.log('\n3️⃣ **Monitor Results:**');
    console.log('   Check cron-job.org execution logs');
    console.log('   Look for "OpenWeather enhancement" messages');
    console.log('   Verify data in Supabase openweather_readings table');

    console.log('\n4️⃣ **Expected Improvements:**');
    console.log('   🎯 More stations with AQHI calculations');
    console.log('   📊 Better air quality health assessments');
    console.log('   🌐 Enhanced data quality indicators');
}

// Run the test
testEnhancedCollection().then(success => {
    if (success) {
        console.log('\n🎉 Enhanced Collection API Test PASSED!');
        showSetupInstructions();
    } else {
        console.log('\n❌ Enhanced Collection API Test FAILED');
        console.log('🔧 Check the API implementation and try again');
    }
}).catch(error => {
    console.error('❌ Unexpected test error:', error);
    showSetupInstructions();
});