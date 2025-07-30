import { isValidStation, getAQIClass } from './utils.js';

// Statistics calculation and display

export function calculateStatistics(stations) {
    const validStations = stations.filter(isValidStation);
    
    if (validStations.length === 0) {
        return null;
    }
    
    const aqiValues = validStations.map(s => parseInt(s.aqi));
    const avgAQI = Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length);
    const maxAQI = Math.max(...aqiValues);
    const minAQI = Math.min(...aqiValues);
    
    // Count by category
    const categories = {
        good: aqiValues.filter(aqi => aqi <= 50).length,
        moderate: aqiValues.filter(aqi => aqi > 50 && aqi <= 100).length,
        unhealthySensitive: aqiValues.filter(aqi => aqi > 100 && aqi <= 150).length,
        unhealthy: aqiValues.filter(aqi => aqi > 150 && aqi <= 200).length,
        veryUnhealthy: aqiValues.filter(aqi => aqi > 200 && aqi <= 300).length,
        hazardous: aqiValues.filter(aqi => aqi > 300).length
    };
    
    return {
        totalStations: validStations.length,
        avgAQI,
        maxAQI,
        minAQI,
        categories
    };
}

export function createStatItem(label, value, cssClass = '') {
    return `
        <div class="stat-item">
            <div class="stat-label">${label}</div>
            <div class="stat-value ${cssClass}">${value}</div>
        </div>
    `;
}

export function updateStatisticsPanel(stations) {
    const stats = calculateStatistics(stations);
    const statsContent = document.getElementById('stats-content');
    
    if (!statsContent) {
        console.error('Statistics content element not found');
        return;
    }
    
    if (!stats) {
        statsContent.innerHTML = '<div class="error">No valid air quality data available</div>';
        return;
    }
    
    let statsHTML = '';
    
    // Basic statistics
    statsHTML += createStatItem('Total Stations', stats.totalStations);
    statsHTML += createStatItem('Average AQI', stats.avgAQI, getAQIClass(stats.avgAQI));
    statsHTML += createStatItem('Highest AQI', stats.maxAQI, getAQIClass(stats.maxAQI));
    statsHTML += createStatItem('Lowest AQI', stats.minAQI, getAQIClass(stats.minAQI));
    
    // Category breakdown
    statsHTML += createStatItem('Good Quality', `${stats.categories.good} stations`, 'aqi-good');
    statsHTML += createStatItem('Moderate Quality', `${stats.categories.moderate} stations`, 'aqi-moderate');
    
    // Only show problematic categories if they exist
    if (stats.categories.unhealthySensitive > 0) {
        statsHTML += createStatItem('Unhealthy for Sensitive', `${stats.categories.unhealthySensitive} stations`, 'aqi-unhealthy-sensitive');
    }
    
    if (stats.categories.unhealthy > 0) {
        statsHTML += createStatItem('Unhealthy', `${stats.categories.unhealthy} stations`, 'aqi-unhealthy');
    }
    
    if (stats.categories.veryUnhealthy > 0) {
        statsHTML += createStatItem('Very Unhealthy', `${stats.categories.veryUnhealthy} stations`, 'aqi-very-unhealthy');
    }
    
    if (stats.categories.hazardous > 0) {
        statsHTML += createStatItem('Hazardous', `${stats.categories.hazardous} stations`, 'aqi-hazardous');
    }
    
    // Last updated
    statsHTML += createStatItem('Last Updated', new Date().toLocaleString(), '');
    
    statsContent.innerHTML = statsHTML;
    console.log('Statistics updated');
}

export function getAQISummary(stations) {
    const stats = calculateStatistics(stations);
    if (!stats) return 'No data available';
    
    const { avgAQI, totalStations } = stats;
    let summary = `Average AQI: ${avgAQI} across ${totalStations} stations. `;
    
    if (avgAQI <= 50) {
        summary += 'Air quality is generally good.';
    } else if (avgAQI <= 100) {
        summary += 'Air quality is moderate.';
    } else if (avgAQI <= 150) {
        summary += 'Air quality may be unhealthy for sensitive groups.';
    } else {
        summary += 'Air quality is concerning.';
    }
    
    return summary;
}