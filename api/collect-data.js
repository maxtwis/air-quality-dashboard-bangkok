// Vercel Edge Function to collect and store air quality data
// This runs on Vercel's edge network every 10 minutes via cron

export const config = {
  runtime: 'edge',
};

// This would be triggered by Vercel Cron Jobs every 10 minutes
export default async function handler(request) {
  // Only allow POST requests and verify it's from a cron job
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  try {
    // 1. Fetch current data from WAQI API
    console.log('🔄 Starting data collection from WAQI API...');
    const apiToken = process.env.AQICN_API_TOKEN || '354eb1b871693ef55f777c69e44e81bcaf215d40';
    const apiUrl = `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&token=${apiToken}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    console.log(`📊 WAQI API returned ${data.data?.length || 0} stations`);

    if (data.status !== 'ok') {
      throw new Error(`WAQI API Error: ${data.data}`);
    }

    // 2. Pass the raw stations data (don't pre-process)
    const stations = data.data || [];

    // 3. Store in database (multiple options below)
    await storeHistoricalData(stations);

    const result = {
      success: true,
      stored: stations.length,
      timestamp: new Date().toISOString(),
      message: `Successfully stored ${stations.length} station readings`
    };
    
    console.log('✅ Data collection completed:', result);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Data collection error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Database storage options (choose one):

// Option A: Vercel Postgres
async function storeHistoricalDataPostgres(stations) {
  const { sql } = await import('@vercel/postgres');
  
  for (const station of stations) {
    await sql`
      INSERT INTO air_quality_readings (
        station_uid, timestamp, lat, lon, aqi,
        pm25, no2, o3, so2, pm10, co, station_name
      ) VALUES (
        ${station.uid}, ${station.timestamp}, ${station.lat}, ${station.lon}, ${station.aqi},
        ${station.pollutants.pm25}, ${station.pollutants.no2}, ${station.pollutants.o3},
        ${station.pollutants.so2}, ${station.pollutants.pm10}, ${station.pollutants.co},
        ${station.station_name}
      )
    `;
  }
}

// Option B: Planetscale MySQL
async function storeHistoricalDataPlanetscale(stations) {
  const mysql = await import('mysql2/promise');
  
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: { rejectUnauthorized: true }
  });

  const query = `
    INSERT INTO air_quality_readings 
    (station_uid, timestamp, lat, lon, aqi, pm25, no2, o3, so2, pm10, co, station_name)
    VALUES ?
  `;

  const values = stations.map(station => [
    station.uid, station.timestamp, station.lat, station.lon, station.aqi,
    station.pollutants.pm25, station.pollutants.no2, station.pollutants.o3,
    station.pollutants.so2, station.pollutants.pm10, station.pollutants.co,
    station.station_name
  ]);

  await connection.execute(query, [values]);
  await connection.end();
}

// Option C: Supabase (Updated to match your schema)
async function storeHistoricalDataSupabase(stations) {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  const timestamp = new Date().toISOString();
  const stationsToStore = [];
  const readings = [];

  // Helper function to extract pollutant values
  function extractValue(station, pollutant) {
    let value = station.iaqi?.[pollutant]?.v;
    if (typeof value === 'object' && value !== null) {
      if (value.value !== undefined) value = value.value;
      else if (value.v !== undefined) value = value.v;
      else return null;
    }
    if (value !== undefined && value !== null && value !== '') {
      const numValue = parseFloat(value);
      return isNaN(numValue) ? null : numValue;
    }
    return null;
  }

  // Process each station
  for (const stationData of stations) {
    // Station metadata
    const station = {
      station_uid: stationData.uid?.toString(),
      name: stationData.station_name || stationData.station?.name || 'Unknown Station',
      latitude: stationData.lat,
      longitude: stationData.lon,
      city: 'Bangkok',
      country: 'Thailand',
      is_active: true
    };

    if (!station.station_uid || !station.latitude || !station.longitude) {
      continue;
    }

    stationsToStore.push(station);

    // Reading data
    const reading = {
      station_uid: station.station_uid,
      timestamp: timestamp,
      aqi: typeof stationData.aqi === 'number' ? stationData.aqi :
           (typeof stationData.aqi === 'string' ? parseInt(stationData.aqi) : null),

      // Use the extraction helper for accurate data
      pm25: extractValue(stationData, 'pm25'),
      pm10: extractValue(stationData, 'pm10'),
      o3: extractValue(stationData, 'o3'),
      no2: extractValue(stationData, 'no2'),
      so2: extractValue(stationData, 'so2'),
      co: extractValue(stationData, 'co'),

      // Weather data
      temperature: extractValue(stationData, 't'),
      humidity: extractValue(stationData, 'h'),
      pressure: extractValue(stationData, 'p'),
      wind_speed: extractValue(stationData, 'w'),
      wind_direction: extractValue(stationData, 'wd'),

      // Raw data for debugging
      raw_data: JSON.stringify({
        uid: stationData.uid,
        aqi: stationData.aqi,
        lat: stationData.lat,
        lon: stationData.lon,
        iaqi: stationData.iaqi,
        time: stationData.time
      })
    };

    readings.push(reading);
  }

  // Store stations (upsert)
  if (stationsToStore.length > 0) {
    const { error: stationsError } = await supabase
      .from('stations')
      .upsert(stationsToStore, {
        onConflict: 'station_uid',
        ignoreDuplicates: false
      });

    if (stationsError) throw stationsError;
  }

  // Store readings
  if (readings.length > 0) {
    const { error: readingsError } = await supabase
      .from('air_quality_readings')
      .insert(readings);

    if (readingsError) throw readingsError;
  }

  return { stationsStored: stationsToStore.length, readingsStored: readings.length };
}

// Use Supabase storage method
const storeHistoricalData = storeHistoricalDataSupabase;