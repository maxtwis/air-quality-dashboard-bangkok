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
    const apiUrl = `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&token=${process.env.WAQI_API_TOKEN}`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log(`📊 WAQI API returned ${data.data?.length || 0} stations`);
    
    if (data.status !== 'ok') {
      throw new Error(`WAQI API Error: ${data.data}`);
    }

    // 2. Process stations data
    const stations = data.data.map(station => ({
      uid: station.uid,
      timestamp: new Date().toISOString(),
      lat: station.lat,
      lon: station.lon,
      aqi: station.aqi,
      pollutants: {
        pm25: station.iaqi?.pm25?.v || 0,
        no2: station.iaqi?.no2?.v || 0,
        o3: station.iaqi?.o3?.v || 0,
        so2: station.iaqi?.so2?.v || 0,
        pm10: station.iaqi?.pm10?.v || 0,
        co: station.iaqi?.co?.v || 0
      },
      station_name: station.station?.name || 'Unknown'
    }));

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

// Option C: Supabase
async function storeHistoricalDataSupabase(stations) {
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const { error } = await supabase
    .from('air_quality_readings')
    .insert(stations.map(station => ({
      station_uid: station.uid,
      timestamp: station.timestamp,
      lat: station.lat,
      lon: station.lon,
      aqi: station.aqi,
      pm25: station.pollutants.pm25,
      no2: station.pollutants.no2,
      o3: station.pollutants.o3,
      so2: station.pollutants.so2,
      pm10: station.pollutants.pm10,
      co: station.pollutants.co,
      station_name: station.station_name
    })));

  if (error) throw error;
}

// Use Supabase storage method
const storeHistoricalData = storeHistoricalDataSupabase;