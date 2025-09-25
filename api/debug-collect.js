// Debug version of data collection - shows exactly what's happening
export default async function handler(req, res) {
  const logs = [];

  function debugLog(message, data = null) {
    const logEntry = `${new Date().toISOString()} - ${message}`;
    logs.push(data ? `${logEntry}: ${JSON.stringify(data, null, 2)}` : logEntry);
    console.log(logEntry, data || '');
  }

  try {
    debugLog("🚀 Debug data collection started");
    debugLog("Request method", req.method);
    debugLog("Headers", {
      'user-agent': req.headers['user-agent'],
      'origin': req.headers['origin']
    });

    // 1. Check environment variables
    debugLog("🔍 Checking environment variables");
    const envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      AQICN_API_TOKEN: !!process.env.AQICN_API_TOKEN,
      OPENWEATHER_API_KEY: !!process.env.OPENWEATHER_API_KEY
    };
    debugLog("Environment variables present", envCheck);

    // 2. Test WAQI API
    debugLog("🌍 Testing WAQI API connection");
    const apiToken = process.env.AQICN_API_TOKEN || "354eb1b871693ef55f777c69e44e81bcaf215d40";
    const apiUrl = `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&token=${apiToken}`;

    const waqiResponse = await fetch(apiUrl);
    const waqiData = await waqiResponse.json();

    debugLog("WAQI API response status", waqiData.status);
    debugLog("WAQI stations count", waqiData.data?.length || 0);

    if (waqiData.status !== "ok") {
      throw new Error(`WAQI API Error: ${waqiData.data}`);
    }

    // 3. Test module imports
    debugLog("📦 Testing module imports");
    try {
      const { convertStationDataForSupabase } = require('../lib/aqi-converter-node.cjs');
      debugLog("✅ AQI converter imported successfully");

      // Test conversion with sample data
      if (waqiData.data && waqiData.data.length > 0) {
        const sampleStation = waqiData.data[0];
        const converted = convertStationDataForSupabase(sampleStation);
        debugLog("Sample conversion result", converted);
      }
    } catch (importError) {
      debugLog("❌ Module import failed", importError.message);
    }

    // 4. Test Supabase connection
    debugLog("🗄️ Testing Supabase connection");
    try {
      const { createClient } = await import("@supabase/supabase-js");

      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        debugLog("❌ Missing Supabase credentials");
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      }

      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      debugLog("✅ Supabase client created");

      // Test database connection
      const { data: testData, error: testError } = await supabase
        .from('stations')
        .select('count')
        .limit(1);

      if (testError) {
        debugLog("❌ Database connection failed", testError);
        throw testError;
      }

      debugLog("✅ Database connection successful");

      // Try to insert a test station
      const testStation = {
        station_uid: `debug-test-${Date.now()}`,
        name: 'Debug Test Station',
        latitude: 13.7563,
        longitude: 100.5018,
        city: 'Bangkok',
        country: 'Thailand',
        is_active: true
      };

      const { data: insertData, error: insertError } = await supabase
        .from('stations')
        .insert([testStation]);

      if (insertError) {
        debugLog("❌ Test insert failed", insertError);
      } else {
        debugLog("✅ Test insert successful");

        // Clean up test data
        await supabase
          .from('stations')
          .delete()
          .eq('station_uid', testStation.station_uid);
        debugLog("🧹 Test data cleaned up");
      }

    } catch (supabaseError) {
      debugLog("❌ Supabase test failed", supabaseError.message);
    }

    // 5. Summary
    const summary = {
      timestamp: new Date().toISOString(),
      waqiWorking: waqiData.status === "ok",
      stationsFound: waqiData.data?.length || 0,
      environmentOK: envCheck.SUPABASE_URL && envCheck.SUPABASE_SERVICE_ROLE_KEY,
      nextSteps: []
    };

    if (!summary.waqiWorking) {
      summary.nextSteps.push("Fix WAQI API connection");
    }
    if (!summary.environmentOK) {
      summary.nextSteps.push("Set Supabase environment variables in Vercel");
    }
    if (summary.waqiWorking && summary.environmentOK) {
      summary.nextSteps.push("Full data collection should work now");
    }

    debugLog("📋 Summary", summary);

    return res.status(200).json({
      success: true,
      summary,
      logs: logs,
      detailedLogs: logs.join('\n')
    });

  } catch (error) {
    debugLog("💥 Fatal error", error.message);

    return res.status(500).json({
      success: false,
      error: error.message,
      logs: logs,
      detailedLogs: logs.join('\n')
    });
  }
}