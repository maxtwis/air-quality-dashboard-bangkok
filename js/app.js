import { CONFIG } from './config.js';
import { fetchAirQualityData } from './api.js';
import { initializeMap, clearMarkers } from './map.js';
import { addMarkersToMap } from './markers.js';
import { updateStatisticsPanel } from './statistics.js';
import { uiManager } from './ui.js';

// Modern Air Quality Dashboard Application

class ModernAirQualityDashboard {
    constructor() {
        this.map = null;
        this.stations = [];
        this.markers = [];
        this.refreshInterval = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Modern Air Quality Dashboard...');
            
            // Show loading state
            uiManager.showLoading('stats-content', 'Initializing dashboard...');
            
            // Initialize map
            this.map = initializeMap();
            
            // Load initial data
            await this.loadData();
            
            // Set up auto-refresh
            this.setupAutoRefresh();
            
            // Mark as initialized
            this.isInitialized = true;
            
            console.log('✅ Modern dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            uiManager.showError('stats-content', `Failed to initialize: ${error.message}`);
        }
    }

    async loadData() {
        try {
            uiManager.showLoading('stats-content', 'Loading air quality data...');
            
            const stations = await fetchAirQualityData();
            console.log(`📊 Loaded ${stations.length} stations`);
            
            if (stations.length === 0) {
                uiManager.showError('stats-content', 'No air quality stations found in Bangkok area');
                return;
            }
            
            this.stations = stations;
            this.updateDisplay();
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            uiManager.showError('stats-content', `Error loading data: ${error.message}`);
            throw error;
        }
    }

    updateDisplay() {
        try {
            // Clear existing markers
            clearMarkers();
            
            // Add new modern markers
            this.markers = addMarkersToMap(this.stations);
            
            // Update main location display
            uiManager.updateMainDisplay(this.stations);
            
            // Update statistics
            updateStatisticsPanel(this.stations);
            
            console.log(`✨ Display updated with ${this.stations.length} stations`);
        } catch (error) {
            console.error('❌ Error updating display:', error);
            uiManager.showError('stats-content', 'Error updating display');
        }
    }

    async refreshData() {
        if (!this.isInitialized) {
            console.log('⏳ Dashboard not initialized, skipping refresh');
            return;
        }

        try {
            console.log('🔄 Refreshing data...');
            const updatedStations = await fetchAirQualityData();
            
            // Animate value changes if possible
            this.animateDataChanges(this.stations, updatedStations);
            
            this.stations = updatedStations;
            this.updateDisplay();
            
            console.log('✅ Data refreshed successfully');
        } catch (error) {
            console.error('❌ Error during data refresh:', error);
            // Don't show error UI for auto-refresh failures to avoid disrupting user experience
        }
    }

    animateDataChanges(oldStations, newStations) {
        // Compare old vs new data and animate significant changes
        if (!oldStations.length || !newStations.length) return;

        const oldAvg = this.calculateAverage(oldStations);
        const newAvg = this.calculateAverage(newStations);
        
        if (Math.abs(oldAvg - newAvg) > 5) {
            console.log(`📈 Significant AQI change detected: ${oldAvg} → ${newAvg}`);
            // Could add visual indication of significant changes
        }
    }

    calculateAverage(stations) {
        const valid = stations.filter(s => s.aqi !== '-' && !isNaN(parseInt(s.aqi)));
        if (valid.length === 0) return 0;
        return Math.round(valid.reduce((sum, s) => sum + parseInt(s.aqi), 0) / valid.length);
    }

    setupAutoRefresh() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Set up new interval
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, CONFIG.REFRESH_INTERVAL);
        
        console.log(`⏰ Auto-refresh set up for every ${CONFIG.REFRESH_INTERVAL / 1000 / 60} minutes`);
    }

    // Public API methods
    async forceRefresh() {
        console.log('🔄 Force refresh requested');
        await this.refreshData();
    }

    getStations() {
        return this.stations;
    }

    getStationCount() {
        return this.stations.length;
    }

    getAverageAQI() {
        return this.calculateAverage(this.stations);
    }

    getMap() {
        return this.map;
    }

    isReady() {
        return this.isInitialized;
    }

    // Analytics methods
    getStationsByCategory() {
        return this.stations.reduce((acc, station) => {
            if (station.aqi === '-' || isNaN(parseInt(station.aqi))) return acc;
            
            const aqi = parseInt(station.aqi);
            let category;
            
            if (aqi <= 50) category = 'good';
            else if (aqi <= 100) category = 'moderate';
            else if (aqi <= 150) category = 'unhealthy-sensitive';
            else if (aqi <= 200) category = 'unhealthy';
            else if (aqi <= 300) category = 'very-unhealthy';
            else category = 'hazardous';
            
            if (!acc[category]) acc[category] = [];
            acc[category].push(station);
            
            return acc;
        }, {});
    }

    getWorstStations(limit = 5) {
        return this.stations
            .filter(s => s.aqi !== '-' && !isNaN(parseInt(s.aqi)))
            .sort((a, b) => parseInt(b.aqi) - parseInt(a.aqi))
            .slice(0, limit)
            .map(station => ({
                name: station.station?.name || 'Unknown',
                aqi: parseInt(station.aqi),
                coordinates: [station.lat, station.lon]
            }));
    }

    getBestStations(limit = 5) {
        return this.stations
            .filter(s => s.aqi !== '-' && !isNaN(parseInt(s.aqi)))
            .sort((a, b) => parseInt(a.aqi) - parseInt(b.aqi))
            .slice(0, limit)
            .map(station => ({
                name: station.station?.name || 'Unknown',
                aqi: parseInt(station.aqi),
                coordinates: [station.lat, station.lon]
            }));
    }

    // Cleanup method
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        clearMarkers();
        
        console.log('🧹 Dashboard cleaned up');
    }
}

// Global dashboard instance
let dashboard = null;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🌟 Starting Modern Air Quality Dashboard...');
        
        dashboard = new ModernAirQualityDashboard();
        await dashboard.initialize();
        
        // Make dashboard available globally for debugging and external access
        window.dashboard = dashboard;
        window.refreshDashboard = () => dashboard.forceRefresh();
        
        console.log('🎉 Dashboard ready!');
        
    } catch (error) {
        console.error('💥 Failed to start dashboard:', error);
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (dashboard) {
        dashboard.destroy();
    }
});

// Handle visibility change (pause/resume when tab is hidden/visible)
document.addEventListener('visibilitychange', () => {
    if (dashboard) {
        if (document.hidden) {
            console.log('⏸️ Dashboard paused (tab hidden)');
        } else {
            console.log('▶️ Dashboard resumed (tab visible)');
            // Optionally refresh data when user returns to tab
            setTimeout(() => dashboard.refreshData(), 1000);
        }
    }
});

export { ModernAirQualityDashboard };