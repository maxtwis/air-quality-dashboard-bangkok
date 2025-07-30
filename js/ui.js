import { getAQILevel, getAQIClass, formatDateTime } from './utils.js';

// UI management functions for the modern dashboard

export class UIManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                window.refreshDashboard && window.refreshDashboard();
            });
        }

        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', this.toggleFullscreen);
        }

        // Close station info button
        const closeBtn = document.getElementById('close-station-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.closeStationInfo);
        }

        // Close station info when clicking outside
        document.addEventListener('click', (e) => {
            const stationInfo = document.getElementById('station-info');
            if (stationInfo && 
                stationInfo.style.display === 'block' && 
                !stationInfo.contains(e.target) && 
                !e.target.closest('.leaflet-marker-icon')) {
                this.closeStationInfo();
            }
        });
    }

    // Update main location display
    updateMainDisplay(stations) {
        const validStations = stations.filter(s => s.aqi !== '-' && !isNaN(parseInt(s.aqi)));
        if (validStations.length === 0) return;

        const aqiValues = validStations.map(s => parseInt(s.aqi));
        const avgAQI = Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length);
        const aqiLevel = getAQILevel(avgAQI);
        const aqiClass = getAQIClass(avgAQI);

        // Update main AQI display
        const mainAqiValue = document.getElementById('main-aqi-value');
        const mainAqiCategory = document.getElementById('main-aqi-category');
        const mainAqiDescription = document.getElementById('main-aqi-description');
        const mainAqiCircle = document.getElementById('main-aqi-circle');

        if (mainAqiValue) mainAqiValue.textContent = avgAQI;
        if (mainAqiCategory) mainAqiCategory.textContent = aqiLevel.label;
        if (mainAqiDescription) mainAqiDescription.textContent = aqiLevel.description;
        if (mainAqiCircle) mainAqiCircle.className = `aqi-circle ${aqiClass}`;

        // Update weather info (mock data for now)
        this.updateWeatherInfo();
    }

    updateWeatherInfo() {
        const elements = {
            temperature: '28°C',
            humidity: '65%',
            wind: '12 km/h',
            'last-update': new Date().toLocaleTimeString()
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    // Show station information panel
    showStationInfo(station) {
        const aqi = parseInt(station.aqi);
        const aqiLevel = getAQILevel(aqi);
        const aqiClass = getAQIClass(aqi);
        
        // Update station info panel
        const stationName = document.getElementById('station-name');
        const stationAqiValue = document.getElementById('station-aqi-value');
        const stationCategory = document.getElementById('station-category');
        const stationTime = document.getElementById('station-time');
        const stationAqiCircle = document.getElementById('station-aqi-circle');

        if (stationName) {
            stationName.textContent = station.station?.name || 'Unknown Station';
        }
        
        if (stationAqiValue) {
            stationAqiValue.textContent = aqi;
        }
        
        if (stationCategory) {
            stationCategory.textContent = aqiLevel.label;
            stationCategory.className = `station-category text-${aqiClass}`;
        }
        
        if (stationTime) {
            const timeStr = station.station?.time ? 
                formatDateTime(station.station.time) : 'Unknown';
            stationTime.textContent = `Last updated: ${timeStr}`;
        }
        
        if (stationAqiCircle) {
            stationAqiCircle.className = `station-aqi-circle ${aqiClass}`;
        }

        // Show the panel
        const stationInfo = document.getElementById('station-info');
        if (stationInfo) {
            stationInfo.style.display = 'block';
        }
    }

    // Close station information panel
    closeStationInfo() {
        const stationInfo = document.getElementById('station-info');
        if (stationInfo) {
            stationInfo.style.display = 'none';
        }
    }

    // Toggle fullscreen mode
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.log('Error attempting to exit fullscreen:', err);
            });
        }
    }

    // Show loading state
    showLoading(elementId, message = 'Loading...') {
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

    // Show error state
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="error">
                    ${message}
                </div>
            `;
        }
    }

    // Update category breakdown
    updateCategoryBreakdown(categories) {
        const categoryData = [
            { name: 'Good', count: categories.good, color: '#10b981' },
            { name: 'Moderate', count: categories.moderate, color: '#f59e0b' },
            { name: 'Unhealthy for Sensitive', count: categories.unhealthySensitive, color: '#f97316' },
            { name: 'Unhealthy', count: categories.unhealthy, color: '#ef4444' },
            { name: 'Very Unhealthy', count: categories.veryUnhealthy, color: '#8b5cf6' },
            { name: 'Hazardous', count: categories.hazardous, color: '#6b7280' }
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
    }

    // Animate value changes
    animateValue(element, start, end, duration = 1000) {
        if (!element) return;
        
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.round(start + (end - start) * progress);
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// Export singleton instance
export const uiManager = new UIManager();