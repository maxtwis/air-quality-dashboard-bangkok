// Browser-compatible AQHI calculation using Supabase data
import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js";

// Thai AQHI Parameters (Based on OPD/Morbidity from Thai Health Department)
const THAI_AQHI_PARAMS = {
  C: 105.19, // Scaling factor (Maximum MWEC for PM2.5 AQHI/OPD)
  beta: {
    pm25: 0.0022, // Beta coefficient for PM2.5 (µg/m³)
    pm10: 0.0009, // Beta coefficient for PM10 (µg/m³)
    o3: 0.001, // Beta coefficient for O3 (ppb)
    no2: 0.003, // Beta coefficient for NO2 (ppb)
  },
};

// Thai AQHI Categories
export const AQHI_LEVELS = {
  LOW: {
    min: 0,
    max: 3.9,
    color: "#10b981",
    label: "Low",
    description: "Ideal air quality for outdoor activities",
  },
  MODERATE: {
    min: 4,
    max: 6.9,
    color: "#f59e0b",
    label: "Moderate",
    description:
      "No need to modify outdoor activities unless experiencing symptoms",
  },
  HIGH: {
    min: 7,
    max: 10.9,
    color: "#ef4444",
    label: "High",
    description:
      "Consider reducing or rescheduling strenuous outdoor activities",
  },
  VERY_HIGH: {
    min: 11,
    max: Infinity,
    color: "#7f1d1d",
    label: "Very High",
    description: "Reduce or reschedule strenuous outdoor activities",
  },
};

/**
 * Calculate Thai AQHI using official Thai Health Department formula
 */
export function calculateThaiAQHI(pm25, no2, o3, pm10 = null) {
  console.log(
    `🧮 Calculating Thai AQHI with concentrations: PM2.5=${pm25}μg/m³, PM10=${pm10}μg/m³, NO2=${no2}ppb, O3=${o3}ppb`,
  );

  // Calculate Percentage Excess Risk (%ER) for each pollutant
  // Formula: %ER_i = 100 * (exp(beta_i * x_i) - 1)
  const perErPM25 = pm25
    ? 100 * (Math.exp(THAI_AQHI_PARAMS.beta.pm25 * pm25) - 1)
    : 0;
  const perErPM10 = pm10
    ? 100 * (Math.exp(THAI_AQHI_PARAMS.beta.pm10 * pm10) - 1)
    : 0;
  const perErO3 = o3 ? 100 * (Math.exp(THAI_AQHI_PARAMS.beta.o3 * o3) - 1) : 0;
  const perErNO2 = no2
    ? 100 * (Math.exp(THAI_AQHI_PARAMS.beta.no2 * no2) - 1)
    : 0;

  // Calculate Total Percentage Excess Risk (Sum of all %ER)
  const totalPerER = perErPM25 + perErPM10 + perErO3 + perErNO2;

  // Calculate AQHI: AQHI = (10 / C) * Total %ER
  const aqhi = (10 / THAI_AQHI_PARAMS.C) * totalPerER;

  console.log(
    `📊 Thai AQHI %ER: PM2.5=${perErPM25.toFixed(4)}%, PM10=${perErPM10.toFixed(4)}%, NO2=${perErNO2.toFixed(4)}%, O3=${perErO3.toFixed(4)}%, Total=${totalPerER.toFixed(4)}% → AQHI=${Math.round(aqhi)}`,
  );

  return Math.max(1, Math.round(aqhi));
}

/**
 * Get Thai AQHI level information
 */
export function getAQHILevel(aqhi) {
  if (aqhi === null || aqhi === undefined || isNaN(aqhi)) {
    return { ...AQHI_LEVELS.LOW, key: "LOW", label: "No Data" };
  }
  for (const [key, level] of Object.entries(AQHI_LEVELS)) {
    if (aqhi >= level.min && aqhi <= level.max) {
      return { ...level, key };
    }
  }
  return { ...AQHI_LEVELS.VERY_HIGH, key: "VERY_HIGH" };
}

/**
 * Calculate AQHI from station data (converts AQI to concentrations in proper units first)
 */
export async function calculateStationAQHI(station) {
  const { convertStationToRawConcentrations, getConcentrationForAQHI } =
    await import("./aqi-to-concentration.js");
  const stationWithConcentrations = convertStationToRawConcentrations(station);

  // Get concentrations in AQHI-required units: PM2.5 in μg/m³, O3 and NO2 in ppb
  const pm25 = getConcentrationForAQHI(stationWithConcentrations, "pm25") || 0;
  const no2 = getConcentrationForAQHI(stationWithConcentrations, "no2") || 0;
  const o3 = getConcentrationForAQHI(stationWithConcentrations, "o3") || 0;

  return calculateThaiAQHI(pm25, no2, o3);
}

/**
 * Format AQHI for display
 */
export function formatAQHI(aqhi) {
  if (aqhi === null || aqhi === undefined || isNaN(aqhi)) {
    return "N/A";
  }
  return Math.round(aqhi).toString();
}

/**
 * Calculate AQHI statistics for multiple stations
 */
export function calculateAQHIStatistics(stations) {
  if (!stations || stations.length === 0) {
    return null;
  }

  const aqhiValues = [];
  const categoryCounts = {
    LOW: 0,
    MODERATE: 0,
    HIGH: 0,
    VERY_HIGH: 0,
  };

  let stationsWithData = 0;

  stations.forEach((station) => {
    if (station.aqhi && typeof station.aqhi.value === "number") {
      aqhiValues.push(station.aqhi.value);
      categoryCounts[station.aqhi.level.key]++;
      stationsWithData++;
    }
  });

  if (aqhiValues.length === 0) {
    return null;
  }

  const average =
    aqhiValues.reduce((sum, val) => sum + val, 0) / aqhiValues.length;
  const min = Math.min(...aqhiValues);
  const max = Math.max(...aqhiValues);

  return {
    average: Math.round(average),
    min: Math.round(min),
    max: Math.round(max),
    categoryCounts,
    totalStations: stations.length,
    stationsWithData,
    percentComplete: Math.round((stationsWithData / stations.length) * 100),
  };
}

class SupabaseAQHI {
  constructor() {
    this.supabase = null;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.initSupabase();
  }

  initSupabase() {
    try {
      // Use the same credentials as configured in lib/supabase.js
      const supabaseUrl =
        window.SUPABASE_URL || "https://xqvjrovzhupdfwvdikpo.supabase.co";
      const supabaseAnonKey =
        window.SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxdmpyb3Z6aHVwZGZ3dmRpa3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTQyMjMsImV4cCI6MjA3MzUzMDIyM30.rzJ8-LnZh2dITbh7HcIXJ32BQ1MN-F-O5hCmO0jzIDo";

      console.log("🔗 Initializing Supabase connection for AQHI...");

      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      console.log("✅ Supabase AQHI calculator initialized successfully");
    } catch (error) {
      console.error(
        "❌ Supabase AQHI calculator failed to initialize:",
        error.message || error,
      );
      this.supabase = null;
    }
  }

  /**
   * Get 3-hour averages from database (batch query)
   */
  async getBatch3HourAverages(stationIds) {
    if (!this.supabase || !stationIds.length) return {};

    try {
      console.log(
        `🔍 Fetching enhanced 3h averages for ${stationIds.length} stations...`,
      );

      // First try to get enhanced averages using the new database function
      const enhancedAverages = await this.getBatchEnhancedAverages(stationIds);

      if (Object.keys(enhancedAverages).length > 0) {
        console.log(
          `📊 Enhanced averages: ${Object.keys(enhancedAverages).length} stations with mixed data sources`,
        );
        // Also get standard averages for stations not in enhanced results
        const missingStations = stationIds.filter(
          (id) => !enhancedAverages[id],
        );
        if (missingStations.length > 0) {
          console.log(
            `🔄 Getting standard averages for ${missingStations.length} remaining stations...`,
          );
          const standardAverages =
            await this.getBatchStandardAverages(missingStations);
          return { ...enhancedAverages, ...standardAverages };
        }
        return enhancedAverages;
      }

      // Fallback to original method if enhanced function not available
      console.log(
        `⚠️ Enhanced function not available, using fallback method...`,
      );
      return await this.getBatchStandardAverages(stationIds);
    } catch (error) {
      console.error("Error in getBatch3HourAverages:", error);
      // Fallback to standard method
      return await this.getBatchStandardAverages(stationIds);
    }
  }

  /**
   * Get enhanced averages using existing database views (no RPC function needed)
   */
  async getBatchEnhancedAverages(stationIds) {
    const stationAverages = {};

    try {
      // Check if we should use proxy (development mode)
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      let aqicnData, aqicnError;

      if (isDevelopment) {
        // Use proxy endpoint
        try {
          const response = await fetch('/api/supabase/aqhi-averages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationIds })
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          aqicnData = await response.json();
        } catch (error) {
          aqicnError = error;
        }
      } else {
        // Direct Supabase access (production)
        const result = await this.supabase
          .from("combined_3h_averages")
          .select("*")
          .in("station_uid", stationIds);
        aqicnData = result.data;
        aqicnError = result.error;
      }

      if (aqicnError) {
        console.warn("Error fetching AQICN 3h averages:", aqicnError.message);
      }

      // Process AQICN data
      if (aqicnData) {
        aqicnData.forEach((station) => {
          if (station.reading_count > 0) {
            stationAverages[station.station_uid] = {
              pm25: station.avg_pm25,
              pm10: station.avg_pm10,
              o3: station.avg_o3,
              no2: station.avg_no2,
              so2: station.avg_so2,
              co: station.avg_co,
              readingCount: station.reading_count,
              dataSources: "aqicn",
            };
          }
        });
      }

      console.log(
        `📊 Enhanced averages using views: ${Object.keys(stationAverages).length} total stations`,
      );

      return stationAverages;
    } catch (error) {
      console.error("Error in getBatchEnhancedAverages:", error.message);
      return {};
    }
  }

  /**
   * Standard 3-hour averages (uses combined_3h_averages view)
   */
  async getBatchStandardAverages(stationIds) {
    try {
      // Check if we should use proxy (development mode)
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      let data, error;

      if (isDevelopment) {
        // Use proxy endpoint
        try {
          const response = await fetch('/api/supabase/aqhi-averages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationIds })
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          data = await response.json();
        } catch (err) {
          error = err;
        }
      } else {
        // Direct Supabase access (production)
        const result = await this.supabase
          .from("combined_3h_averages")
          .select("*")
          .in("station_uid", stationIds);
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Error fetching standard 3h averages:", error.message);
        return {};
      }

      if (!data || data.length === 0) {
        console.log(`ℹ️ No 3h average data for ${stationIds.length} stations`);
        return {};
      }

      // Convert view data to expected format (already averaged)
      const stationAverages = {};
      data.forEach((station) => {
        if (station.waqi_readings >= 1) {
          stationAverages[station.station_uid] = {
            pm25: station.avg_pm25,
            pm10: station.avg_pm10,
            o3: station.avg_o3,
            no2: station.avg_no2,
            so2: station.avg_so2,
            co: station.avg_co,
            readingCount:
              station.waqi_readings + (station.google_readings || 0),
            dataQuality: station.data_quality,
            dataSources: "combined_waqi_google",
          };
        }
      });

      console.log(
        `📊 Standard batch processed ${Object.keys(stationAverages).length}/${stationIds.length} stations with data`,
      );
      return stationAverages;
    } catch (error) {
      console.error("Error in getBatchStandardAverages:", error.message);
      return {};
    }
  }

  /**
   * Get latest single readings for a station (WAQI + Google merged)
   * Used as fallback when 3-hour averages not available yet
   */
  async getLatestReadings(stationId) {
    if (!this.supabase) return null;

    try {
      // Get latest WAQI reading
      const { data: waqiData, error: waqiError } = await this.supabase
        .from("waqi_data")
        .select("pm25, pm10, so2, co, o3, no2")
        .eq("station_uid", stationId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      // Get latest Google supplement
      const { data: googleData, error: googleError } = await this.supabase
        .from("google_supplements")
        .select("o3, no2")
        .eq("station_uid", stationId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      // Merge data: Google supplements override WAQI for O3/NO2
      return {
        pm25: waqiData?.pm25 || null,
        pm10: waqiData?.pm10 || null,
        so2: waqiData?.so2 || null,
        co: waqiData?.co || null,
        o3: googleData?.o3 || waqiData?.o3 || null,
        no2: googleData?.no2 || waqiData?.no2 || null,
      };
    } catch (error) {
      console.warn(
        `Error fetching latest readings for station ${stationId}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Get 3-hour averages for a single station (fallback)
   */
  async get3HourAverages(stationId) {
    if (!this.supabase) return null;

    try {
      // Check if we should use proxy (development mode)
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      let aqicnData, aqicnError;

      if (isDevelopment) {
        // Use proxy endpoint
        try {
          const response = await fetch(`/api/supabase/aqhi-average/${stationId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const dataArray = await response.json();
          aqicnData = dataArray && dataArray.length > 0 ? dataArray[0] : null;
        } catch (err) {
          aqicnError = err;
        }
      } else {
        // Direct Supabase access (production)
        const result = await this.supabase
          .from("combined_3h_averages")
          .select("*")
          .eq("station_uid", stationId)
          .single();
        aqicnData = result.data;
        aqicnError = result.error;
      }

      if (aqicnError && aqicnError.code !== "PGRST116") {
        console.warn(
          `Error fetching AQICN 3h averages for detail panel ${stationId}:`,
          aqicnError.message,
        );
      }

      // Use combined WAQI+Google data
      if (aqicnData) {
        const averages = {
          pm25: aqicnData?.avg_pm25 || null,
          pm10: aqicnData?.avg_pm10 || null,
          o3: aqicnData?.avg_o3 || null,
          no2: aqicnData?.avg_no2 || null,
          so2: aqicnData?.avg_so2 || null,
          co: aqicnData?.avg_co || null,
          readingCount: aqicnData?.waqi_readings || 1,
          googleReadings: aqicnData?.google_readings || 0,
          o3_source: aqicnData?.o3_source || "WAQI",
          no2_source: aqicnData?.no2_source || "WAQI",
          source: "combined-3h-average",
        };

        // Only return if we have meaningful pollutant data
        if (averages.pm25 > 0 || averages.no2 > 0 || averages.o3 > 0) {
          return averages;
        }
      }

      return null;
    } catch (error) {
      console.error("Error in get3HourAverages:", error);
      return null;
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
   * Calculate AQHI using 3-hour averages
   */
  async calculateAQHI(station) {
    const stationId = station.uid?.toString();
    if (!stationId) {
      const fallbackAQHI = await calculateStationAQHI(station);
      const aqhiLevel = getAQHILevel(fallbackAQHI);
      return {
        value: fallbackAQHI,
        level: aqhiLevel,
      };
    }

    // Check cache
    const cacheKey = `aqhi_${stationId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      const aqhiLevel = getAQHILevel(cached.value);
      return {
        value: cached.value,
        level: aqhiLevel,
      };
    }

    try {
      // Get 3-hour averages
      const averages = await this.get3HourAverages(stationId);

      if (averages && (averages.pm25 || averages.o3 || averages.no2)) {
        // Calculate AQHI using Thai Health Department formula
        // Formula: %ER_i = 100 * (exp(beta_i * x_i) - 1)
        // AQHI = (10 / C) * Total %ER

        let perErPM25 = 0;
        let perErO3 = 0;
        let perErNO2 = 0;

        if (averages.pm25) {
          perErPM25 = 100 * (Math.exp(0.0012 * averages.pm25) - 1);
        }

        if (averages.o3) {
          perErO3 = 100 * (Math.exp(0.001 * averages.o3) - 1);
        }

        if (averages.no2) {
          perErNO2 = 100 * (Math.exp(0.0052 * averages.no2) - 1);
        }

        const totalPerER = perErPM25 + perErO3 + perErNO2;
        let aqhi = (10.0 / 105.19) * totalPerER;
        aqhi = Math.max(1, Math.round(aqhi)); // Round to whole number, minimum 1

        // Cache the result
        this.cache.set(cacheKey, {
          value: aqhi,
          timestamp: Date.now(),
          source: "stored_3h_avg",
          readingCount: averages.readingCount,
        });

        console.log(
          `🔄 AQHI from 3h avg for ${stationId}: ${aqhi} (${averages.readingCount} readings)`,
        );
        const aqhiLevel = getAQHILevel(aqhi);
        return {
          value: aqhi,
          level: aqhiLevel,
        };
      }
    } catch (error) {
      console.warn(`⚠️ Error calculating stored AQHI for ${stationId}:`, error);
    }

    // Fallback to realistic calculation
    const fallbackAQHI = await calculateStationAQHI(station);

    // Cache fallback result for shorter time
    this.cache.set(cacheKey, {
      value: fallbackAQHI,
      timestamp: Date.now(),
      source: "fallback",
      readingCount: 0,
    });

    const aqhiLevel = getAQHILevel(fallbackAQHI);
    return {
      value: fallbackAQHI,
      level: aqhiLevel,
    };
  }

  /**
   * Process multiple stations with optimized batch database queries
   */
  async enhanceStationsWithAQHI(stations) {
    console.log(
      `🔄 Processing ${stations.length} stations with batch optimization...`,
    );

    if (!this.supabase) {
      console.error(
        "❌ Supabase not initialized - falling back to realistic AQHI calculations",
      );
      // Fallback to realistic calculations
      return Promise.all(
        stations.map(async (station) => {
          const aqhiValue = await calculateStationAQHI(station);
          return {
            ...station,
            aqhi: {
              value: aqhiValue,
              level: getAQHILevel(aqhiValue),
              calculationMethod: "fallback_no_db",
              readingCount: 0,
              dataQuality: "estimated",
              dataSources: "fallback",
            },
          };
        }),
      );
    }

    const startTime = Date.now();

    try {
      // Extract all station IDs for batch query
      const stationIds = stations
        .map((station) => station.uid?.toString())
        .filter((id) => id);

      console.log(
        `🔍 Fetching batch data for ${stationIds.length} stations...`,
      );

      // Fetch all 3-hour averages in one batch query
      const batchAverages = await this.getBatch3HourAverages(stationIds);

      console.log(
        `📊 Got batch averages for ${Object.keys(batchAverages).length} stations`,
      );

      // Process all stations in parallel with pre-fetched data
      const enhancedStations = await Promise.all(
        stations.map(async (station) => {
          const stationId = station.uid?.toString();
          const averages = stationId ? batchAverages[stationId] : null;

          let aqhiValue;
          if (averages && (averages.pm25 || averages.o3 || averages.no2)) {
            // Calculate AQHI using Thai Health Department formula
            // Formula: %ER_i = 100 * (exp(beta_i * x_i) - 1)
            let perErPM25 = 0;
            let perErO3 = 0;
            let perErNO2 = 0;

            if (averages.pm25) {
              perErPM25 = 100 * (Math.exp(0.0012 * averages.pm25) - 1);
            }
            if (averages.o3) {
              perErO3 = 100 * (Math.exp(0.001 * averages.o3) - 1);
            }
            if (averages.no2) {
              perErNO2 = 100 * (Math.exp(0.0052 * averages.no2) - 1);
            }

            const totalPerER = perErPM25 + perErO3 + perErNO2;
            aqhiValue = (10.0 / 105.19) * totalPerER;
            aqhiValue = Math.max(1, Math.round(aqhiValue));

            // Cache the result
            if (stationId) {
              this.cache.set(`aqhi_${stationId}`, {
                value: aqhiValue,
                timestamp: Date.now(),
                source: "batch_stored_3h_avg",
                readingCount: averages.readingCount,
              });
            }
          } else {
            // Fallback: Use latest single readings from database (not 3h average yet)
            const latestData = await this.getLatestReadings(stationId);

            if (
              latestData &&
              (latestData.pm25 || latestData.o3 || latestData.no2)
            ) {
              // Calculate AQHI using latest single reading
              let perErPM25 = 0;
              let perErO3 = 0;
              let perErNO2 = 0;

              if (latestData.pm25) {
                perErPM25 = 100 * (Math.exp(0.0012 * latestData.pm25) - 1);
              }
              if (latestData.o3) {
                perErO3 = 100 * (Math.exp(0.001 * latestData.o3) - 1);
              }
              if (latestData.no2) {
                perErNO2 = 100 * (Math.exp(0.0052 * latestData.no2) - 1);
              }

              const totalPerER = perErPM25 + perErO3 + perErNO2;
              aqhiValue = (10.0 / 105.19) * totalPerER;
              aqhiValue = Math.max(1, Math.round(aqhiValue));

              if (stationId) {
                this.cache.set(`aqhi_${stationId}`, {
                  value: aqhiValue,
                  timestamp: Date.now(),
                  source: "latest_single_reading",
                  readingCount: 1,
                });
              }
            } else {
              // No data available at all - return null
              aqhiValue = null;
              console.warn(`⚠️ No data available for station ${stationId}`);
            }
          }

          // Create proper AQHI object with value and level information
          const aqhiLevel = getAQHILevel(aqhiValue);
          const cachedData = stationId
            ? this.cache.get(`aqhi_${stationId}`)
            : null;
          const aqhiData = {
            value: aqhiValue,
            level: aqhiLevel,
            calculationMethod: cachedData?.source || "unknown",
            readingCount: cachedData?.readingCount || 0,
            dataQuality: this.getDataQualityFromSource(
              cachedData?.source,
              cachedData?.readingCount,
              averages?.dataSources || "station",
            ),
            dataSources: averages?.dataSources || "station",
          };

          return {
            ...station,
            aqhi: aqhiData,
          };
        }),
      );

      const duration = Date.now() - startTime;
      const storedCount = Object.keys(batchAverages).length;
      console.log(
        `✅ Enhanced ${enhancedStations.length} stations (${storedCount} from stored data) in ${duration}ms`,
      );
      return enhancedStations;
    } catch (error) {
      console.error(
        "❌ Error during AQHI enhancement:",
        error.message || error,
      );
      // Return stations with fallback AQHI calculations
      const fallbackStations = await Promise.all(
        stations.map(async (station) => {
          const aqhiValue = await calculateStationAQHI(station);
          return {
            ...station,
            aqhi: {
              value: aqhiValue,
              level: getAQHILevel(aqhiValue),
              calculationMethod: "fallback_error",
              readingCount: 0,
              dataQuality: "estimated",
              dataSources: "fallback",
            },
          };
        }),
      );

      const duration = Date.now() - startTime;
      console.log(
        `⚠️ Fallback AQHI calculations completed for ${fallbackStations.length} stations in ${duration}ms`,
      );
      return fallbackStations;
    }
  }

  /**
   * Get data quality level based on cache source and reading count
   * @param {string} source - Cache source type
   * @param {number} readingCount - Number of readings used
   * @returns {string} Data quality level
   */
  getDataQualityFromSource(source, readingCount = 0) {
    switch (source) {
      case "batch_stored_3h_avg":
        if (readingCount >= 15) return "excellent";
        if (readingCount >= 10) return "good";
        if (readingCount >= 5) return "fair";
        return "limited";
      case "fallback":
        return "estimated";
      default:
        return "unknown";
    }
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
      if (
        value.source === "stored_3h_avg" ||
        value.source === "batch_stored_3h_avg"
      ) {
        stats.storedCalculations++;
      } else {
        stats.fallbackCalculations++;
      }
    }

    return stats;
  }
}

// Create singleton instance
export const supabaseAQHI = new SupabaseAQHI();
