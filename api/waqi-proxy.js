// WAQI API Proxy - hides API keys from client
export default async function handler(req, res) {
  // Set CORS headers for client-side requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint, uid } = req.query;
    const apiToken = process.env.WAQI_API_TOKEN || process.env.AQICN_API_TOKEN;

    if (!apiToken) {
      return res.status(500).json({
        error: 'API token not configured',
        message: 'WAQI_API_TOKEN environment variable is required'
      });
    }

    let apiUrl;

    if (endpoint === 'bounds') {
      // Bangkok bounds endpoint
      apiUrl = `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&networks=all&token=${apiToken}`;
    } else if (endpoint === 'station' && uid) {
      // Individual station endpoint
      apiUrl = `https://api.waqi.info/feed/@${uid}/?token=${apiToken}`;
    } else {
      return res.status(400).json({
        error: 'Invalid endpoint',
        message: 'Use endpoint=bounds or endpoint=station&uid=STATION_ID'
      });
    }

    console.log(`🌐 Proxying WAQI API request: ${endpoint}${uid ? ` (station ${uid})` : ''}`);

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== 'ok') {
      console.error('❌ WAQI API Error:', data);
      return res.status(500).json({
        error: 'WAQI API Error',
        details: data,
        timestamp: new Date().toISOString()
      });
    }

    // Add metadata to response
    const responseData = {
      ...data,
      _proxy: {
        endpoint,
        timestamp: new Date().toISOString(),
        cached: false
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Proxy Error:', error);
    return res.status(500).json({
      error: 'Proxy server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}