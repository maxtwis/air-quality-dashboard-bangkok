/**
 * Google Data Collection ONLY (no AQHI calculation)
 * Endpoint: /api/google-collect-only
 *
 * Collects and stores Google API data for all 15 locations
 * AQHI calculation happens separately
 */

import { createClient } from '@supabase/supabase-js';

const GOOGLE_API_KEY = process.env.GOOGLE_AIR_QUALITY_API_KEY;

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

const LOCATIONS = [
  { id: 1, lat: 13.758108, lng: 100.500366 },
  { id: 2, lat: 13.720943, lng: 100.481581 },
  { id: 3, lat: 13.733446, lng: 100.463527 },
  { id: 4, lat: 13.735493, lng: 100.504763 },
  { id: 5, lat: 13.768083, lng: 100.463323 },
  { id: 6, lat: 13.716707, lng: 100.355342 },
  { id: 7, lat: 13.66671, lng: 100.515025 },
  { id: 8, lat: 13.772018, lng: 100.558131 },
  { id: 9, lat: 13.701217, lng: 100.612882 },
  { id: 10, lat: 13.845409, lng: 100.88052 },
  { id: 11, lat: 13.731048, lng: 100.546676 },
  { id: 12, lat: 13.752959, lng: 100.515871 },
  { id: 13, lat: 13.74281, lng: 100.502217 },
  { id: 14, lat: 13.79493179, lng: 100.5014054 },
  { id: 15, lat: 13.82163586, lng: 100.5425091 }
];

async function fetchGoogle(lat, lng) {
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

  if (!response.ok) throw new Error(`API error ${response.status}`);
  return await response.json();
}

export default async function handler(req, res) {
  const start = Date.now();

  try {
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    const timestamp = hour.toISOString();

    // Collect all in parallel
    const promises = LOCATIONS.map(async (loc) => {
      try {
        const data = await fetchGoogle(loc.lat, loc.lng);
        const pollutants = {};

        if (data?.pollutants) {
          data.pollutants.forEach(p => {
            const val = p.concentration?.value;
            if (val !== undefined) pollutants[p.code] = val;
          });
        }

        return {
          location_id: loc.id,
          hour_timestamp: timestamp,
          pm25: pollutants.pm25 || null,
          pm10: pollutants.pm10 || null,
          o3: pollutants.o3 || null,
          no2: pollutants.no2 || null,
          so2: pollutants.so2 || null,
          co: pollutants.co || null,
          data_quality: 'EXCELLENT'
        };
      } catch (error) {
        console.error(`Loc ${loc.id}:`, error.message);
        return null;
      }
    });

    const results = (await Promise.all(promises)).filter(r => r);

    // Store only - NO AQHI CALCULATION
    if (results.length > 0) {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('google_aqhi_hourly')
        .upsert(results, { onConflict: 'location_id,hour_timestamp' });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({
        success: true,
        collected: results.length,
        failed: LOCATIONS.length - results.length,
        duration_ms: Date.now() - start,
        timestamp
      });
    }

    return res.status(500).json({ error: 'No data collected' });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
