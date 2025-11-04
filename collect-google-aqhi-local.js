/**
 * Local Google AQHI Data Collection Script
 *
 * Run this hourly on your local computer with Windows Task Scheduler
 * or node-cron. No timeout limits!
 *
 * Usage: node collect-google-aqhi-local.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const GOOGLE_API_KEY = process.env.GOOGLE_AIR_QUALITY_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// 15 Community Monitoring Points
const LOCATIONS = [
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
    throw new Error(`Google API error: ${response.status}`);
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
      pollutants[code] = value;
    }
  }

  return pollutants;
}

async function main() {
  const startTime = Date.now();

  console.log(`[${new Date().toISOString()}] 🕐 Starting Google AQHI collection...`);

  // Verify configuration
  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_AIR_QUALITY_API_KEY not found in .env.local');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase credentials not found in .env.local');
    process.exit(1);
  }

  // Round timestamp to current hour
  const currentHour = new Date();
  currentHour.setMinutes(0, 0, 0);
  const hourTimestamp = currentHour.toISOString();

  console.log(`📅 Collection timestamp: ${hourTimestamp}`);

  // Collect data for all 15 locations in parallel
  console.log(`🚀 Collecting data for ${LOCATIONS.length} locations...`);

  const promises = LOCATIONS.map(async (location) => {
    try {
      const googleData = await fetchGoogleAirQuality(location.lat, location.lng);
      const pollutants = extractPollutants(googleData);

      if (!pollutants) {
        console.log(`⚠️  Location ${location.id} (${location.name}): No pollutant data`);
        return null;
      }

      console.log(`✅ Location ${location.id} (${location.name}): Collected`);

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
      console.error(`❌ Location ${location.id} (${location.name}) failed:`, error.message);
      return null;
    }
  });

  const results = (await Promise.all(promises)).filter(r => r !== null);

  const collectionTime = Date.now() - startTime;
  console.log(`\n📊 Collection completed: ${results.length}/${LOCATIONS.length} locations in ${collectionTime}ms`);

  // Store in Supabase
  if (results.length > 0) {
    console.log('\n💾 Storing data in Supabase...');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { error } = await supabase
      .from('google_aqhi_hourly')
      .upsert(results, {
        onConflict: 'location_id,hour_timestamp',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('❌ Supabase insert error:', error);
      process.exit(1);
    }

    const totalTime = Date.now() - startTime;

    console.log('✅ Data stored successfully!');
    console.log('🎯 Database trigger will calculate AQHI automatically');
    console.log(`⏱️  Total duration: ${totalTime}ms`);
    console.log(`\n✨ Collection complete! Next run at ${new Date(Date.now() + 3600000).toISOString().slice(0, 16)}:00`);

  } else {
    console.error('\n❌ No data collected - all locations failed');
    process.exit(1);
  }
}

// Run the collection
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
