// Vercel Serverless Function to collect and store air quality data
// This runs server-side via cron (changed from edge to serverless for full module support)

// This can be triggered by external cron services or Vercel daily cron
export default async function handler(req, res) {
  // Allow external cron services and manual triggers
  const allowedMethods = ['POST', 'GET'];
  const userAgent = req.headers['user-agent'] || '';
  const origin = req.headers['origin'] || '';
  const referer = req.headers['referer'] || '';

  console.log('🔍 Request details:', {
    method: req.method,
    userAgent: userAgent,
    origin: origin,
    referer: referer,
    headers: Object.keys(req.headers)
  });

  // Check for known cron services (more flexible detection)
  const isExternalCron = [
    'cron-job.org',
    'cron-job',
    'cronjob',
    'uptimerobot',
    'github',
    'easycron'
  ].some(service =>
    userAgent.toLowerCase().includes(service) ||
    origin.toLowerCase().includes(service) ||
    referer.toLowerCase().includes(service)
  );

  // Always allow GET and POST methods, plus any external cron service
  if (!allowedMethods.includes(req.method)) {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({
      error: 'Method not allowed',
      method: req.method,
      allowedMethods: allowedMethods
    });
  }
  try {
    // Debug: Log environment variables (safely)
    console.log('🔍 Environment check:', {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasApiToken: !!process.env.AQICN_API_TOKEN,
      userAgent: userAgent
    });

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

    // Debug: Log first station's complete structure
    if (stations.length > 0) {
      console.log('🔍 First station structure:', JSON.stringify(stations[0], null, 2));
      console.log('🔍 First station iaqi:', stations[0].iaqi);
    }

    // 3. Try to store in database (with error handling)
    let storeResult = null;
    try {
      storeResult = await storeHistoricalData(stations);
      console.log('✅ Database storage successful:', storeResult);
    } catch (dbError) {
      console.error('❌ Database storage failed:', dbError.message);
      // Continue without database storage
    }

    const result = {
      success: true,
      stored: stations.length,
      timestamp: new Date().toISOString(),
      message: `Successfully fetched ${stations.length} stations${storeResult ? ' and stored to database' : ' (database storage failed)'}`,
      databaseWorking: !!storeResult,
      storeResult: storeResult
    };

    console.log('✅ Data collection completed:', result);

    return res.status(200).json(result);

  } catch (error) {
    console.error('Data collection error:', error);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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
    try {
      // Check if iaqi exists
      if (!station.iaqi) {
        console.log(`⚠️ Station ${station.uid}: No iaqi data available`);
        return null;
      }

      // Check if specific pollutant exists
      if (!station.iaqi[pollutant]) {
        console.log(`⚠️ Station ${station.uid}: No ${pollutant} data available`);
        return null;
      }

      let value = station.iaqi[pollutant].v;

      if (typeof value === 'object' && value !== null) {
        if (value.value !== undefined) value = value.value;
        else if (value.v !== undefined) value = value.v;
        else {
          console.log(`⚠️ Station ${station.uid}: ${pollutant} has complex object:`, value);
          return null;
        }
      }

      if (value !== undefined && value !== null && value !== '') {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          console.log(`⚠️ Station ${station.uid}: ${pollutant} value is not a number:`, value);
          return null;
        }
        console.log(`✅ Station ${station.uid}: ${pollutant} = ${numValue}`);
        return numValue;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error extracting ${pollutant} from station ${station.uid}:`, error);
      return null;
    }
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

      // Raw data for debugging (store complete station data)
      raw_data: JSON.stringify(stationData)
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