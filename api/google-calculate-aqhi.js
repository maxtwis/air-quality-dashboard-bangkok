/**
 * Calculate AQHI from stored Google data
 * Endpoint: /api/google-calculate-aqhi
 *
 * Runs AQHI calculations for all locations
 * Call this 5 minutes after data collection
 */

import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );
}

const LOCATION_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export default async function handler(req, res) {
  const start = Date.now();

  try {
    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    const timestamp = hour.toISOString();

    const supabase = getSupabaseClient();

    // Calculate AQHI for all locations in parallel
    const promises = LOCATION_IDS.map(async (id) => {
      try {
        await supabase.rpc('calculate_3h_averages_and_aqhi', {
          target_location_id: id,
          target_hour: timestamp
        });
        return id;
      } catch (error) {
        console.error(`AQHI calc failed for ${id}:`, error.message);
        return null;
      }
    });

    const results = (await Promise.all(promises)).filter(r => r);

    return res.json({
      success: true,
      aqhi_calculated: results.length,
      failed: LOCATION_IDS.length - results.length,
      duration_ms: Date.now() - start,
      timestamp
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
