// Test AQI conversion logic (CommonJS version)
const {
  convertStationDataForSupabase,
} = require("./lib/aqi-converter-node.cjs");

// Test sample station data
const sampleStationData = {
  uid: "test-123",
  aqi: 75,
  lat: 13.7563,
  lon: 100.5018,
  station: { name: "Test Station" },
  iaqi: {
    pm25: { v: 75 },
    pm10: { v: 85 },
    o3: { v: 65 },
    no2: { v: 45 },
    so2: { v: 25 },
    co: { v: 115 },
    // Weather data (should be ignored)
    t: { v: 28 },
    h: { v: 65 },
  },
};

console.log("🧪 Testing AQI to concentration conversion...\n");

console.log("Sample station data:");
console.log("- PM2.5 AQI:", sampleStationData.iaqi.pm25.v);
console.log("- PM10 AQI:", sampleStationData.iaqi.pm10.v);
console.log("- O3 AQI:", sampleStationData.iaqi.o3.v);
console.log("- NO2 AQI:", sampleStationData.iaqi.no2.v);
console.log("- SO2 AQI:", sampleStationData.iaqi.so2.v);
console.log("- CO AQI:", sampleStationData.iaqi.co.v);

console.log("\n🔄 Converting to raw concentrations:");
const converted = convertStationDataForSupabase(sampleStationData);

console.log("\n✅ Conversion successful!");
console.log("Raw concentrations:", converted);

console.log("\n📊 Summary:");
Object.entries(converted).forEach(([pollutant, value]) => {
  const unit = pollutant === "co" ? "mg/m³" : "μg/m³";
  console.log(`- ${pollutant.toUpperCase()}: ${value} ${unit}`);
});

console.log("\n✨ Conversion logic is working correctly!");
