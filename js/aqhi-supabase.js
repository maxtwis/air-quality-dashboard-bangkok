// Browser-compatible AQHI calculation using Supabase data
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js';
import {
  calculateStationAQHIRealistic,
  getAQHILevel,
} from './aqhi-realistic.js';
import { getOpenWeatherFallback } from './openweather-api.js';

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
        window.SUPABASE_URL || 'https://xqvjrovzhupdfwvdikpo.supabase.co';
      const supabaseAnonKey =
        window.SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxdmpyb3Z6aHVwZGZ3dmRpa3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTQyMjMsImV4cCI6MjA3MzUzMDIyM30.rzJ8-LnZh2dITbh7HcIXJ32BQ1MN-F-O5hCmO0jzIDo';

      console.log('🔗 Initializing Supabase connection for AQHI...');

      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      console.log('✅ Supabase AQHI calculator initialized successfully');
    } catch (error) {
      console.error('❌ Supabase AQHI calculator failed to initialize:', error.message || error);
      this.supabase = null;
    }
  }

  /**
   * Get enhanced 3-hour averages including OpenWeather data (batch query)
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
          const standardAverages = await this.getBatchStandardAverages(
            missingStations,
          );
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
      console.error('Error in getBatch3HourAverages:', error);
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
      // Get AQICN data from current_3h_averages view
      const { data: aqicnData, error: aqicnError } = await this.supabase
        .from('current_3h_averages')
        .select('*')
        .in('station_uid', stationIds);

      if (aqicnError) {
        console.warn('Error fetching AQICN 3h averages:', aqicnError.message);
      }

      // Get OpenWeather data from current_openweather_station_3h_averages view
      const { data: openweatherData, error: openweatherError } = await this.supabase
        .from('current_openweather_station_3h_averages')
        .select('*')
        .in('station_uid', stationIds);

      if (openweatherError) {
        console.warn('Error fetching OpenWeather 3h averages:', openweatherError.message);
      }

      // Process AQICN data
      if (aqicnData) {
        aqicnData.forEach(station => {
          if (station.reading_count > 0) {
            stationAverages[station.station_uid] = {
              pm25: station.avg_pm25,
              pm10: station.avg_pm10,
              o3: station.avg_o3,
              no2: station.avg_no2,
              so2: station.avg_so2,
              co: station.avg_co,
              readingCount: station.reading_count,
              dataSources: 'aqicn',
            };
          }
        });
      }

      // Enhance with OpenWeather data where available
      if (openweatherData) {
        openweatherData.forEach(owStation => {
          const stationId = owStation.station_uid;

          if (stationAverages[stationId]) {
            // Merge with existing AQICN data - prefer AQICN PM2.5, supplement with OpenWeather NO2/O3
            const existing = stationAverages[stationId];
            stationAverages[stationId] = {
              pm25: existing.pm25 || owStation.avg_pm25,
              pm10: existing.pm10 || owStation.avg_pm10,
              o3: existing.o3 || owStation.avg_o3,
              no2: existing.no2 || owStation.avg_no2,
              so2: existing.so2 || owStation.avg_so2,
              co: existing.co || owStation.avg_co,
              readingCount: Math.max(existing.readingCount, owStation.reading_count),
              dataSources: 'mixed',
            };
          } else if (owStation.reading_count > 0) {
            // Only OpenWeather data available
            stationAverages[stationId] = {
              pm25: owStation.avg_pm25,
              pm10: owStation.avg_pm10,
              o3: owStation.avg_o3,
              no2: owStation.avg_no2,
              so2: owStation.avg_so2,
              co: owStation.avg_co,
              readingCount: owStation.reading_count,
              dataSources: 'openweather',
            };
          }
        });
      }

      const enhancedCount = Object.values(stationAverages).filter(
        (avg) => avg.dataSources === 'mixed',
      ).length;

      const openweatherOnlyCount = Object.values(stationAverages).filter(
        (avg) => avg.dataSources === 'openweather',
      ).length;

      if (enhancedCount > 0) {
        console.log(
          `🌐 ${enhancedCount} stations enhanced with mixed data sources`,
        );
      }

      if (openweatherOnlyCount > 0) {
        console.log(
          `☁️ ${openweatherOnlyCount} stations using OpenWeather-only data`,
        );
      }

      console.log(
        `📊 Enhanced averages using views: ${Object.keys(stationAverages).length} total stations`,
      );

      return stationAverages;
    } catch (error) {
      console.error('Error in getBatchEnhancedAverages:', error.message);
      return {};
    }
  }

  /**
   * Standard 3-hour averages (fallback method)
   */
  async getBatchStandardAverages(stationIds) {
    try {
      const { data, error } = await this.supabase
        .from('air_quality_readings')
        .select('station_uid, pm25, pm10, o3, no2, so2, co, timestamp')
        .in('station_uid', stationIds)
        .gte('timestamp', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching standard 3h averages:', error.message);
        return {};
      }

      if (!data || data.length === 0) {
        console.log(`ℹ️ No stored data for ${stationIds.length} stations`);
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
          (reading) =>
            reading.pm25 !== null || reading.o3 !== null || reading.no2 !== null,
        );

        if (validReadings.length > 0) {
          stationAverages[stationId] = {
            pm25: this.calculateAverage(validReadings, 'pm25'),
            pm10: this.calculateAverage(validReadings, 'pm10'),
            o3: this.calculateAverage(validReadings, 'o3'),
            no2: this.calculateAverage(validReadings, 'no2'),
            so2: this.calculateAverage(validReadings, 'so2'),
            co: this.calculateAverage(validReadings, 'co'),
            readingCount: validReadings.length,
            dataSources: 'station',
          };
        }
      });

      console.log(
        `📊 Standard batch processed ${Object.keys(stationAverages).length}/${stationIds.length} stations with data`,
      );
      return stationAverages;
    } catch (error) {
      console.error('Error in getBatchStandardAverages:', error.message);
      return {};
    }
  }

  /**
   * Get 3-hour averages for a single station (fallback)
   */
  async get3HourAverages(stationId) {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('air_quality_readings')
        .select('pm25, pm10, o3, no2, so2, co, timestamp')
        .eq('station_uid', stationId)
        .gte(
          'timestamp',
          new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        )
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching 3h averages:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Calculate averages
      const validReadings = data.filter(
        (reading) =>
          reading.pm25 !== null || reading.o3 !== null || reading.no2 !== null,
      );

      if (validReadings.length === 0) {
        return null;
      }

      const averages = {
        pm25: this.calculateAverage(validReadings, 'pm25'),
        pm10: this.calculateAverage(validReadings, 'pm10'),
        o3: this.calculateAverage(validReadings, 'o3'),
        no2: this.calculateAverage(validReadings, 'no2'),
        so2: this.calculateAverage(validReadings, 'so2'),
        co: this.calculateAverage(validReadings, 'co'),
        readingCount: validReadings.length,
      };

      return averages;
    } catch (error) {
      console.error('Error in get3HourAverages:', error);
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
      const fallbackAQHI = calculateStationAQHIRealistic(station);
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
        let aqhi = 0;
        let pm25Component = 0;
        let o3Component = 0;
        let no2Component = 0;

        let riskPM25 = 0;
        let riskO3 = 0;
        let riskNO2 = 0;

        if (averages.pm25) {
          riskPM25 = Math.exp(0.0012 * averages.pm25) - 1;
        }

        if (averages.o3) {
          riskO3 = Math.exp(0.0010 * averages.o3) - 1;
        }

        if (averages.no2) {
          riskNO2 = Math.exp(0.0052 * averages.no2) - 1;
        }

        const totalRiskSum = riskPM25 + riskO3 + riskNO2;
        aqhi = (10.0 / 105.19) * 100 * totalRiskSum;
        aqhi = Math.max(0, Math.round(aqhi)); // Round to whole number

        // Cache the result
        this.cache.set(cacheKey, {
          value: aqhi,
          timestamp: Date.now(),
          source: 'stored_3h_avg',
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
    const fallbackAQHI = calculateStationAQHIRealistic(station);

    // Cache fallback result for shorter time
    this.cache.set(cacheKey, {
      value: fallbackAQHI,
      timestamp: Date.now(),
      source: 'fallback',
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
      console.error('❌ Supabase not initialized - falling back to realistic AQHI calculations');
      // Fallback to realistic calculations
      return stations.map(station => ({
        ...station,
        aqhi: {
          value: calculateStationAQHIRealistic(station),
          level: getAQHILevel(calculateStationAQHIRealistic(station)),
          calculationMethod: 'fallback_no_db',
          readingCount: 0,
          dataQuality: 'estimated',
          dataSources: 'fallback'
        }
      }));
    }

    const startTime = Date.now();

    try {
      // Extract all station IDs for batch query
      const stationIds = stations
        .map((station) => station.uid?.toString())
        .filter((id) => id);

      console.log(`🔍 Fetching batch data for ${stationIds.length} stations...`);

      // Fetch all 3-hour averages in one batch query
      const batchAverages = await this.getBatch3HourAverages(stationIds);

      console.log(`📊 Got batch averages for ${Object.keys(batchAverages).length} stations`);

      // Process all stations in parallel with pre-fetched data
      const enhancedStations = await Promise.all(
        stations.map(async (station) => {
          const stationId = station.uid?.toString();
          const averages = stationId ? batchAverages[stationId] : null;

          let aqhiValue;
          if (averages && (averages.pm25 || averages.o3 || averages.no2)) {
            // Calculate AQHI using correct formula
            let riskPM25 = 0;
            let riskO3 = 0;
            let riskNO2 = 0;

            if (averages.pm25) {
              riskPM25 = Math.exp(0.0012 * averages.pm25) - 1;
            }
            if (averages.o3) {
              riskO3 = Math.exp(0.0010 * averages.o3) - 1;
            }
            if (averages.no2) {
              riskNO2 = Math.exp(0.0052 * averages.no2) - 1;
            }

            const totalRiskSum = riskPM25 + riskO3 + riskNO2;
            aqhiValue = (10.0 / 105.19) * 100 * totalRiskSum;
            aqhiValue = Math.max(0, Math.round(aqhiValue));

            // Cache the result
            if (stationId) {
              this.cache.set(`aqhi_${stationId}`, {
                value: aqhiValue,
                timestamp: Date.now(),
                source: 'batch_stored_3h_avg',
                readingCount: averages.readingCount,
              });
            }
          } else {
            // Try OpenWeather fallback for missing O3/NO2 data
            try {
              const supplementaryData = await getOpenWeatherFallback(
                station,
                averages,
              );

              if (supplementaryData) {
                aqhiValue = this.calculateWithSupplementaryData(
                  station,
                  supplementaryData,
                );

                if (stationId) {
                  this.cache.set(`aqhi_${stationId}`, {
                    value: aqhiValue,
                    timestamp: Date.now(),
                    source: 'openweather_supplemented',
                    readingCount: 1,
                  });
                }
              } else {
                // Final fallback to realistic calculation
                aqhiValue = calculateStationAQHIRealistic(station);

                if (stationId) {
                  this.cache.set(`aqhi_${stationId}`, {
                    value: aqhiValue,
                    timestamp: Date.now(),
                    source: 'fallback',
                    readingCount: 0,
                  });
                }
              }
            } catch (openWeatherError) {
              console.warn(`OpenWeather fallback failed for ${stationId}:`, openWeatherError.message);
              // Final fallback to realistic calculation
              aqhiValue = calculateStationAQHIRealistic(station);

              if (stationId) {
                this.cache.set(`aqhi_${stationId}`, {
                  value: aqhiValue,
                  timestamp: Date.now(),
                  source: 'fallback',
                  readingCount: 0,
                });
              }
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
            calculationMethod: cachedData?.source || 'unknown',
            readingCount: cachedData?.readingCount || 0,
            dataQuality: this.getDataQualityFromSource(
              cachedData?.source,
              cachedData?.readingCount,
              averages?.dataSources || 'station',
            ),
            dataSources: averages?.dataSources || 'station',
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
      console.error('❌ Error during AQHI enhancement:', error.message || error);
      // Return stations with fallback AQHI calculations
      const fallbackStations = stations.map(station => ({
        ...station,
        aqhi: {
          value: calculateStationAQHIRealistic(station),
          level: getAQHILevel(calculateStationAQHIRealistic(station)),
          calculationMethod: 'fallback_error',
          readingCount: 0,
          dataQuality: 'estimated',
          dataSources: 'fallback'
        }
      }));

      const duration = Date.now() - startTime;
      console.log(`⚠️ Fallback AQHI calculations completed for ${fallbackStations.length} stations in ${duration}ms`);
      return fallbackStations;
    }
  }

  /**
   * Calculate AQHI using station data supplemented with OpenWeather data
   * @param {Object} station - Station data from WAQI API
   * @param {Object} supplementaryData - Data from OpenWeather API
   * @returns {number} AQHI value
   */
  calculateWithSupplementaryData(station, supplementaryData) {
    // Merge station data with OpenWeather data, prioritizing station data
    const mergedData = {
      pm25: station.iaqi?.pm25?.v || supplementaryData.pm25,
      o3: station.iaqi?.o3?.v || supplementaryData.o3,
      no2: station.iaqi?.no2?.v || supplementaryData.no2,
      so2: station.iaqi?.so2?.v || supplementaryData.so2,
    };

    // Correct AQHI formula
    let riskPM25 = 0;
    let riskO3 = 0;
    let riskNO2 = 0;

    if (mergedData.pm25) {
      riskPM25 = Math.exp(0.0012 * mergedData.pm25) - 1;
    }
    if (mergedData.o3) {
      riskO3 = Math.exp(0.0010 * mergedData.o3) - 1;
    }
    if (mergedData.no2) {
      riskNO2 = Math.exp(0.0052 * mergedData.no2) - 1;
    }

    const totalRiskSum = riskPM25 + riskO3 + riskNO2;
    const aqhi = (10.0 / 105.19) * 100 * totalRiskSum;
    const aqhiValue = Math.max(0, Math.round(aqhi));

    // Log the data sources used
    const stationSources = Object.entries(mergedData)
      .filter(([key, value]) => value !== null && station.iaqi?.[key]?.v)
      .map(([key]) => key);
    const openWeatherSources = Object.entries(mergedData)
      .filter(
        ([key, value]) =>
          value !== null && !station.iaqi?.[key]?.v && supplementaryData[key],
      )
      .map(([key]) => key);

    console.log(
      `Station ${station.station?.name || station.uid}: AQHI=${aqhiValue} using station[${stationSources.join(',')}] + OpenWeather[${openWeatherSources.join(',')}]`,
    );

    return aqhiValue;
  }

  /**
   * Get data quality level based on cache source and reading count
   * @param {string} source - Cache source type
   * @param {number} readingCount - Number of readings used
   * @returns {string} Data quality level
   */
  getDataQualityFromSource(source, readingCount = 0, dataSources = 'station') {
    // Check if data sources indicate mixed data (station + OpenWeather)
    if (dataSources === 'mixed') {
      return 'enhanced';
    }

    switch (source) {
      case 'batch_stored_3h_avg':
        if (readingCount >= 15) return 'excellent';
        if (readingCount >= 10) return 'good';
        if (readingCount >= 5) return 'fair';
        return 'limited';
      case 'openweather_supplemented':
        return 'enhanced';
      case 'fallback':
        return 'estimated';
      default:
        return 'unknown';
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      totalCached: this.cache.size,
      storedCalculations: 0,
      openWeatherSupplemented: 0,
      fallbackCalculations: 0,
    };

    for (const [key, value] of this.cache.entries()) {
      if (
        value.source === 'stored_3h_avg' ||
        value.source === 'batch_stored_3h_avg'
      ) {
        stats.storedCalculations++;
      } else if (value.source === 'openweather_supplemented') {
        stats.openWeatherSupplemented++;
      } else {
        stats.fallbackCalculations++;
      }
    }

    return stats;
  }
}

// Create singleton instance
export const supabaseAQHI = new SupabaseAQHI();
