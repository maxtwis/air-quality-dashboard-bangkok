/**
 * Vercel Serverless Function: Google AQHI Data Collection
 * Endpoint: /api/google-aqhi-collect
 *
 * This endpoint is called hourly by cron-job.org to collect air quality data
 * from Google Air Quality API for 15 community monitoring locations in Bangkok.
 */

import { createClient } from '@supabase/supabase-js';

const GOOGLE_API_KEY = process.env.GOOGLE_AIR_QUALITY_API_KEY;

// Initialize Supabase lazily (only when needed)
function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

// 15 Community Monitoring Points from community_point.csv
const COMMUNITY_LOCATIONS = [
  { id: 1, name: 'มัสยยิดบ้านตึกดิน', lat: 13.758108, lng: 100.500366 },
  { id: 2, name: 'หลังศูนย์จันทร์ฉิมไพบูลย์', lat: 13.720943, lng: 100.481581 },
  { id: 3, name: 'ปลายซอยศักดิ์เจริญ', lat: 13.733446, lng: 100.463527 },
  { id: 4, name: 'ซอยท่าดินแดง 14 และ 16', lat: 13.735493, lng: 100.504763 },
  { id: 5, name: 'วัดไชยทิศ', lat: 13.768083, lng: 100.463323 },
  { id: 6, name: 'รักเจริญ', lat: 13.716707, lng: 100.355342 },
  { id: 7, name: 'หมู่ 7 ราษฎร์บูรณะ', lat: 13.66671, lng: 100.515025 },
  { id: 8, name: 'ชุมชนสวัสดี', lat: 13.772018, lng: 100.558131 },
  { id: 9, name: 'สาหร่ายทองคำ', lat: 13.701217, lng: 100.612882 },
  { id: 10, name: 'นันทวันเซ็นต์ 2', lat: 13.845409, lng: 100.88052 },
  { id: 11, name: 'ซอยพระเจน', lat: 13.731048, lng: 100.546676 },
  { id: 12, name: 'มัสยิดมหานาค', lat: 13.752959, lng: 100.515871 },
  { id: 13, name: 'ชุมชนสะพานหัน', lat: 13.74281, lng: 100.502217 },
  { id: 14, name: 'บ้านมั่นคงฟ้าใหม่', lat: 13.79493179, lng: 100.5014054 },
  { id: 15, name: 'บ่อฝรั่งริมน้ำ', lat: 13.82163586, lng: 100.5425091 }
];

/**
 * Fetch air quality from Google API
 */
async function fetchGoogleAirQuality(lat, lng) {
  const url = 'https://airquality.googleapis.com/v1/currentConditions:lookup';

  const requestBody = {
    location: { latitude: lat, longitude: lng },
    extraComputations: [
      'HEALTH_RECOMMENDATIONS',
      'DOMINANT_POLLUTANT_CONCENTRATION',
      'POLLUTANT_CONCENTRATION',
      'POLLUTANT_ADDITIONAL_INFO'
    ],
    languageCode: 'en'
  };

  const response = await fetch(`${url}?key=${GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Extract pollutants from Google response
 */
function extractPollutants(googleData) {
  if (!googleData?.pollutants) return null;

  const pollutants = {};

  for (const pollutant of googleData.pollutants) {
    const code = pollutant.code;
    const value = pollutant.concentration?.value;

    if (value !== undefined) {
      switch (code) {
        case 'pm25': pollutants.pm25 = value; break;
        case 'pm10': pollutants.pm10 = value; break;
        case 'o3': pollutants.o3 = value; break;
        case 'no2': pollutants.no2 = value; break;
        case 'so2': pollutants.so2 = value; break;
        case 'co': pollutants.co = value; break;
      }
    }
  }

  return pollutants;
}

/**
 * Main handler for Vercel serverless function
 */
export default async function handler(req, res) {
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] 🕐 Starting Google AQHI collection`);

  // Allow GET and POST methods
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['GET', 'POST']
    });
  }

  // Verify API key from environment
  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_AIR_QUALITY_API_KEY not configured');
    return res.status(500).json({
      success: false,
      error: 'Google API key not configured',
      timestamp: new Date().toISOString()
    });
  }

  // Round timestamp to current hour
  const currentHour = new Date();
  currentHour.setMinutes(0, 0, 0);
  const hourTimestamp = currentHour.toISOString();

  const results = [];
  let successCount = 0;
  let failCount = 0;

  // Optimized batch processing (like collect-data.js)
  const batchSize = 5;
  console.log(`🚀 Collecting data for ${COMMUNITY_LOCATIONS.length} locations in batches of ${batchSize}...`);

  for (let i = 0; i < COMMUNITY_LOCATIONS.length; i += batchSize) {
    const batch = COMMUNITY_LOCATIONS.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(COMMUNITY_LOCATIONS.length / batchSize);

    console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} locations)`);

    // Process batch in parallel
    const promises = batch.map(async (location) => {
      try {
        const googleData = await fetchGoogleAirQuality(location.lat, location.lng);
        const pollutants = extractPollutants(googleData);

        if (!pollutants) {
          console.log(`⚠️ Location ${location.id}: No pollutant data`);
          return null;
        }

        console.log(`✅ Location ${location.id}: Data collected`);
        return {
          location_id: location.id,
          hour_timestamp: hourTimestamp,
          pm25: pollutants.pm25 || null,
          pm10: pollutants.pm10 || null,
          o3: pollutants.o3 || null,
          no2: pollutants.no2 || null,
          so2: pollutants.so2 || null,
          co: pollutants.co || null,
          data_quality: 'EXCELLENT'
        };
      } catch (error) {
        console.error(`❌ Location ${location.id} failed:`, error.message);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    const validResults = batchResults.filter(result => result !== null);

    results.push(...validResults);
    successCount += validResults.length;
    failCount += (batch.length - validResults.length);

    console.log(`📊 Progress: ${i + batch.length}/${COMMUNITY_LOCATIONS.length} - Success: ${validResults.length}/${batch.length}`);

    // Short delay between batches (like collect-data.js)
    if (i + batchSize < COMMUNITY_LOCATIONS.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Store in Supabase
  if (results.length > 0) {
    const supabase = getSupabaseClient();
    const { error: insertError } = await supabase
      .from('google_aqhi_hourly')
      .upsert(results, {
        onConflict: 'location_id,hour_timestamp',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error('❌ Supabase insert error:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: insertError.message,
        timestamp: new Date().toISOString()
      });
    }

    // Calculate 3-hour averages and AQHI
    const aqhiResults = [];

    for (const location of COMMUNITY_LOCATIONS) {
      const { error: calcError } = await supabase.rpc('calculate_3h_averages_and_aqhi', {
        target_location_id: location.id,
        target_hour: hourTimestamp
      });

      if (!calcError) {
        aqhiResults.push(location.id);
      }
    }

    const duration = Date.now() - startTime;

    console.log(`✅ Collection completed: ${successCount}/${COMMUNITY_LOCATIONS.length} locations`);
    console.log(`⏱️  Duration: ${duration}ms`);

    return res.status(200).json({
      success: true,
      timestamp: hourTimestamp,
      locations_collected: successCount,
      locations_failed: failCount,
      aqhi_calculated: aqhiResults.length,
      duration_ms: duration
    });

  } else {
    console.error('❌ No data collected');
    return res.status(500).json({
      success: false,
      error: 'No data collected',
      locations_failed: failCount,
      timestamp: new Date().toISOString()
    });
  }
}
