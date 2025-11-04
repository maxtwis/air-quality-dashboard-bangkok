/**
 * Batched Google AQHI Collection
 * /api/google-batch?batch=1 (1, 2, or 3)
 *
 * Collects 5 locations per batch with automatic AQHI calculation via trigger
 * Call this 3 times from cron-job.org
 */

const KEY = process.env.GOOGLE_AIR_QUALITY_API_KEY;

const ALL = [
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

export default async function handler(req, res) {
  const start = Date.now();
  try {
    if (!KEY) return res.status(500).json({ error: 'API key missing' });

    const batch = parseInt(req.query.batch) || 1;
    if (![1, 2, 3].includes(batch)) {
      return res.status(400).json({ error: 'batch must be 1, 2, or 3' });
    }

    // Split into 3 batches of 5
    const locations = batch === 1 ? ALL.slice(0, 5) : batch === 2 ? ALL.slice(5, 10) : ALL.slice(10, 15);

    const hour = new Date();
    hour.setMinutes(0, 0, 0);
    const timestamp = hour.toISOString();

    // Collect in parallel
    const promises = locations.map(async (loc) => {
      try {
        const response = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: { latitude: loc.lat, longitude: loc.lng },
            extraComputations: ['POLLUTANT_CONCENTRATION'],
            languageCode: 'en'
          })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const p = {};
        if (data?.pollutants) {
          data.pollutants.forEach(pol => {
            const v = pol.concentration?.value;
            if (v !== undefined) p[pol.code] = v;
          });
        }

        return {
          location_id: loc.id,
          hour_timestamp: timestamp,
          pm25: p.pm25 || null,
          pm10: p.pm10 || null,
          o3: p.o3 || null,
          no2: p.no2 || null,
          so2: p.so2 || null,
          co: p.co || null,
          data_quality: 'EXCELLENT'
        };
      } catch (error) {
        console.error(`Loc ${loc.id}:`, error.message);
        return null;
      }
    });

    const results = (await Promise.all(promises)).filter(r => r);

    // Store - trigger will calculate AQHI automatically
    if (results.length > 0) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
      );

      const { error } = await supabase
        .from('google_aqhi_hourly')
        .upsert(results, { onConflict: 'location_id,hour_timestamp' });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({
        success: true,
        batch,
        collected: results.length,
        failed: locations.length - results.length,
        duration_ms: Date.now() - start,
        timestamp,
        note: 'AQHI calculated by database trigger'
      });
    }

    return res.status(500).json({ error: 'No data collected' });

  } catch (error) {
    return res.status(500).json({ error: error.message, duration_ms: Date.now() - start });
  }
}
