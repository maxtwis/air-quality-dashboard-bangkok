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
        element.innerHTML = `<div class="loading">${message}</div>`;
    }
}