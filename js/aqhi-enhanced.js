// Enhanced AQHI calculation using stored 3-hour averages
import { airQualityStorage } from './storage.js';
import { calculateStationAQHIRealistic } from './aqhi-realistic.js';

export class EnhancedAQHI {
    constructor() {
        this.fallbackToRealistic = true;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    }

    /**
     * Calculate AQHI for a station using 3-hour moving averages when available
     */
    async calculateStationAQHI(station) {
        const stationId = station.uid?.toString();

        if (!stationId) {
            return this.fallbackCalculation(station);
        }

        // Check cache first
        const cacheKey = `aqhi_${stationId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.value;
        }

        try {
            // Try to get AQHI from stored 3-hour averages
            const storedAQHI = await airQualityStorage.calculateAQHIFromStorage(stationId);

            if (storedAQHI !== null && storedAQHI > 0) {
                // Cache the result
                this.cache.set(cacheKey, {
                    value: storedAQHI,
                    timestamp: Date.now(),
                    source: 'stored'
                });

                console.log(`🔄 AQHI from 3h average for ${stationId}: ${storedAQHI}`);
                return storedAQHI;
            }
        } catch (error) {
            console.warn(`⚠️ Error calculating AQHI from storage for ${stationId}:`, error.message);
        }

        // Fallback to realistic calculation
        return this.fallbackCalculation(station);
    }

    /**
     * Fallback to realistic AQHI calculation
     */
    fallbackCalculation(station) {
        const aqhi = calculateStationAQHIRealistic(station);
        const stationId = station.uid?.toString();

        if (stationId) {
            // Cache the fallback result for shorter time
            this.cache.set(`aqhi_${stationId}`, {
                value: aqhi,
                timestamp: Date.now(),
                source: 'fallback'
            });
        }

        return aqhi;
    }

    /**
     * Get AQHI category and information
     */
    getAQHICategory(aqhi) {
        if (aqhi === null || aqhi === undefined) {
            return {
                level: 'unknown',
                label: 'Unknown',
                color: '#999999',
                description: 'AQHI data not available',
                healthMessage: 'No data available'
            };
        }

        if (aqhi <= 3) {
            return {
                level: 'low',
                label: 'Low Risk (1-3)',
                color: '#00E400',
                description: 'Ideal air quality for outdoor activities',
                healthMessage: 'Enjoy your usual outdoor activities.'
            };
        } else if (aqhi <= 6) {
            return {
                level: 'moderate',
                label: 'Moderate Risk (4-6)',
                color: '#FFFF00',
                description: 'No need to modify outdoor activities unless experiencing symptoms',
                healthMessage: 'Consider reducing or rescheduling strenuous activities outdoors if you are experiencing symptoms.'
            };
        } else if (aqhi <= 10) {
            return {
                level: 'high',
                label: 'High Risk (7-10)',
                color: '#FF7E00',
                description: 'Consider reducing or rescheduling strenuous activities outdoors',
                healthMessage: 'Reduce or reschedule strenuous activities outdoors. Children and the elderly should also take it easy.'
            };
        } else {
            return {
                level: 'very_high',
                label: 'Very High Risk (10+)',
                color: '#FF0000',
                description: 'Reduce or reschedule strenuous activities outdoors',
                healthMessage: 'Avoid strenuous activities outdoors. Children and the elderly should also avoid outdoor physical exertion.'
            };
        }
    }

    /**
     * Enhanced station data with proper AQHI
     */
    async enhanceStationWithAQHI(station) {
        const aqhi = await this.calculateStationAQHI(station);
        const aqhiInfo = this.getAQHICategory(aqhi);

        return {
            ...station,
            aqhi: aqhi,
            aqhiCategory: aqhiInfo,
            // Keep original AQI data
            originalAQI: station.aqi
        };
    }

    /**
     * Process multiple stations
     */
    async enhanceStationsWithAQHI(stations) {
        const promises = stations.map(station => this.enhanceStationWithAQHI(station));
        return await Promise.all(promises);
    }

    /**
     * Get storage statistics for debugging
     */
    async getStorageStats() {
        try {
            return await airQualityStorage.getStats();
        } catch (error) {
            console.error('Error getting storage stats:', error);
            return null;
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache info for debugging
     */
    getCacheInfo() {
        const now = Date.now();
        const cacheInfo = [];

        for (const [key, value] of this.cache.entries()) {
            cacheInfo.push({
                key,
                value: value.value,
                age: Math.round((now - value.timestamp) / 1000),
                source: value.source
            });
        }

        return cacheInfo;
    }
}

// Create singleton instance
export const enhancedAQHI = new EnhancedAQHI();

// Export helper function for easy use
export async function calculateEnhancedAQHI(station) {
    return await enhancedAQHI.calculateStationAQHI(station);
}