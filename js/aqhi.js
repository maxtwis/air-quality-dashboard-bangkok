// AQHI (Air Quality Health Index) Calculation Module
// Based on 3-hour moving average concentrations of PM2.5, NO2, O3, and SO2

import { saveHistoricalData, loadHistoricalData, initializeDataStore } from './dataStore.js';

// AQHI Parameters
const AQHI_PARAMS = {
    C: 105.19,  // Scaling constant
    // Beta coefficients (per 1 μg/m³ increase)
    beta: {
        pm25: 0.0012,  // 0.0122 per 10 μg/m³
        o3: 0.001,     // 0.0099 per 10 μg/m³
        no2: 0.0052,   // 0.0519 per 10 μg/m³
        so2: 0.0038    // 0.0381 per 10 μg/m³ (estimated based on health impact studies)
    }
};

// Storage for historical data (3-hour moving average)
let historicalData = initializeDataStore();

// AQHI Categories and color scheme
export const AQHI_LEVELS = {
    LOW: {
        min: 0,
        max: 3,
        color: '#00e400',
        label: 'Low',
        description: 'Ideal air quality for outdoor activities'
    },
    MODERATE: {
        min: 4,
        max: 6,
        color: '#ffff00',
        label: 'Moderate',
        description: 'No need to modify outdoor activities unless experiencing symptoms'
    },
    HIGH: {
        min: 7,
        max: 10,
        color: '#ff7e00',
        label: 'High',
        description: 'Consider reducing or rescheduling strenuous outdoor activities'
    },
    VERY_HIGH: {
        min: 11,
        max: Infinity,
        color: '#ff0000',
        label: 'Very High',
        description: 'Reduce or reschedule strenuous outdoor activities'
    }
};

/**
 * Store pollutant data for moving average calculation
 * @param {string} stationId - Station identifier
 * @param {Object} pollutants - Current pollutant values
 * @param {Date} timestamp - Measurement timestamp
 */
export function storePollutantData(stationId, pollutants, timestamp = new Date()) {
    if (!historicalData.has(stationId)) {
        historicalData.set(stationId, []);
    }
    
    const stationHistory = historicalData.get(stationId);
    
    // Check if we already have data for this timestamp (avoid duplicates)
    const existingIndex = stationHistory.findIndex(entry => 
        Math.abs(entry.timestamp - timestamp) < 60000 // Within 1 minute
    );
    
    if (existingIndex >= 0) {
        // Update existing entry
        stationHistory[existingIndex] = { timestamp, pollutants };
    } else {
        // Add new entry
        stationHistory.push({ timestamp, pollutants });
    }
    
    // Keep only last 3 hours of data
    const threeHoursAgo = new Date(timestamp.getTime() - 3 * 60 * 60 * 1000);
    const filtered = stationHistory.filter(entry => entry.timestamp > threeHoursAgo);
    historicalData.set(stationId, filtered);
    
    // Save to localStorage
    saveHistoricalData(historicalData);
}

/**
 * Calculate 3-hour moving average for pollutants
 * @param {string} stationId - Station identifier
 * @returns {Object} 3-hour average pollutant concentrations
 */
export function calculate3HourAverage(stationId) {
    const stationHistory = historicalData.get(stationId) || [];
    
    if (stationHistory.length === 0) {
        return null;
    }
    
    const sums = { pm25: 0, no2: 0, o3: 0, so2: 0 };
    const counts = { pm25: 0, no2: 0, o3: 0, so2: 0 };
    
    stationHistory.forEach(entry => {
        Object.keys(sums).forEach(pollutant => {
            if (entry.pollutants[pollutant] !== undefined && entry.pollutants[pollutant] > 0) {
                sums[pollutant] += entry.pollutants[pollutant];
                counts[pollutant]++;
            }
        });
    });
    
    const averages = {};
    Object.keys(sums).forEach(pollutant => {
        averages[pollutant] = counts[pollutant] > 0 ? sums[pollutant] / counts[pollutant] : 0;
    });
    
    return {
        ...averages,
        dataPoints: stationHistory.length,
        timeSpan: stationHistory.length > 0 ? 
            (new Date() - stationHistory[0].timestamp) / (1000 * 60) : 0 // in minutes
    };
}

/**
 * Calculate AQHI from pollutant concentrations
 * Formula: AQHI = (10/C) * [100 * (exp(β_PM2.5 * x_PM2.5) - 1) + (exp(β_O3 * x_O3) - 1) + (exp(β_NO2 * x_NO2) - 1) + (exp(β_SO2 * x_SO2) - 1)]
 * 
 * @param {number} pm25 - PM2.5 concentration in μg/m³ (3-hour average)
 * @param {number} no2 - NO2 concentration in μg/m³ (3-hour average)
 * @param {number} o3 - O3 concentration in μg/m³ (3-hour average)
 * @param {number} so2 - SO2 concentration in μg/m³ (3-hour average)
 * @returns {number} AQHI value (typically 1-10+)
 */
export function calculateAQHI(pm25 = 0, no2 = 0, o3 = 0, so2 = 0) {
    // Ensure non-negative values
    pm25 = Math.max(0, pm25 || 0);
    no2 = Math.max(0, no2 || 0);
    o3 = Math.max(0, o3 || 0);
    so2 = Math.max(0, so2 || 0);
    
    // Calculate individual components
    const pm25Component = 100 * (Math.exp(AQHI_PARAMS.beta.pm25 * pm25) - 1);
    const o3Component = Math.exp(AQHI_PARAMS.beta.o3 * o3) - 1;
    const no2Component = Math.exp(AQHI_PARAMS.beta.no2 * no2) - 1;
    const so2Component = Math.exp(AQHI_PARAMS.beta.so2 * so2) - 1;
    
    // Calculate AQHI
    const aqhi = (10 / AQHI_PARAMS.C) * (pm25Component + o3Component + no2Component + so2Component);
    
    // Round to 1 decimal place
    return Math.round(aqhi * 10) / 10;
}

/**
 * Get AQHI level information based on AQHI value
 * @param {number} aqhi - AQHI value
 * @returns {Object} Level information including color, label, and description
 */
export function getAQHILevel(aqhi) {
    for (const [key, level] of Object.entries(AQHI_LEVELS)) {
        if (aqhi >= level.min && aqhi <= level.max) {
            return { ...level, key };
        }
    }
    // Default to VERY_HIGH for extreme values
    return { ...AQHI_LEVELS.VERY_HIGH, key: 'VERY_HIGH' };
}

/**
 * Extract pollutant raw values from station data
 * @param {Object} station - Station data from API
 * @returns {Object} Object containing pm25, no2, o3, so2 values
 */
export function extractPollutantValues(station) {
    const pollutants = {
        pm25: 0,
        no2: 0,
        o3: 0,
        so2: 0
    };
    
    // Check if station has iaqi (Individual Air Quality Index) data
    if (station.iaqi) {
        // PM2.5 value
        if (station.iaqi.pm25) {
            pollutants.pm25 = station.iaqi.pm25.v || 0;
        }
        
        // NO2 value
        if (station.iaqi.no2) {
            pollutants.no2 = station.iaqi.no2.v || 0;
        }
        
        // O3 value
        if (station.iaqi.o3) {
            pollutants.o3 = station.iaqi.o3.v || 0;
        }
        
        // SO2 value
        if (station.iaqi.so2) {
            pollutants.so2 = station.iaqi.so2.v || 0;
        }
    }
    
    return pollutants;
}

/**
 * Calculate AQHI from station data
 * @param {Object} station - Station data from API
 * @param {boolean} useMovingAverage - Whether to use 3-hour moving average
 * @returns {Object} Object containing AQHI value and level information
 */
export function calculateStationAQHI(station, useMovingAverage = false) {
    const stationId = station.uid || station.station?.name || 'unknown';
    const currentPollutants = extractPollutantValues(station);
    
    // Store current data for moving average
    if (useMovingAverage) {
        storePollutantData(stationId, currentPollutants);
    }
    
    // Get values to use for calculation
    let pollutantsForCalculation = currentPollutants;
    let isUsingAverage = false;
    let averageInfo = null;
    
    if (useMovingAverage) {
        averageInfo = calculate3HourAverage(stationId);
        if (averageInfo && averageInfo.timeSpan >= 60) { // At least 1 hour of data
            pollutantsForCalculation = averageInfo;
            isUsingAverage = true;
        }
    }
    
    const aqhi = calculateAQHI(
        pollutantsForCalculation.pm25, 
        pollutantsForCalculation.no2, 
        pollutantsForCalculation.o3,
        pollutantsForCalculation.so2
    );
    const level = getAQHILevel(aqhi);
    
    return {
        value: aqhi,
        level: level,
        pollutants: currentPollutants,
        averagePollutants: isUsingAverage ? pollutantsForCalculation : null,
        isUsingAverage,
        dataTimeSpan: averageInfo?.timeSpan || 0,
        dataPoints: averageInfo?.dataPoints || 1,
        hasAllData: pollutantsForCalculation.pm25 > 0 && 
                   pollutantsForCalculation.no2 > 0 && 
                   pollutantsForCalculation.o3 > 0 &&
                   pollutantsForCalculation.so2 > 0,
        missingPollutants: []
            .concat(pollutantsForCalculation.pm25 === 0 ? ['PM2.5'] : [])
            .concat(pollutantsForCalculation.no2 === 0 ? ['NO2'] : [])
            .concat(pollutantsForCalculation.o3 === 0 ? ['O3'] : [])
            .concat(pollutantsForCalculation.so2 === 0 ? ['SO2'] : [])
    };
}

/**
 * Format AQHI display value
 * @param {number} aqhi - AQHI value
 * @returns {string} Formatted AQHI string
 */
export function formatAQHI(aqhi) {
    if (aqhi > 10) {
        return `${aqhi.toFixed(1)}+`;
    }
    return aqhi.toFixed(1);
}

/**
 * Calculate statistics for multiple stations
 * @param {Array} stations - Array of station data
 * @returns {Object} Statistics including average, min, max, and category counts
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
        VERY_HIGH: 0
    };
    
    let stationsWithData = 0;
    let stationsWithPartialData = 0;
    
    stations.forEach(station => {
        const aqhiData = calculateStationAQHI(station);
        
        if (aqhiData.pollutants.pm25 > 0) {  // At least PM2.5 data available
            aqhiValues.push(aqhiData.value);
            categoryCounts[aqhiData.level.key]++;
            stationsWithData++;
            
            if (!aqhiData.hasAllData) {
                stationsWithPartialData++;
            }
        }
    });
    
    if (aqhiValues.length === 0) {
        return null;
    }
    
    const average = aqhiValues.reduce((sum, val) => sum + val, 0) / aqhiValues.length;
    const min = Math.min(...aqhiValues);
    const max = Math.max(...aqhiValues);
    
    return {
        average: Math.round(average * 10) / 10,
        min: Math.round(min * 10) / 10,
        max: Math.round(max * 10) / 10,
        categoryCounts,
        totalStations: stations.length,
        stationsWithData,
        stationsWithPartialData,
        percentComplete: Math.round((stationsWithData - stationsWithPartialData) / stationsWithData * 100)
    };
}