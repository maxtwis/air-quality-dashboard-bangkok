import { calculateStationStatistics, getAQIClass } from './utils.js';
import { uiManager } from './ui.js';

// Modern statistics calculation and display

export function updateStatisticsPanel(stations) {
    const stats = calculateStationStatistics(stations);
    const statsContent = document.getElementById('stats-content');
    
    if (!statsContent) {
        console.error('Statistics content element not found');
        return;
    }
    
    if (!stats) {
        uiManager.showError('stats-content', 'No valid air quality data available');
        return;
    }
    
    // Create modern stats grid
    const statsHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.totalStations}</div>
                <div class="stat-label">Total Stations</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQIClass(stats.avgAQI)}">${stats.avgAQI}</div>
                <div class="stat-label">Average AQI</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQIClass(stats.maxAQI)}">${stats.maxAQI}</div>
                <div class="stat-label">Highest AQI</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQIClass(stats.minAQI)}">${stats.minAQI}</div>
                <div class="stat-label">Lowest AQI</div>
            </div>
        </div>
    `;
    
    statsContent.innerHTML = statsHTML;
    
    // Update category breakdown
    uiManager.updateCategoryBreakdown(stats.categories);
    
    console.log('Modern statistics updated');
}

export function createStatCard(label, value, cssClass = '', description = '') {
    return `
        <div class="stat-card ${cssClass}">
            <div class="stat-value">${value}</div>
            <div class="stat-label">${label}</div>
            ${description ? `<div class="stat-description">${description}</div>` : ''}
        </div>
    `;
}

export function getAQISummary(stations) {
    const stats = calculateStationStatistics(stations);
    if (!stats) return 'No data available';
    
    const { avgAQI, totalStations } = stats;
    let summary = `Average AQI: ${avgAQI} across ${totalStations} stations. `;
    
    if (avgAQI <= 50) {
        summary += 'Air quality is generally good across Bangkok.';
    } else if (avgAQI <= 100) {
        summary += 'Air quality is moderate across Bangkok.';
    } else if (avgAQI <= 150) {
        summary += 'Air quality may be unhealthy for sensitive groups.';
    } else {
        summary += 'Air quality is concerning across Bangkok.';
    }
    
    return summary;
}

export function generateStatsReport(stations) {
    const stats = calculateStationStatistics(stations);
    if (!stats) return null;
    
    const report = {
        timestamp: new Date().toISOString(),
        location: 'Bangkok, Thailand',
        summary: getAQISummary(stations),
        statistics: {
            totalStations: stats.totalStations,
            averageAQI: stats.avgAQI,
            highestAQI: stats.maxAQI,
            lowestAQI: stats.minAQI
        },
        breakdown: {
            good: stats.categories.good,
            moderate: stats.categories.moderate,
            unhealthyForSensitive: stats.categories.unhealthySensitive,
            unhealthy: stats.categories.unhealthy,
            veryUnhealthy: stats.categories.veryUnhealthy,
            hazardous: stats.categories.hazardous
        },
        stations: stats.validStations.map(station => ({
            name: station.station?.name || 'Unknown',
            aqi: parseInt(station.aqi),
            lat: station.lat,
            lon: station.lon,
            lastUpdate: station.station?.time
        }))
    };
    
    return report;
}

// Advanced analytics functions
export function calculateTrends(currentStats, previousStats) {
    if (!currentStats || !previousStats) return null;
    
    return {
        aqiChange: currentStats.avgAQI - previousStats.avgAQI,
        stationChange: currentStats.totalStations - previousStats.totalStations,
        categoryChanges: {
            good: currentStats.categories.good - previousStats.categories.good,
            moderate: currentStats.categories.moderate - previousStats.categories.moderate,
            unhealthy: currentStats.categories.unhealthy - previousStats.categories.unhealthy
        }
    };
}

export function identifyHotspots(stations, threshold = 100) {
    const validStations = stations.filter(station => 
        station.aqi !== '-' && !isNaN(parseInt(station.aqi))
    );
    
    return validStations
        .filter(station => parseInt(station.aqi) > threshold)
        .sort((a, b) => parseInt(b.aqi) - parseInt(a.aqi))
        .map(station => ({
            name: station.station?.name || 'Unknown Station',
            aqi: parseInt(station.aqi),
            coordinates: [station.lat, station.lon],
            severity: parseInt(station.aqi) > 200 ? 'high' : 'medium'
        }));
}