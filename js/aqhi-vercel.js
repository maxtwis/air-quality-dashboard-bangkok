// AQHI Implementation optimized for Vercel deployment
// Uses server-side collected historical data with localStorage fallback

import { AQHI_LEVELS } from './aqhi-realistic.js';

// AQHI calculation parameters
const AQHI_PARAMS = {
    C: 105.19,
    beta: {
        pm25: 0.0012,
        o3: 0.001,
        no2: 0.0052,
        so2: 0.0038
    }
};

/**
 * Fetch 3-hour moving averages from Vercel API
 */
async function fetchServerHistoricalData(stationId = null) {
    try {
        const url = stationId 
            ? `/api/get-historical?station=${stationId}&hours=3`
            : `/api/get-historical?hours=3`;
            
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn('Server historical data unavailable, falling back to client-side');
            return null;
        }
        
        const data = await response.json();
        console.log('📊 Retrieved server-side 3-hour averages for', Object.keys(data).length, 'stations');
        return data;
        
    } catch (error) {
        console.warn('Error fetching server historical data:', error);
        return null;
    }
}

/**
 * Calculate AQHI using server-side 3-hour averages
 */
export async function calculateVercelAQHI(station) {
    const stationId = station.uid?.toString();
    
    // Try to get server-side 3-hour averages
    const serverData = await fetchServerHistoricalData();
    
    if (serverData && serverData[stationId]) {
        return calculateAQHIFromServerData(station, serverData[stationId]);
    } else {
        // Fallback to client-side approach
        return calculateAQHIClientFallback(station);
    }
}

/**
 * Calculate AQHI from server-provided moving averages
 */
function calculateAQHIFromServerData(station, serverAverages) {
    const { averages, dataQuality, dataPoints, timeSpan } = serverAverages;
    
    // Calculate AQHI using 3-hour averages
    const aqhi = calculateRealisticAQHI(
        averages.pm25,
        averages.no2,
        averages.o3,
        averages.so2
    );
    
    const level = getAQHILevel(aqhi);
    
    return {
        value: aqhi,
        level,
        pollutants: {
            pm25: station.iaqi?.pm25?.v || 0,
            no2: station.iaqi?.no2?.v || 0,
            o3: station.iaqi?.o3?.v || 0,
            so2: station.iaqi?.so2?.v || 0
        },
        movingAverages: averages,
        calculationMethod: 'server-average',
        dataQuality,
        dataPoints,
        timeSpanHours: timeSpan,
        hasServerData: true,
        note: `Using ${timeSpan}h server-side moving average (${dataPoints} readings, ${dataQuality} quality)`
    };
}

/**
 * Fallback to client-side calculation when server data unavailable
 */
function calculateAQHIClientFallback(station) {
    // Use current readings with clear indication
    const currentPollutants = {
        pm25: station.iaqi?.pm25?.v || 0,
        no2: station.iaqi?.no2?.v || 0,
        o3: station.iaqi?.o3?.v || 0,
        so2: station.iaqi?.so2?.v || 0
    };
    
    const aqhi = calculateRealisticAQHI(
        currentPollutants.pm25,
        currentPollutants.no2,
        currentPollutants.o3,
        currentPollutants.so2
    );
    
    const level = getAQHILevel(aqhi);
    
    return {
        value: aqhi,
        level,
        pollutants: currentPollutants,
        calculationMethod: 'current-fallback',
        dataQuality: 'limited',
        dataPoints: 1,
        timeSpanHours: 0,
        hasServerData: false,
        note: 'Using current readings (server historical data unavailable)'
    };
}

/**
 * Calculate AQHI from pollutant concentrations
 */
function calculateRealisticAQHI(pm25 = 0, no2 = 0, o3 = 0, so2 = 0) {
    const pm25Component = 100 * (Math.exp(AQHI_PARAMS.beta.pm25 * Math.max(0, pm25)) - 1);
    const o3Component = Math.exp(AQHI_PARAMS.beta.o3 * Math.max(0, o3)) - 1;
    const no2Component = Math.exp(AQHI_PARAMS.beta.no2 * Math.max(0, no2)) - 1;
    const so2Component = Math.exp(AQHI_PARAMS.beta.so2 * Math.max(0, so2)) - 1;
    
    const aqhi = (10 / AQHI_PARAMS.C) * (pm25Component + o3Component + no2Component + so2Component);
    return Math.round(aqhi * 10) / 10;
}

/**
 * Get AQHI level information
 */
export function getAQHILevel(aqhi) {
    for (const [key, level] of Object.entries(AQHI_LEVELS)) {
        if (aqhi >= level.min && aqhi <= level.max) {
            return { ...level, key };
        }
    }
    return { ...AQHI_LEVELS.VERY_HIGH, key: 'VERY_HIGH' };
}

/**
 * Format AQHI for display
 */
export function formatAQHI(aqhi) {
    if (aqhi > 10) return `${aqhi.toFixed(1)}+`;
    return aqhi.toFixed(1);
}

/**
 * Get system status for debugging
 */
export async function getAQHISystemStatus() {
    try {
        const serverData = await fetchServerHistoricalData();
        
        if (serverData) {
            const stationCount = Object.keys(serverData).length;
            const qualityBreakdown = Object.values(serverData).reduce((acc, station) => {
                acc[station.dataQuality] = (acc[station.dataQuality] || 0) + 1;
                return acc;
            }, {});
            
            return {
                status: 'server-available',
                stationCount,
                qualityBreakdown,
                message: `Server-side 3-hour averages available for ${stationCount} stations`
            };
        } else {
            return {
                status: 'fallback-mode',
                stationCount: 0,
                message: 'Using client-side fallback (current readings only)'
            };
        }
    } catch (error) {
        return {
            status: 'error',
            error: error.message,
            message: 'Error checking AQHI system status'
        };
    }
}