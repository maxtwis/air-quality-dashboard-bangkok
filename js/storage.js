// Air Quality Data Storage Service
let AirQualityDB = null;

// Function to load Supabase module
async function loadSupabase() {
  try {
    const supabaseModule = await import("../lib/supabase.js");
    AirQualityDB = supabaseModule.AirQualityDB;
    return true;
  } catch (error) {
    console.warn(
      "⚠️ Supabase module not available, storage disabled:",
      error.message,
    );
    return false;
  }
}

export class AirQualityStorage {
  constructor() {
    this.isEnabled = false;
    this.lastStorageTime = null;
    this.storageInterval = 10 * 60 * 1000; // Store data every 10 minutes
    this.init();
  }

  async init() {
    try {
      // Try to load Supabase module
      const supabaseLoaded = await loadSupabase();
      if (!supabaseLoaded || !AirQualityDB) {
        console.warn("⚠️ Storage service disabled - Supabase not available");
        this.isEnabled = false;
        return;
      }

      // Test database connection
      this.isEnabled = await AirQualityDB.testConnection();
      if (this.isEnabled) {
        console.log("✅ Storage service initialized successfully");

        // Get and log database stats
        const stats = await AirQualityDB.getDBStats();
        if (stats) {
          console.log("📊 Database stats:", stats);
        }
      } else {
        console.warn(
          "⚠️ Storage service disabled - database connection failed",
        );
      }
    } catch (error) {
      console.error("❌ Storage service initialization failed:", error);
      this.isEnabled = false;
    }
  }

  /**
   * Store air quality data from API response
   */
  async storeStationData(stations) {
    if (!this.isEnabled) {
      return false;
    }

    // Check if we should store data (rate limiting)
    const now = Date.now();
    if (
      this.lastStorageTime &&
      now - this.lastStorageTime < this.storageInterval
    ) {
      console.log("⏳ Skipping storage - too soon since last save");
      return false;
    }

    try {
      const timestamp = new Date().toISOString();
      const readings = [];
      const stationsToStore = [];

      for (const station of stations) {
        // Prepare station data
        const stationData = {
          station_uid: station.uid?.toString(),
          name: station.station?.name || "Unknown Station",
          latitude: station.lat,
          longitude: station.lon,
          city: station.station?.geo?.[1] || "Bangkok",
          country: station.station?.geo?.[0] || "Thailand",
          url: station.station?.url,
          is_active: true,
        };

        // Skip if essential data is missing
        if (
          !stationData.station_uid ||
          !stationData.latitude ||
          !stationData.longitude
        ) {
          console.warn(
            "⚠️ Skipping station with missing essential data:",
            station,
          );
          continue;
        }

        stationsToStore.push(stationData);

        // Debug: Log the first station's data structure
        if (readings.length === 0) {
          console.log("🔍 Sample station data structure:", {
            uid: station.uid,
            aqi: station.aqi,
            iaqi: station.iaqi,
            station: station.station,
          });
        }

        // Prepare reading data
        const reading = {
          station_uid: stationData.station_uid,
          timestamp: timestamp,
          aqi: typeof station.aqi === "number" ? station.aqi : null,

          // Pollutant data (extract from iaqi object)
          pm25: this.extractPollutantValue(station, "pm25"),
          pm10: this.extractPollutantValue(station, "pm10"),
          o3: this.extractPollutantValue(station, "o3"),
          no2: this.extractPollutantValue(station, "no2"),
          so2: this.extractPollutantValue(station, "so2"),
          co: this.extractPollutantValue(station, "co"),

          // Weather data
          temperature: this.extractPollutantValue(station, "t"),
          humidity: this.extractPollutantValue(station, "h"),
          pressure: this.extractPollutantValue(station, "p"),
          wind_speed: this.extractPollutantValue(station, "w"),
          wind_direction: this.extractPollutantValue(station, "wd"),

          // Store AQHI if calculated
          aqhi: typeof station.aqhi === "number" ? station.aqhi : null,

          // Store raw data for debugging (limit size)
          raw_data: JSON.stringify({
            uid: station.uid,
            aqi: station.aqi,
            lat: station.lat,
            lon: station.lon,
            iaqi: station.iaqi,
            time: station.time,
          }),
        };

        // Validate reading before adding
        if (reading.station_uid && reading.timestamp) {
          readings.push(reading);
        } else {
          console.warn("⚠️ Skipping invalid reading:", reading);
        }
      }

      // Store stations first (with upsert logic)
      await this.upsertStations(stationsToStore);

      // Store readings
      if (readings.length > 0) {
        await AirQualityDB.insertReadings(readings);
        this.lastStorageTime = now;
        console.log(`✅ Stored ${readings.length} air quality readings`);

        // Cleanup old data occasionally (every 10th storage)
        if (Math.random() < 0.1) {
          setTimeout(() => this.cleanupOldData(), 1000);
        }

        return true;
      } else {
        console.warn("⚠️ No valid readings to store");
        return false;
      }
    } catch (error) {
      console.error("❌ Error storing air quality data:", error);
      return false;
    }
  }

  /**
   * Extract pollutant value from station data
   */
  extractPollutantValue(station, pollutant) {
    try {
      let value = station.iaqi?.[pollutant]?.v;

      // Handle case where value might be an object
      if (typeof value === "object" && value !== null) {
        if (value.value !== undefined) {
          value = value.value;
        } else if (value.v !== undefined) {
          value = value.v;
        } else {
          // If it's an object we can't parse, return null
          return null;
        }
      }

      // Convert to number
      if (value !== undefined && value !== null && value !== "") {
        const numValue = parseFloat(value);
        return isNaN(numValue) ? null : numValue;
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ Error extracting ${pollutant}:`, error);
      return null;
    }
  }

  /**
   * Upsert stations (insert or update)
   */
  async upsertStations(stations) {
    if (!stations.length) return;

    try {
      // Use Supabase upsert functionality
      const { data, error } = await AirQualityDB.supabase
        .from("stations")
        .upsert(stations, {
          onConflict: "station_uid",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("Error upserting stations:", error);
      } else {
        console.log(`✅ Upserted ${stations.length} stations`);
      }
    } catch (error) {
      console.error("Error in upsert operation:", error);
    }
  }

  /**
   * Get 3-hour averages for AQHI calculation
   */
  async get3HourAverages(stationId = null) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      return await AirQualityDB.get3HourAverages(stationId);
    } catch (error) {
      console.error("Error fetching 3-hour averages:", error);
      return null;
    }
  }

  /**
   * Get recent readings for a station
   */
  async getStationHistory(stationId, hours = 24) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      return await AirQualityDB.getStationReadings(stationId, hours);
    } catch (error) {
      console.error("Error fetching station history:", error);
      return null;
    }
  }

  /**
   * Calculate AQHI using 3-hour moving average
   */
  async calculateAQHIFromStorage(stationId) {
    if (!this.isEnabled) {
      return null;
    }

    try {
      const averages = await this.get3HourAverages(stationId);
      if (!averages || averages.length === 0) {
        return null;
      }

      const stationAvg = averages[0];

      // AQHI calculation using Health Canada formula
      // AQHI = (10/10.4) * 100 * [(exp(0.000871 * O3) - 1) + (exp(0.000537 * NO2) - 1) + (exp(0.000487 * PM2.5) - 1)]

      let aqhi = 0;

      if (stationAvg.avg_pm25) {
        aqhi += Math.exp(0.000487 * stationAvg.avg_pm25) - 1;
      }

      if (stationAvg.avg_o3) {
        aqhi += Math.exp(0.000871 * stationAvg.avg_o3) - 1;
      }

      if (stationAvg.avg_no2) {
        aqhi += Math.exp(0.000537 * stationAvg.avg_no2) - 1;
      }

      aqhi = (10.0 / 10.4) * 100 * aqhi;

      return Math.max(1, Math.round(aqhi)); // Round to whole number, minimum 1
    } catch (error) {
      console.error("Error calculating AQHI from storage:", error);
      return null;
    }
  }

  /**
   * Cleanup old data
   */
  async cleanupOldData() {
    if (!this.isEnabled) {
      return;
    }

    try {
      await AirQualityDB.cleanupOldData();
    } catch (error) {
      console.error("Error cleaning up old data:", error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    if (!this.isEnabled) {
      return null;
    }

    return await AirQualityDB.getDBStats();
  }

  /**
   * Check if storage is working
   */
  isStorageEnabled() {
    return this.isEnabled;
  }
}

// Create singleton instance
export const airQualityStorage = new AirQualityStorage();
