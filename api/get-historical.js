// API endpoint to get 3-hour moving averages from stored data
export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const stationId = url.searchParams.get('station');
    const hours = parseInt(url.searchParams.get('hours')) || 3;

    // Calculate 3-hour moving averages from database
    const movingAverages = await getMovingAverages(stationId, hours);

    return new Response(JSON.stringify(movingAverages), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300' // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error('Historical data error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getMovingAverages(stationId, hours) {
  // Implementation depends on your chosen database
  
  // Use Supabase client:
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('air_quality_readings')
    .select('*')
    .gte('timestamp', hoursAgo)
    .order('timestamp', { ascending: false });

  if (stationId) {
    query = query.eq('station_uid', stationId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Calculate moving averages by station
  const stationAverages = {};
  
  // Group by station
  const stationGroups = data.reduce((acc, reading) => {
    const uid = reading.station_uid;
    if (!acc[uid]) acc[uid] = [];
    acc[uid].push(reading);
    return acc;
  }, {});

  // Calculate averages for each station
  Object.entries(stationGroups).forEach(([uid, readings]) => {
    if (readings.length === 0) return;

    const pollutants = ['pm25', 'no2', 'o3', 'so2', 'pm10', 'co'];
    const averages = {};
    
    pollutants.forEach(pollutant => {
      const validReadings = readings
        .map(r => r[pollutant])
        .filter(v => v > 0);
      
      averages[pollutant] = validReadings.length > 0
        ? validReadings.reduce((sum, val) => sum + val, 0) / validReadings.length
        : 0;
    });

    stationAverages[uid] = {
      station_uid: uid,
      station_name: readings[0].station_name,
      lat: readings[0].lat,
      lon: readings[0].lon,
      averages,
      dataPoints: readings.length,
      timeSpan: hours,
      oldestReading: readings[readings.length - 1].timestamp,
      newestReading: readings[0].timestamp,
      dataQuality: getDataQuality(readings.length, hours)
    };
  });

  return stationAverages;
}

function getDataQuality(dataPoints, timeSpan) {
  const expectedPoints = timeSpan * 6; // 6 readings per hour (every 10 minutes)
  const completeness = dataPoints / expectedPoints;
  
  if (completeness >= 0.9) return 'excellent';
  if (completeness >= 0.7) return 'good';
  if (completeness >= 0.5) return 'fair';
  return 'limited';
}