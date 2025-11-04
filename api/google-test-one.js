/**
 * Test Google AQHI Collection - ONE location only
 * /api/google-test-one
 *
 * Test if Vercel Fluid Compute works with 1 location
 */

const KEY = process.env.GOOGLE_AIR_QUALITY_API_KEY;

export default async function handler(req, res) {
  const start = Date.now();

  try {
    console.log('Testing with 1 location...');

    if (!KEY) {
      return res.status(500).json({ error: 'API key missing' });
    }

    // Test with just location 1
    const location = { id: 1, lat: 13.758108, lng: 100.500366 };

    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    const timestamp = hour.toISOString();

    console.log('Calling Google API...');

    // Call Google API
    const response = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { latitude: location.lat, longitude: location.lng },
        extraComputations: ['POLLUTANT_CONCENTRATION'],
        languageCode: 'en'
      })
    });

    if (!response.ok) {
      return res.status(500).json({
        error: `Google API error: ${response.status}`,
        duration_ms: Date.now() - start
      });
    }

    const data = await response.json();
    console.log('Google API response received');

    // Extract pollutants
    const p = {};
    if (data?.pollutants) {
      data.pollutants.forEach(pol => {
        const v = pol.concentration?.value;
        if (v !== undefined) p[pol.code] = v;
      });
    }

    const result = {
      location_id: location.id,
      hour_timestamp: timestamp,
      pm25: p.pm25 || null,
      pm10: p.pm10 || null,
      o3: p.o3 || null,
      no2: p.no2 || null,
      so2: p.so2 || null,
      co: p.co || null,
      data_quality: 'EXCELLENT'
    };

    console.log('Storing in Supabase...');

    // Store in Supabase (use dynamic import like collect-data.js)
    let dbSuccess = false;
    let dbError = null;

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
      );

      const { error } = await supabase
        .from('google_aqhi_hourly')
        .upsert([result], { onConflict: 'location_id,hour_timestamp' });

      if (error) {
        dbError = error.message;
        console.error('❌ Database error:', error.message);
      } else {
        dbSuccess = true;
        console.log('✅ Database storage successful');
      }
    } catch (error) {
      dbError = error.message;
      console.error('❌ Supabase module error:', error.message);
      // Continue without database - like collect-data.js does
    }

    const duration = Date.now() - start;
    console.log(`Success in ${duration}ms`);

    return res.json({
      success: true,
      location_id: location.id,
      collected: 1,
      duration_ms: duration,
      timestamp,
      pollutants: p,
      databaseWorking: dbSuccess,
      dbError: dbError,
      note: dbSuccess ? 'Trigger will calculate AQHI automatically' : 'Data collected but database storage failed'
    });

  } catch (error) {
    const duration = Date.now() - start;
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
      duration_ms: duration
    });
  }
}
