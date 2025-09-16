import { calculateStationStatistics, getAQIClass } from './utils.js';
import { uiManager } from './ui.js';
import { getAQHILevel, formatAQHI } from './aqhi-realistic.js';
import { calculateAQHIStatistics } from './aqhi-realistic.js';

// Modern statistics calculation and display

export function updateStatisticsPanel(stations) {
    const isAQHI = uiManager.currentIndicator === 'AQHI';
    
    if (isAQHI) {
        updateStatisticsPanelAQHI(stations);
    } else {
        updateStatisticsPanelAQI(stations);
    }
}

function updateStatisticsPanelAQI(stations) {
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
    
    console.log('AQI statistics updated');
}

function updateStatisticsPanelAQHI(stations) {
    const stats = calculateAQHIStatistics(stations);
    const statsContent = document.getElementById('stats-content');
    
    if (!statsContent) {
        console.error('Statistics content element not found');
        return;
    }
    
    if (!stats) {
        uiManager.showError('stats-content', 'No valid AQHI data available');
        return;
    }
    
    const avgLevel = getAQHILevel(stats.average);
    const maxLevel = getAQHILevel(stats.max);
    const minLevel = getAQHILevel(stats.min);
    
    // Map AQHI colors to AQI classes for consistency
    const getAQHIClass = (level) => {
        switch(level.key) {
            case 'LOW': return 'aqi-good';
            case 'MODERATE': return 'aqi-moderate';
            case 'HIGH': return 'aqi-unhealthy-sensitive';
            case 'VERY_HIGH': return 'aqi-unhealthy';
            default: return 'aqi-moderate';
        }
    };
    
    // Check average data quality with realistic approach
    let dataQualityInfo = '';
    if (stations.length > 0 && stations[0].aqhi) {
        const qualityBreakdown = {
            'excellent': stations.filter(s => s.aqhi?.dataQuality === 'excellent').length,
            'good': stations.filter(s => s.aqhi?.dataQuality === 'good').length,
            'fair': stations.filter(s => s.aqhi?.dataQuality === 'fair').length,
            'limited': stations.filter(s => s.aqhi?.dataQuality === 'limited').length,
            'estimated': stations.filter(s => s.aqhi?.calculationMethod === 'estimated').length
        };
        
        const totalDataStations = Object.values(qualityBreakdown).reduce((a, b) => a + b, 0);
        
        if (totalDataStations > 0) {
            dataQualityInfo = `
                <div class="info" style="margin-top: 12px; padding: 8px; background: var(--gray-100); border-radius: 6px; font-size: 0.875rem;">
                    <div style="font-weight: 500; margin-bottom: 4px;">📊 AQHI Data Quality:</div>
                    ${qualityBreakdown.excellent > 0 ? `<div>🎯 ${qualityBreakdown.excellent} stations with full 3+ hour average</div>` : ''}
                    ${qualityBreakdown.good > 0 ? `<div>✅ ${qualityBreakdown.good} stations with 2+ hour average</div>` : ''}
                    ${qualityBreakdown.fair > 0 ? `<div>⏳ ${qualityBreakdown.fair} stations with 1+ hour average</div>` : ''}
                    ${qualityBreakdown.limited > 0 ? `<div>🔄 ${qualityBreakdown.limited} stations building data</div>` : ''}
                    ${qualityBreakdown.estimated > 0 ? `<div>📊 ${qualityBreakdown.estimated} stations using estimation</div>` : ''}
                </div>
            `;
        }
    }
    
    // Create AQHI stats grid
    const statsHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.stationsWithData}</div>
                <div class="stat-label">Stations with Data</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQHIClass(avgLevel)}">${formatAQHI(stats.average)}</div>
                <div class="stat-label">Average AQHI</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQHIClass(maxLevel)}">${formatAQHI(stats.max)}</div>
                <div class="stat-label">Highest AQHI</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQHIClass(minLevel)}">${formatAQHI(stats.min)}</div>
                <div class="stat-label">Lowest AQHI</div>
            </div>
        </div>
        ${dataQualityInfo}
        ${stats.stationsWithPartialData > 0 ? `
            <div class="info" style="margin-top: 12px; padding: 8px; background: var(--gray-100); border-radius: 6px; font-size: 0.875rem;">
                ⚠️ ${stats.stationsWithPartialData} stations missing pollutant sensors (NO₂, O₃, or SO₂)
            </div>
        ` : ''}
    `;
    
    statsContent.innerHTML = statsHTML;
    
    // Update category breakdown for AQHI
    updateAQHICategoryBreakdown(stats.categoryCounts);
    
    console.log('AQHI statistics updated');
}

function updateAQHICategoryBreakdown(categoryCounts) {
    const categoryData = [
        { name: 'Low (1-3)', count: categoryCounts.LOW, color: '#00e400' },
        { name: 'Moderate (4-6)', count: categoryCounts.MODERATE, color: '#ffff00' },
        { name: 'High (7-10)', count: categoryCounts.HIGH, color: '#ff7e00' },
        { name: 'Very High (10+)', count: categoryCounts.VERY_HIGH, color: '#ff0000' }
    ].filter(cat => cat.count > 0);
    
    const categoryStatsElement = document.getElementById('category-stats');
    if (categoryStatsElement) {
        if (categoryData.length === 0) {
            categoryStatsElement.innerHTML = '<div class="error">No category data available</div>';
            return;
        }
        
        categoryStatsElement.innerHTML = categoryData.map(cat => `
            <div class="category-item">
                <div class="category-color" style="background-color: ${cat.color};"></div>
                <span>${cat.name}</span>
                <span class="category-count">${cat.count}</span>
            </div>
        `).join('');
    }
    
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