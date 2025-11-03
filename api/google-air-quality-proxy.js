// Google Air Quality API Proxy - hides API keys from client
export default async function handler(req, res) {
  // Set CORS headers for client-side requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { lat, lng } = req.query;
    const apiKey = process.env.GOOGLE_AIR_QUALITY_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API key not configured",
        message: "GOOGLE_AIR_QUALITY_API_KEY environment variable is required",
      });
    }

    if (!lat || !lng) {
      return res.status(400).json({
        error: "Invalid parameters",
        message: "lat and lng query parameters are required",
      });
    }

    // Google Air Quality API endpoint
    const apiUrl = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${apiKey}`;

    console.log(
      `🌐 Proxying Google Air Quality API request: lat=${lat}, lng=${lng}`,
    );

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        location: {
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        },
        extraComputations: [
          "HEALTH_RECOMMENDATIONS",
          "DOMINANT_POLLUTANT_CONCENTRATION",
          "POLLUTANT_CONCENTRATION",
          "LOCAL_AQI",
          "POLLUTANT_ADDITIONAL_INFO",
        ],
        languageCode: "en",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Google Air Quality API Error:", data);
      return res.status(response.status).json({
        error: "Google Air Quality API Error",
        details: data,
        timestamp: new Date().toISOString(),
      });
    }

    // Add metadata to response
    const responseData = {
      ...data,
      _proxy: {
        source: "google",
        timestamp: new Date().toISOString(),
        cached: false,
        location: { lat, lng },
      },
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("❌ Proxy Error:", error);
    return res.status(500).json({
      error: "Proxy server error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
