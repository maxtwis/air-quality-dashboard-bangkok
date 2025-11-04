import { CONFIG } from "./config.js";
import { fetchAirQualityData, enhanceStationsWithAQHI } from "./api.js";
import { fetchGoogleAirQualityData } from "./google-api.js";
import { enhanceGoogleStationsWithAQHI } from "./aqhi-google.js";
import {
  enhanceWAQIWithGooglePollutants,
  getHybridDataStatistics,
} from "./hybrid-data.js";
import { initializeMap, clearMarkers } from "./map.js";
import { addMarkersToMap } from "./markers.js";
import { updateStatisticsPanel } from "./statistics.js";
import { uiManager } from "./ui.js";

// Modern Air Quality Dashboard Application

class ModernAirQualityDashboard {
  constructor() {
    this.map = null;
    this.stations = [];
    this.stationsWithAQHI = [];
    this.markers = [];
    this.refreshInterval = null;
    this.isInitialized = false;
    this.aqhiCalculated = false;
    this.isCalculatingAQHI = false;
    this.currentDataSource = "WAQI"; // 'WAQI', 'GOOGLE', or 'HYBRID'
    this.useHybridMode = true; // Default to hybrid mode for best data quality
  }

  async initialize() {
    try {
      console.log("🚀 Initializing Modern Air Quality Dashboard...");

      // Show loading state
      uiManager.showLoading("stats-content", "Initializing dashboard...");

      // Initialize map
      this.map = initializeMap();

      // Load initial data
      await this.loadData();

      // Set up auto-refresh
      this.setupAutoRefresh();

      // Mark as initialized
      this.isInitialized = true;

      console.log("✅ Modern dashboard initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize dashboard:", error);
      uiManager.showError(
        "stats-content",
        `Failed to initialize: ${error.message}`,
      );
    }
  }

  async loadData() {
    try {
      uiManager.showLoading("stats-content", "Loading air quality data...");

      // All data comes from WAQI API
      // Google supplements are already added server-side in api/collect-data.js
      // Client just reads from the API proxy (which reads fresh WAQI data)
      const stations = await fetchAirQualityData(false);
      console.log(
        `📊 Loaded ${stations.length} stations (includes Google O3/NO2 supplements from server)`,
      );

      if (stations.length === 0) {
        uiManager.showError(
          "stats-content",
          "No air quality stations found in Bangkok area",
        );
        return;
      }

      this.stations = stations;
      this.stationsWithAQHI = []; // Clear AQHI data
      this.aqhiCalculated = false;
      this.updateDisplay();
    } catch (error) {
      console.error("❌ Error loading data:", error);
      uiManager.showError(
        "stats-content",
        `Error loading data: ${error.message}`,
      );
      throw error;
    }
  }

  updateDisplay() {
    try {
      // Clear existing markers
      clearMarkers();

      // Use appropriate station data based on current indicator
      const currentStations = this.getCurrentStations();

      // Add new modern markers
      this.markers = addMarkersToMap(currentStations);

      // Update main location display
      uiManager.updateMainDisplay(currentStations);

      // Update map legend based on current indicator
      uiManager.updateMapLegend();

      // Update statistics
      updateStatisticsPanel(currentStations);

      console.log(
        `✨ Display updated with ${currentStations.length} stations (${uiManager.currentIndicator} mode)`,
      );
    } catch (error) {
      console.error("❌ Error updating display:", error);
      uiManager.showError("stats-content", "Error updating display");
    }
  }

  getCurrentStations() {
    if (uiManager.currentIndicator === "AQHI" && this.aqhiCalculated) {
      return this.stationsWithAQHI;
    } else {
      return this.stations;
    }
  }

  async refreshData() {
    if (!this.isInitialized) {
      console.log("⏳ Dashboard not initialized, skipping refresh");
      return;
    }

    try {
      console.log("🔄 Refreshing data...");

      // Always refresh basic AQI data
      const updatedStations = await fetchAirQualityData(false);

      // Animate value changes if possible
      this.animateDataChanges(this.stations, updatedStations);

      this.stations = updatedStations;

      // If AQHI was calculated before, recalculate it
      if (this.aqhiCalculated) {
        await this.calculateAQHI();
      }

      this.updateDisplay();

      console.log("✅ Data refreshed successfully");
    } catch (error) {
      console.error("❌ Error during data refresh:", error);
      // Don't show error UI for auto-refresh failures to avoid disrupting user experience
    }
  }

  async calculateAQHI() {
    if (this.isCalculatingAQHI) {
      console.log("⏳ AQHI calculation already in progress");
      return;
    }

    try {
      this.isCalculatingAQHI = true;
      uiManager.showLoading(
        "stats-content",
        "Calculating AQHI using 3-hour averages...",
      );

      console.log("🔄 Calculating AQHI for existing stations...");

      // Use appropriate AQHI calculation based on data source
      if (this.currentDataSource === "GOOGLE") {
        this.stationsWithAQHI = await enhanceGoogleStationsWithAQHI(
          this.stations,
        );
        console.log(
          `✅ Google AQHI calculated for ${this.stationsWithAQHI.length} stations`,
        );
      } else {
        this.stationsWithAQHI = await enhanceStationsWithAQHI(this.stations);
        console.log(
          `✅ WAQI AQHI calculated for ${this.stationsWithAQHI.length} stations`,
        );
      }

      this.aqhiCalculated = true;

      // Update display if currently showing AQHI
      if (uiManager.currentIndicator === "AQHI") {
        this.updateDisplay();
      }
    } catch (error) {
      console.error("❌ Error calculating AQHI:", error);
      uiManager.showError(
        "stats-content",
        `Error calculating AQHI: ${error.message}`,
      );
    } finally {
      this.isCalculatingAQHI = false;
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
    const valid = stations.filter(
      (s) => s.aqi !== "-" && !isNaN(parseInt(s.aqi)),
    );
    if (valid.length === 0) return 0;
    return Math.round(
      valid.reduce((sum, s) => sum + parseInt(s.aqi), 0) / valid.length,
    );
  }

  setupAutoRefresh() {
    // Clear any existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Google API: No auto-refresh to minimize costs (on-demand only)
    // WAQI: Auto-refresh every 10 minutes (free tier)
    if (this.currentDataSource === "GOOGLE") {
      console.log(
        "💰 Google API: Auto-refresh disabled (on-demand only to minimize costs)",
      );
      console.log("ℹ️  Use the refresh button to manually update Google data");
      return; // No auto-refresh for Google
    }

    // Set up auto-refresh for WAQI only
    const interval = CONFIG.REFRESH_INTERVAL_WAQI;
    this.refreshInterval = setInterval(() => {
      this.refreshData();
    }, interval);

    const minutes = interval / 1000 / 60;
    console.log(
      `⏰ Auto-refresh set up for every ${minutes} minutes (${this.currentDataSource} source)`,
    );
  }

  // Public API methods
  async forceRefresh() {
    console.log("🔄 Force refresh requested");
    await this.refreshData();
  }

  async switchToIndicator(indicator) {
    console.log(`🔄 Switching to ${indicator} indicator`);

    if (indicator === "AQHI" && !this.aqhiCalculated) {
      // Calculate AQHI on-demand when user switches to AQHI tab
      await this.calculateAQHI();
    }

    // Update display with current data
    this.updateDisplay();
  }

  async switchDataSource(dataSource) {
    console.log(`🔄 Switching to ${dataSource} data source`);

    if (this.currentDataSource === dataSource) {
      console.log("ℹ️ Already using this data source");
      return;
    }

    this.currentDataSource = dataSource;
    await this.loadData();

    // Restart auto-refresh with appropriate interval for new data source
    this.setupAutoRefresh();
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
      if (station.aqi === "-" || isNaN(parseInt(station.aqi))) return acc;

      const aqi = parseInt(station.aqi);
      let category;

      if (aqi <= 25) category = "very-good";
      else if (aqi <= 50) category = "good";
      else if (aqi <= 100) category = "moderate";
      else if (aqi <= 200) category = "unhealthy";
      else category = "very-unhealthy";

      if (!acc[category]) acc[category] = [];
      acc[category].push(station);

      return acc;
    }, {});
  }

  getWorstStations(limit = 5) {
    return this.stations
      .filter((s) => s.aqi !== "-" && !isNaN(parseInt(s.aqi)))
      .sort((a, b) => parseInt(b.aqi) - parseInt(a.aqi))
      .slice(0, limit)
      .map((station) => ({
        name: station.station?.name || "Unknown",
        aqi: parseInt(station.aqi),
        coordinates: [station.lat, station.lon],
      }));
  }

  getBestStations(limit = 5) {
    return this.stations
      .filter((s) => s.aqi !== "-" && !isNaN(parseInt(s.aqi)))
      .sort((a, b) => parseInt(a.aqi) - parseInt(b.aqi))
      .slice(0, limit)
      .map((station) => ({
        name: station.station?.name || "Unknown",
        aqi: parseInt(station.aqi),
        coordinates: [station.lat, station.lon],
      }));
  }

  // Cleanup method
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    clearMarkers();

    console.log("🧹 Dashboard cleaned up");
  }
}

// Global dashboard instance
let dashboard = null;

// Initialize dashboard when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🌟 Starting Modern Air Quality Dashboard...");

    dashboard = new ModernAirQualityDashboard();
    await dashboard.initialize();

    // Make dashboard available globally for debugging and external access
    window.dashboard = dashboard;
    window.refreshDashboard = () => dashboard.forceRefresh();
    window.switchIndicator = (indicator) =>
      dashboard.switchToIndicator(indicator);
    window.switchDataSource = (dataSource) =>
      dashboard.switchDataSource(dataSource);
    window.uiManager = uiManager;

    console.log("🎉 Dashboard ready!");
  } catch (error) {
    console.error("💥 Failed to start dashboard:", error);
  }
});

// Handle page unload
window.addEventListener("beforeunload", () => {
  if (dashboard) {
    dashboard.destroy();
  }
});

// Handle visibility change (pause/resume when tab is hidden/visible)
document.addEventListener("visibilitychange", () => {
  if (dashboard) {
    if (document.hidden) {
      console.log("⏸️ Dashboard paused (tab hidden)");
    } else {
      console.log("▶️ Dashboard resumed (tab visible)");
      // Optionally refresh data when user returns to tab
      setTimeout(() => dashboard.refreshData(), 1000);
    }
  }
});

export { ModernAirQualityDashboard };
