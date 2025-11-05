// PM2.5-only AQHI calculation using Supabase data
// This module tests the hypothesis of what happens when NO2 and O3 are set to 0
import { supabase } from "../lib/supabase.js";
import { getAQHILevel, calculateThaiAQHI } from "./aqhi-supabase.js";

class PM25OnlySupabaseAQHI {
  constructor() {
    this.supabase = null;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.initSupabase();
  }

  initSupabase() {
    try {
      // Use shared Supabase client from lib/supabase.js
      this.supabase = supabase;
    } catch (error) {
      this.supabase = null;
    }
  }

  /**
   * Get 3-hour averages for multiple stations at once (batch query)
   * Only retrieves PM2.5 data for PM2.5-only AQHI calculation
   * Uses waqi_data table (new schema)
   */
  async getBatch3HourAverages(stationIds) {
    if (!this.supabase || !stationIds.length) return {};

    try {
      const { data, error } = await this.supabase
        .from("waqi_data")
        .select("station_uid, pm25, timestamp")
        .in("station_uid", stationIds)
        .gte(
          "timestamp",
          new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        )
        .order("timestamp", { ascending: false });

      if (error) {
        return {};
      }

      if (!data || data.length === 0) {
        return {};
      }

      // Group by station and calculate averages
      const stationAverages = {};
      const groupedData = data.reduce((acc, reading) => {
        if (!acc[reading.station_uid]) acc[reading.station_uid] = [];
        acc[reading.station_uid].push(reading);
        return acc;
      }, {});

      Object.entries(groupedData).forEach(([stationId, readings]) => {
        const validReadings = readings.filter(
          (reading) => reading.pm25 !== null,
        );

        if (validReadings.length > 0) {
          stationAverages[stationId] = {
            pm25: this.calculateAverage(validReadings, "pm25"),
            // Force NO2 and O3 to 0 for hypothesis testing
            no2: 0,
            o3: 0,
            readingCount: validReadings.length,
          };
        }
      });
      return stationAverages;
    } catch (error) {
      return {};
    }
  }

  calculateAverage(readings, pollutant) {
    const values = readings
      .map((r) => r[pollutant])
      .filter((v) => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Calculate PM2.5-only AQHI using 3-hour averages
   * NO2 and O3 are forced to 0 for hypothesis testing
   */
  async calculatePM25OnlyAQHI(station) {
    const stationId = station.uid?.toString();
    if (!stationId) {
      // Fallback using only PM2.5 from current reading
      const pm25 = station.pm25 || 0;
      const aqhiValue = this.calculateAQHIFromPM25Only(pm25);
      const aqhiLevel = getAQHILevel(aqhiValue);
      return {
        value: aqhiValue,
        level: aqhiLevel,
      };
    }

    // Check cache
    const cacheKey = `pm25_aqhi_${stationId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      const aqhiLevel = getAQHILevel(cached.value);
      return {
        value: cached.value,
        level: aqhiLevel,
      };
    }

    try {
      // Get 3-hour averages (PM2.5 only)
      const averages = await this.get3HourPM25Averages(stationId);

      if (averages && averages.pm25) {
        // Calculate AQHI using only PM2.5 (NO2 and O3 forced to 0)
        const aqhiValue = this.calculateAQHIFromPM25Only(averages.pm25);

        // Cache the result
        this.cache.set(cacheKey, {
          value: aqhiValue,
          timestamp: Date.now(),
          source: "stored_3h_avg_pm25_only",
          readingCount: averages.readingCount,
        });
        const aqhiLevel = getAQHILevel(aqhiValue);
        return {
          value: aqhiValue,
          level: aqhiLevel,
        };
      }
    } catch (error) {
    }

    // Fallback to current reading
    const pm25 = station.pm25 || 0;
    const fallbackAQHI = this.calculateAQHIFromPM25Only(pm25);

    // Cache fallback result for shorter time
    this.cache.set(cacheKey, {
      value: fallbackAQHI,
      timestamp: Date.now(),
      source: "fallback_pm25_only",
      readingCount: 0,
    });

    const aqhiLevel = getAQHILevel(fallbackAQHI);
    return {
      value: fallbackAQHI,
      level: aqhiLevel,
    };
  }

  /**
   * Calculate AQHI using only PM2.5 (Thai formula with NO2=0, O3=0)
   */
  calculateAQHIFromPM25Only(pm25) {
    // Use the same Thai AQHI calculation but with NO2 and O3 set to 0
    return calculateThaiAQHI(pm25, 0, 0);
  }

  /**
   * Get 3-hour PM2.5 averages for a single station
   */
  async get3HourPM25Averages(stationId) {
    if (!this.supabase) return null;

    try {
      // Use combined_3h_averages view (WAQI+Google merged)
      const { data: aqicnData, error: aqicnError } = await this.supabase
        .from("combined_3h_averages")
        .select("avg_pm25, reading_count")
        .eq("station_uid", stationId)
        .single();

      if (aqicnError && aqicnError.code !== "PGRST116") {
      }

      // Use AQICN data only
      if (aqicnData?.avg_pm25 > 0) {
        return {
          pm25: aqicnData?.avg_pm25,
          readingCount: aqicnData?.reading_count || 1,
          source: "aqicn-3h-average",
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Process multiple stations with optimized batch database queries
   * Only calculates PM2.5-based AQHI (NO2 and O3 forced to 0)
   */
  async enhanceStationsWithPM25OnlyAQHI(stations) {
    const startTime = Date.now();

    // Extract all station IDs for batch query
    const stationIds = stations
      .map((station) => station.uid?.toString())
      .filter((id) => id);

    // Fetch all 3-hour PM2.5 averages in one batch query
    const batchAverages = await this.getBatch3HourAverages(stationIds);

    // Process all stations in parallel with pre-fetched data
    const enhancedStations = await Promise.all(
      stations.map(async (station) => {
        const stationId = station.uid?.toString();
        const averages = stationId ? batchAverages[stationId] : null;

        let aqhiValue;
        if (averages && averages.pm25) {
          // Calculate AQHI using only PM2.5 (NO2 and O3 forced to 0)
          aqhiValue = this.calculateAQHIFromPM25Only(averages.pm25);

          // Cache the result
          if (stationId) {
            this.cache.set(`pm25_aqhi_${stationId}`, {
              value: aqhiValue,
              timestamp: Date.now(),
              source: "batch_stored_3h_avg_pm25_only",
              readingCount: averages.readingCount,
            });
          }
        } else {
          // Fallback using current PM2.5 reading
          const pm25 = station.pm25 || 0;
          aqhiValue = this.calculateAQHIFromPM25Only(pm25);

          if (stationId) {
            this.cache.set(`pm25_aqhi_${stationId}`, {
              value: aqhiValue,
              timestamp: Date.now(),
              source: "fallback_pm25_only",
              readingCount: 0,
            });
          }
        }

        // Create proper AQHI object with value and level information
        const aqhiLevel = getAQHILevel(aqhiValue);
        const aqhiData = {
          value: aqhiValue,
          level: aqhiLevel,
          // Add data quality information for PM2.5 AQHI
          calculationMethod:
            averages && averages.pm25 ? "stored_3h_avg" : "current",
          readingCount: averages ? averages.readingCount : 0,
          timeSpanHours: averages
            ? Math.min(3, averages.readingCount * 0.17)
            : 0, // Estimate hours based on readings
          dataQuality:
            averages && averages.readingCount >= 15
              ? "excellent"
              : averages && averages.readingCount >= 10
                ? "good"
                : averages && averages.readingCount >= 5
                  ? "fair"
                  : averages && averages.readingCount > 0
                    ? "limited"
                    : "estimated",
        };

        return {
          ...station,
          pm25_aqhi: aqhiData,
        };
      }),
    );

    const duration = Date.now() - startTime;
    const storedCount = Object.keys(batchAverages).length;
    return enhancedStations;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      totalCached: this.cache.size,
      storedCalculations: 0,
      fallbackCalculations: 0,
    };

    for (const [key, value] of this.cache.entries()) {
      if (value.source.includes("stored")) {
        stats.storedCalculations++;
      } else {
        stats.fallbackCalculations++;
      }
    }

    return stats;
  }
}

// Create singleton instance
export const pm25OnlySupabaseAQHI = new PM25OnlySupabaseAQHI();
