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

      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      console.log('✅ Supabase AQHI calculator initialized');
    } catch (error) {
      console.warn('⚠️ Supabase AQHI calculator failed to initialize:', error);
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
   * Get enhanced averages using database functions (preferred method)
   */
  async getBatchEnhancedAverages(stationIds) {
    const stationAverages = {};

    // We need station coordinates for the enhanced calculation
    const { data: stations, error: stationsError } = await this.supabase
      .from('stations')
      .select('station_uid, latitude, longitude')
      .in('station_uid', stationIds);

    if (stationsError || !stations) {
      console.log(
        'Could not fetch station coordinates for enhanced calculation',
      );
      return {};
    }

    // Process each station with enhanced calculation
    const promises = stations.map(async (station) => {
      try {
        const { data, error } = await this.supabase.rpc(
          'calculate_enhanced_3h_averages',
          {
            station_uid_param: station.station_uid,
            station_lat: station.latitude,
            station_lon: station.longitude,
          },
        );

        if (!error && data && data.length > 0) {
          const avgData = data[0];
          if (avgData.reading_count > 0) {
            stationAverages[station.station_uid] = {
              pm25: avgData.pm25,
              pm10: avgData.pm10,
              o3: avgData.o3,
              no2: avgData.no2,
              so2: avgData.so2,
              co: avgData.co,
              readingCount: avgData.reading_count,
              dataSources: avgData.data_sources || 'station',
            };
          }
        }
      } catch (error) {
        console.error(
          `Error calculating enhanced averages for station ${station.station_uid}:`,
          error,
        );
      }
    });

    await Promise.all(promises);

    const enhancedCount = Object.values(stationAverages).filter(
      (avg) => avg.dataSources === 'mixed',
    ).length;

    if (enhancedCount > 0) {
      console.log(
        `🌐 ${enhancedCount} stations enhanced with OpenWeather data`,
      );
    }

    return stationAverages;
  }

  /**
   * Standard 3-hour averages (fallback method)
   */
  async getBatchStandardAverages(stationIds) {
    const { data, error } = await this.supabase
      .from('air_quality_readings')
      .select('station_uid, pm25, pm10, o3, no2, so2, co, timestamp')
      .in('station_uid', stationIds)
      .gte('timestamp', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching standard 3h averages:', error);
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
        // Calculate AQHI using Health Canada formula
        let aqhi = 0;

        if (averages.pm25) {
          aqhi += Math.exp(0.000487 * averages.pm25) - 1;
        }

        if (averages.o3) {
          aqhi += Math.exp(0.000871 * averages.o3) - 1;
        }

        if (averages.no2) {
          aqhi += Math.exp(0.000537 * averages.no2) - 1;
        }

        aqhi = (10.0 / 10.4) * 100 * aqhi;
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
    const startTime = Date.now();

    // Extract all station IDs for batch query
    const stationIds = stations
      .map((station) => station.uid?.toString())
      .filter((id) => id);

    // Fetch all 3-hour averages in one batch query
    const batchAverages = await this.getBatch3HourAverages(stationIds);

    // Process all stations in parallel with pre-fetched data
    const enhancedStations = await Promise.all(
      stations.map(async (station) => {
        const stationId = station.uid?.toString();
        const averages = stationId ? batchAverages[stationId] : null;

        let aqhiValue;
        if (averages && (averages.pm25 || averages.o3 || averages.no2)) {
          // Calculate AQHI using Health Canada formula
          aqhiValue = 0;
          if (averages.pm25)
            aqhiValue += Math.exp(0.000487 * averages.pm25) - 1;
          if (averages.o3) aqhiValue += Math.exp(0.000871 * averages.o3) - 1;
          if (averages.no2) aqhiValue += Math.exp(0.000537 * averages.no2) - 1;
          aqhiValue = (10.0 / 10.4) * 100 * aqhiValue;
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
            const { calculateStationAQHIRealistic } = await import(
              './aqhi-realistic.js'
            );
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

    // Apply Health Canada AQHI formula with merged data
    let aqhi = 0;
    if (mergedData.pm25) aqhi += Math.exp(0.000487 * mergedData.pm25) - 1;
    if (mergedData.o3) aqhi += Math.exp(0.000871 * mergedData.o3) - 1;
    if (mergedData.no2) aqhi += Math.exp(0.000537 * mergedData.no2) - 1;

    aqhi = (10.0 / 10.4) * 100 * aqhi;
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
