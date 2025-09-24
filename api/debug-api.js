// Debug endpoint to examine WAQI API structure
export default async function handler(req, res) {
  try {
    // Fetch data from WAQI API
    const apiToken = "354eb1b871693ef55f777c69e44e81bcaf215d40";
    const apiUrl = `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&token=${apiToken}`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== "ok") {
      return res.status(500).json({ error: "WAQI API Error", details: data });
    }

    const stations = data.data || [];

    // Analyze first 5 stations in detail
    const analysis = stations.slice(0, 5).map((station) => ({
      uid: station.uid,
      aqi: station.aqi,
      hasIaqi: !!station.iaqi,
      iaqiKeys: station.iaqi ? Object.keys(station.iaqi) : [],
      iaqiData: station.iaqi || "No iaqi data",
      stationName: station.station?.name || "Unknown",
      completeStation: station,
    }));

    // Summary statistics
    const summary = {
      totalStations: stations.length,
      stationsWithIaqi: stations.filter((s) => s.iaqi).length,
      stationsWithPM25: stations.filter((s) => s.iaqi?.pm25).length,
      stationsWithO3: stations.filter((s) => s.iaqi?.o3).length,
      stationsWithNO2: stations.filter((s) => s.iaqi?.no2).length,
      commonPollutants: {},
    };

    // Find common pollutants
    const allPollutants = {};
    stations.forEach((station) => {
      if (station.iaqi) {
        Object.keys(station.iaqi).forEach((pollutant) => {
          allPollutants[pollutant] = (allPollutants[pollutant] || 0) + 1;
        });
      }
    });

    summary.commonPollutants = allPollutants;

    return res.status(200).json({
      summary,
      sampleStations: analysis,
      message: "API structure analysis complete",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
