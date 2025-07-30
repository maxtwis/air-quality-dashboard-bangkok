import { getAQILevel, getAQIClass, formatDateTime } from './utils.js';
import { fetchStationDetails } from './api.js';
import { POLLUTANTS, WEATHER_PARAMS } from './config.js';

// UI management functions for the modern dashboard

export class UIManager {
    constructor() {
        this.setupEventListeners();
        this.currentStationDetails = null;
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

    // Enhanced station information panel with pollutant data
    async showStationInfo(station) {
        const aqi = parseInt(station.aqi);
        const aqiLevel = getAQILevel(aqi);
        const aqiClass = getAQIClass(aqi);
        
        // Update basic station info
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

        // Show the panel first
        const stationInfo = document.getElementById('station-info');
        if (stationInfo) {
            stationInfo.style.display = 'block';
        }

        // Fetch and display detailed pollutant data
        this.showLoadingInStationInfo();
        
        try {
            const detailsData = await fetchStationDetails(station.uid);
            if (detailsData) {
                this.currentStationDetails = detailsData;
                this.updateStationInfoWithDetails(detailsData);
            } else {
                this.showErrorInStationInfo('Could not load detailed data');
            }
        } catch (error) {
            console.error('Error loading station details:', error);
            this.showErrorInStationInfo('Error loading details');
        }
    }

    showLoadingInStationInfo() {
        // Add loading indicator to station info panel
        let existingDetails = document.getElementById('station-details-container');
        if (!existingDetails) {
            existingDetails = document.createElement('div');
            existingDetails.id = 'station-details-container';
            document.getElementById('station-info').appendChild(existingDetails);
        }
        
        existingDetails.innerHTML = `
            <div class="loading" style="padding: 20px;">
                <div class="loading-spinner"></div>
                Loading detailed data...
            </div>
        `;
    }

    showErrorInStationInfo(message) {
        const container = document.getElementById('station-details-container');
        if (container) {
            container.innerHTML = `
                <div class="error" style="margin-top: 16px; padding: 12px; font-size: 0.875rem;">
                    ${message}
                </div>
            `;
        }
    }

    updateStationInfoWithDetails(detailsData) {
        let container = document.getElementById('station-details-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'station-details-container';
            document.getElementById('station-info').appendChild(container);
        }

        let pollutantHTML = '';
        let weatherHTML = '';

        // Process pollutant data
        if (detailsData.iaqi) {
            const pollutantData = [];
            const weatherData = [];

            Object.entries(detailsData.iaqi).forEach(([key, data]) => {
                if (POLLUTANTS[key]) {
                    pollutantData.push({
                        key,
                        config: POLLUTANTS[key],
                        value: data.v
                    });
                } else if (WEATHER_PARAMS[key]) {
                    weatherData.push({
                        key,
                        config: WEATHER_PARAMS[key],
                        value: data.v
                    });
                }
            });

            // Generate pollutant HTML
            if (pollutantData.length > 0) {
                pollutantHTML = `
                    <div class="pollutant-section">
                        <h4 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 12px; color: var(--gray-700);">
                            🌫️ Pollutants
                        </h4>
                        <div class="pollutant-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            ${pollutantData.map(item => `
                                <div class="pollutant-item" style="
                                    background: var(--gray-50);
                                    padding: 8px;
                                    border-radius: 6px;
                                    border-left: 3px solid ${item.config.color};
                                ">
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <span style="font-size: 0.75rem;">${item.config.icon}</span>
                                        <span style="font-size: 0.75rem; font-weight: 500;">${item.config.name}</span>
                                    </div>
                                    <div style="font-size: 0.875rem; font-weight: 600; color: ${item.config.color};">
                                        ${item.value} ${item.config.unit}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Generate weather HTML
            if (weatherData.length > 0) {
                weatherHTML = `
                    <div class="weather-section" style="margin-top: 16px;">
                        <h4 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 12px; color: var(--gray-700);">
                            🌤️ Weather
                        </h4>
                        <div class="weather-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            ${weatherData.map(item => `
                                <div class="weather-item" style="
                                    background: var(--gray-50);
                                    padding: 8px;
                                    border-radius: 6px;
                                ">
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <span style="font-size: 0.75rem;">${item.config.icon}</span>
                                        <span style="font-size: 0.75rem; font-weight: 500;">${item.config.name}</span>
                                    </div>
                                    <div style="font-size: 0.875rem; font-weight: 600; color: var(--gray-700);">
                                        ${item.value}${item.config.unit}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        // Add attribution if available
        let attributionHTML = '';
        if (detailsData.attributions && detailsData.attributions.length > 0) {
            attributionHTML = `
                <div class="attribution-section" style="margin-top: 16px;">
                    <h4 style="font-size: 0.75rem; font-weight: 500; margin-bottom: 8px; color: var(--gray-600);">
                        Data Sources
                    </h4>
                    <div style="font-size: 0.7rem; color: var(--gray-500);">
                        ${detailsData.attributions.map(attr => `
                            <a href="${attr.url}" target="_blank" style="color: var(--primary-color); text-decoration: none;">
                                ${attr.name}
                            </a>
                        `).join(' • ')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = pollutantHTML + weatherHTML + attributionHTML;
    }

    // Close station information panel
    closeStationInfo() {
        const stationInfo = document.getElementById('station-info');
        if (stationInfo) {
            stationInfo.style.display = 'none';
        }
        this.currentStationDetails = null;
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