// Browser-compatible AQHI calculation using Supabase data
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js';
import { calculateStationAQHIRealistic, getAQHILevel } from './aqhi-realistic.js';

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
            const supabaseUrl = window.SUPABASE_URL || 'https://xqvjrovzhupdfwvdikpo.supabase.co';
            const supabaseAnonKey = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxdmpyb3Z6aHVwZGZ3dmRpa3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTQyMjMsImV4cCI6MjA3MzUzMDIyM30.rzJ8-LnZh2dITbh7HcIXJ32BQ1MN-F-O5hCmO0jzIDo';

            this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            });

            console.log('✅ Supabase AQHI calculator initialized');
        } catch (error) {
            console.warn('⚠️ Supabase AQHI calculator failed to initialize:', error);
            this.supabase = null;
        }
    }

    /**
     * Get 3-hour averages for multiple stations at once (batch query)
     */
    async getBatch3HourAverages(stationIds) {
        if (!this.supabase || !stationIds.length) return {};

        try {
            const { data, error } = await this.supabase
                .from('air_quality_readings')
                .select('station_uid, pm25, pm10, o3, no2, so2, co, timestamp')
                .in('station_uid', stationIds)
                .gte('timestamp', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
                .order('timestamp', { ascending: false });

            if (error) {
                console.error('Error fetching batch 3h averages:', error);
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
                const validReadings = readings.filter(reading =>
                    reading.pm25 !== null || reading.o3 !== null || reading.no2 !== null
                );

                if (validReadings.length > 0) {
                    stationAverages[stationId] = {
                        pm25: this.calculateAverage(validReadings, 'pm25'),
                        pm10: this.calculateAverage(validReadings, 'pm10'),
                        o3: this.calculateAverage(validReadings, 'o3'),
                        no2: this.calculateAverage(validReadings, 'no2'),
                        so2: this.calculateAverage(validReadings, 'so2'),
                        co: this.calculateAverage(validReadings, 'co'),
                        readingCount: validReadings.length
                    };
                }
            });

            console.log(`📊 Batch processed ${Object.keys(stationAverages).length}/${stationIds.length} stations with data`);
            return stationAverages;

        } catch (error) {
            console.error('Error in getBatch3HourAverages:', error);
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
                .gte('timestamp', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
                .order('timestamp', { ascending: false });

            if (error) {
                console.error('Error fetching 3h averages:', error);
                return null;
            }

            if (!data || data.length === 0) {
                return null;
            }

            // Calculate averages
            const validReadings = data.filter(reading =>
                reading.pm25 !== null || reading.o3 !== null || reading.no2 !== null
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
                readingCount: validReadings.length
            };

            return averages;

        } catch (error) {
            console.error('Error in get3HourAverages:', error);
            return null;
        }
    }

    calculateAverage(readings, pollutant) {
        const values = readings
            .map(r => r[pollutant])
            .filter(v => v !== null && v !== undefined && !isNaN(v));

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
                level: aqhiLevel
            };
        }

        // Check cache
        const cacheKey = `aqhi_${stationId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            const aqhiLevel = getAQHILevel(cached.value);
            return {
                value: cached.value,
                level: aqhiLevel
            };
        }

        try {
            // Get 3-hour averages
            const averages = await this.get3HourAverages(stationId);

            if (averages && (averages.pm25 || averages.o3 || averages.no2)) {
                // Calculate AQHI using Health Canada formula
                let aqhi = 0;

                if (averages.pm25) {
                    aqhi += (Math.exp(0.000487 * averages.pm25) - 1);
                }

                if (averages.o3) {
                    aqhi += (Math.exp(0.000871 * averages.o3) - 1);
                }

                if (averages.no2) {
                    aqhi += (Math.exp(0.000537 * averages.no2) - 1);
                }

                aqhi = (10.0 / 10.4) * 100 * aqhi;
                aqhi = Math.max(0, Math.round(aqhi * 10) / 10); // Round to 1 decimal place

                // Cache the result
                this.cache.set(cacheKey, {
                    value: aqhi,
                    timestamp: Date.now(),
                    source: 'stored_3h_avg',
                    readingCount: averages.readingCount
                });

                console.log(`🔄 AQHI from 3h avg for ${stationId}: ${aqhi} (${averages.readingCount} readings)`);
                const aqhiLevel = getAQHILevel(aqhi);
                return {
                    value: aqhi,
                    level: aqhiLevel
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
            readingCount: 0
        });

        const aqhiLevel = getAQHILevel(fallbackAQHI);
        return {
            value: fallbackAQHI,
            level: aqhiLevel
        };
    }

    /**
     * Process multiple stations with optimized batch database queries
     */
    async enhanceStationsWithAQHI(stations) {
        console.log(`🔄 Processing ${stations.length} stations with batch optimization...`);
        const startTime = Date.now();

        // Extract all station IDs for batch query
        const stationIds = stations
            .map(station => station.uid?.toString())
            .filter(id => id);

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
                    if (averages.pm25) aqhiValue += (Math.exp(0.000487 * averages.pm25) - 1);
                    if (averages.o3) aqhiValue += (Math.exp(0.000871 * averages.o3) - 1);
                    if (averages.no2) aqhiValue += (Math.exp(0.000537 * averages.no2) - 1);
                    aqhiValue = (10.0 / 10.4) * 100 * aqhiValue;
                    aqhiValue = Math.max(0, Math.round(aqhiValue * 10) / 10);

                    // Cache the result
                    if (stationId) {
                        this.cache.set(`aqhi_${stationId}`, {
                            value: aqhiValue,
                            timestamp: Date.now(),
                            source: 'batch_stored_3h_avg',
                            readingCount: averages.readingCount
                        });
                    }
                } else {
                    // Fallback to realistic calculation
                    const { calculateStationAQHIRealistic } = await import('./aqhi-realistic.js');
                    aqhiValue = calculateStationAQHIRealistic(station);

                    if (stationId) {
                        this.cache.set(`aqhi_${stationId}`, {
                            value: aqhiValue,
                            timestamp: Date.now(),
                            source: 'fallback',
                            readingCount: 0
                        });
                    }
                }

                // Create proper AQHI object with value and level information
                const aqhiLevel = getAQHILevel(aqhiValue);
                const aqhiData = {
                    value: aqhiValue,
                    level: aqhiLevel
                };

                return {
                    ...station,
                    aqhi: aqhiData
                };
            })
        );

        const duration = Date.now() - startTime;
        const storedCount = Object.keys(batchAverages).length;
        console.log(`✅ Enhanced ${enhancedStations.length} stations (${storedCount} from stored data) in ${duration}ms`);
        return enhancedStations;
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = {
            totalCached: this.cache.size,
            storedCalculations: 0,
            fallbackCalculations: 0
        };

        for (const [key, value] of this.cache.entries()) {
            if (value.source === 'stored_3h_avg') {
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