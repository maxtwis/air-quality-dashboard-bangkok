/**
 * Batch Google AQHI Collection
 * Endpoint: /api/google-aqhi-batch?batch=1 (1, 2, or 3)
 *
 * Collects 5 locations per batch to avoid timeouts
 * Call this 3 times from cron-job.org with different batch numbers
 */

import { createClient } from '@supabase/supabase-js';

const GOOGLE_API_KEY = process.env.GOOGLE_AIR_QUALITY_API_KEY;

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

// 15 Community Monitoring Points - split into 3 batches
const ALL_LOCATIONS = [
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

// Split into 3 batches
const BATCHES = {
  1: ALL_LOCATIONS.slice(0, 5),   // Locations 1-5
  2: ALL_LOCATIONS.slice(5, 10),  // Locations 6-10
  3: ALL_LOCATIONS.slice(10, 15)  // Locations 11-15
};

async function fetchGoogleAirQuality(lat, lng) {
  const url = 'https://airquality.googleapis.com/v1/currentConditions:lookup';

  const response = await fetch(`${url}?key=${GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: { latitude: lat, longitude: lng },
      extraComputations: ['POLLUTANT_CONCENTRATION'],
      languageCode: 'en'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API ${response.status}: ${errorText}`);
  }

  return await response.json();
}

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

export default async function handler(req, res) {
  const startTime = Date.now();

  try {
    if (!['GET', 'POST'].includes(req.method)) {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ success: false, error: 'Google API key not configured' });
    }

    // Get batch number from query parameter
    const batchNum = parseInt(req.query.batch) || 1;
    if (![1, 2, 3].includes(batchNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch number. Use batch=1, batch=2, or batch=3'
      });
    }

    const locations = BATCHES[batchNum];
    console.log(`[${new Date().toISOString()}] 🕐 Collecting batch ${batchNum} (${locations.length} locations)`);

    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);
    const hourTimestamp = currentHour.toISOString();

    // Collect all locations in this batch
    const promises = locations.map(async (location) => {
      try {
        const googleData = await fetchGoogleAirQuality(location.lat, location.lng);
        const pollutants = extractPollutants(googleData);

        if (!pollutants) {
          console.log(`⚠️ Location ${location.id}: No pollutant data`);
          return null;
        }

        console.log(`✅ Location ${location.id}: Collected`);
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
        console.error(`❌ Location ${location.id}:`, error.message);
        return null;
      }
    });

    const results = (await Promise.all(promises)).filter(r => r !== null);

    // Store in Supabase
    if (results.length > 0) {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('google_aqhi_hourly')
        .upsert(results, { onConflict: 'location_id,hour_timestamp' });

      if (error) {
        console.error('❌ Database error:', error);
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: error.message
        });
      }

      // Calculate AQHI for collected locations only
      const aqhiPromises = results.map(async (result) => {
        try {
          await supabase.rpc('calculate_3h_averages_and_aqhi', {
            target_location_id: result.location_id,
            target_hour: hourTimestamp
          });
          return result.location_id;
        } catch (error) {
          console.error(`❌ AQHI calc failed for ${result.location_id}:`, error.message);
          return null;
        }
      });

      const aqhiResults = (await Promise.all(aqhiPromises)).filter(id => id !== null);
      const duration = Date.now() - startTime;

      console.log(`✅ Batch ${batchNum} completed: ${results.length}/${locations.length} in ${duration}ms`);

      return res.status(200).json({
        success: true,
        batch: batchNum,
        timestamp: hourTimestamp,
        locations_collected: results.length,
        locations_failed: locations.length - results.length,
        aqhi_calculated: aqhiResults.length,
        duration_ms: duration,
        location_ids: results.map(r => r.location_id)
      });
    } else {
      return res.status(500).json({
        success: false,
        batch: batchNum,
        error: 'No data collected',
        duration_ms: Date.now() - startTime
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      duration_ms: duration
    });
  }
}
