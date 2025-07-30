import { CONFIG } from './config.js';
import { showError, showLoading } from './utils.js';
import { fetchAirQualityData } from './api.js';
import { initializeMap, clearMarkers } from './map.js';
import { addMarkersToMap } from './markers.js';
import { updateStatisticsPanel } from './statistics.js';

// Main application logic

class AirQualityDashboard {
    constructor() {
        this.map = null;
        this.stations = [];
        this.refreshInterval = null;
    }

    async initialize() {
        try {
            console.log('Initializing Air Quality Dashboard...');
            
            // Initialize map
            this.map = initializeMap();
            
            // Load initial data
            await this.loadData();
            
            // Set up auto-refresh
            this.setupAutoRefresh();
            
            console.log('Dashboard initialized successfully');
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            showError('stats-content', `Failed to initialize dashboard: ${error.message}`);
        }
    }

    async loadData() {
        try {
            showLoading('stats-content', 'Loading air quality data...');
            
            const stations = await fetchAirQualityData();
            console.log('Stations loaded:', stations.length);
            
            if (stations.length === 0) {
                showError('stats-content', 'No air quality stations found in the Bangkok area');
                return;
            }
            
            this.stations = stations;
            this.updateDisplay();
            
        } catch (error) {
            console.error('Error loading data:', error);
            showError('stats-content', `Error loading data: ${error.message}`);
            throw error;
        }
    }

    updateDisplay() {
        // Clear existing markers
        clearMarkers();
        
        // Add new markers
        addMarkersToMap(this.stations);
        
        // Update statistics
        updateStatisticsPanel(this.stations);
        
        console.log('Display updated with', this.stations.length, 'stations');
    }

    async refreshData() {
        try {
            console.log('Refreshing data...');
            const updatedStations = await fetchAirQualityData();
            this.stations = updatedStations;
            this.updateDisplay();
            console.log('Data refreshed successfully');
        } catch (error) {
            console.error('Error during data refresh:', error);
            // Don't show error to user for auto-refresh failures
        }
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
        
        console.log(`Auto-refresh set up for every ${CONFIG.REFRESH_INTERVAL / 1000 / 60} minutes`);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        console.log('Dashboard destroyed');
    }

    // Public methods for external control
    async forceRefresh() {
        await this.refreshData();
    }

    getStations() {
        return this.stations;
    }

    getStationCount() {
        return this.stations.length;
    }
}

// Global dashboard instance
let dashboard = null;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        dashboard = new AirQualityDashboard();
        await dashboard.initialize();
        
        // Make dashboard available globally for debugging
        window.dashboard = dashboard;
        
    } catch (error) {
        console.error('Failed to start dashboard:', error);
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (dashboard) {
        dashboard.destroy();
    }
});

// Expose useful functions globally
window.refreshDashboard = () => {
    if (dashboard) {
        return dashboard.forceRefresh();
    }
};

export { AirQualityDashboard };