import { AQI_LEVELS } from './config.js';

// Utility functions for AQI calculations and formatting

export function getAQILevel(aqi) {
    for (const [key, level] of Object.entries(AQI_LEVELS)) {
        if (aqi <= level.max) {
            return level;
        }
    }
    return AQI_LEVELS.HAZARDOUS;
}

export function getAQIColor(aqi) {
    return getAQILevel(aqi).color;
}

export function getAQICategory(aqi) {
    return getAQILevel(aqi).label;
}

export function getAQIDescription(aqi) {
    return getAQILevel(aqi).description;
}

export function getAQIClass(aqi) {
    if (aqi <= 50) return 'aqi-good';
    if (aqi <= 100) return 'aqi-moderate';
    if (aqi <= 150) return 'aqi-unhealthy-sensitive';
    if (aqi <= 200) return 'aqi-unhealthy';
    if (aqi <= 300) return 'aqi-very-unhealthy';
    return 'aqi-hazardous';
}

export function formatBounds(bounds) {
    return `${bounds.southwest.lat},${bounds.southwest.lng},${bounds.northeast.lat},${bounds.northeast.lng}`;
}

export function isValidStation(station) {
    return station && 
           station.lat && 
           station.lon && 
           station.aqi !== '-' && 
           !isNaN(parseInt(station.aqi));
}

export function formatDateTime(dateString) {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
}

export function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="error">
                ${message}
            </div>
        `;
    }
}

export function showLoading(elementId, message = 'Loading...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                ${message}
            </div>
        `;
    }
}

// Debounce function for performance optimization
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for performance optimization
export function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Calculate statistics from station data
export function calculateStationStatistics(stations) {
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
        categories,
        validStations
    };
}