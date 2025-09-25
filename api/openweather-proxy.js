// OpenWeather API Proxy - hides API keys from client
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
    const { lat, lon } = req.query;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'API key not configured',
        message: 'OPENWEATHER_API_KEY environment variable is required'
      });
    }

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'lat and lon query parameters are required'
      });
    }

    const apiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    console.log(`🌤️ Proxying OpenWeather API request: ${lat},${lon}`);

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ OpenWeather API Error:', data);
      return res.status(response.status).json({
        error: 'OpenWeather API Error',
        details: data,
        timestamp: new Date().toISOString()
      });
    }

    // Add metadata to response
    const responseData = {
      ...data,
      _proxy: {
        coordinates: { lat: parseFloat(lat), lon: parseFloat(lon) },
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