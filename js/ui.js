import { getAQILevel, getAQIClass, formatDateTime } from './utils.js';
import { fetchStationDetails } from './api.js';
import { POLLUTANTS, WEATHER_PARAMS, CONFIG, AQI_LEVELS } from './config.js';
import { getAQHILevel, formatAQHI, AQHI_LEVELS } from './aqhi-supabase.js';
import { calculateAQHIStatistics } from './aqhi-supabase.js';
import { healthRecommendations } from './health-recommendations.js';
import { convertStationToRawConcentrations, getRawConcentration } from './aqi-to-concentration.js';

// UI management functions for the modern dashboard

export class UIManager {
  constructor() {
    this.currentIndicator = CONFIG.DEFAULT_INDICATOR;
    this.setupEventListeners();
    this.currentStationDetails = null;
    this.enhancedStationData = null;
  }

  setupEventListeners() {
    // Indicator toggle
    const indicatorRadios = document.querySelectorAll(
      'input[name="indicator"]',
    );
    indicatorRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const indicator = e.target.value;
        this.currentIndicator = indicator;

        // Update map legend immediately
        this.updateMapLegend();
        // Use smart indicator switching instead of full refresh
        window.switchIndicator && window.switchIndicator(indicator);
      });
    });

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
      if (
        stationInfo &&
        stationInfo.style.display === 'block' &&
        !stationInfo.contains(e.target) &&
        !e.target.closest('.leaflet-marker-icon')
      ) {
        this.closeStationInfo();
      }
    });
  }

  // Update main location display
  updateMainDisplay(stations) {
    if (this.currentIndicator === 'AQHI') {
      this.updateMainDisplayAQHI(stations);
    } else if (this.currentIndicator === 'PM25_AQHI') {
      this.updateMainDisplayPM25AQHI(stations);
    } else {
      this.updateMainDisplayAQI(stations);
    }
    // Update weather info
    this.updateWeatherInfo();
  }

  updateMainDisplayAQI(stations) {
    const validStations = stations.filter(
      (s) => s.aqi !== '-' && !isNaN(parseInt(s.aqi)),
    );
    if (validStations.length === 0) return;

    const aqiValues = validStations.map((s) => parseInt(s.aqi));
    const avgAQI = Math.round(
      aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length,
    );
    const aqiLevel = getAQILevel(avgAQI);
    const aqiClass = getAQIClass(avgAQI);

    // Update main display
    const mainValue = document.getElementById('main-aqi-value');
    const mainCategory = document.getElementById('main-aqi-category');
    const mainDescription = document.getElementById('main-aqi-description');
    const mainCircle = document.getElementById('main-aqi-circle');
    const mainLabel = document.querySelector('.aqi-label');

    if (mainValue) mainValue.textContent = avgAQI;
    if (mainCategory) mainCategory.textContent = aqiLevel.label;
    if (mainDescription) mainDescription.textContent = aqiLevel.description;
    if (mainCircle) mainCircle.className = `aqi-circle ${aqiClass}`;
    if (mainLabel) mainLabel.textContent = 'US AQI';
  }

  updateMainDisplayAQHI(stations) {
    const stats = calculateAQHIStatistics(stations);
    if (!stats) return;

    const aqhiLevel = getAQHILevel(stats.average);

    // Map AQHI colors to existing AQI classes
    const getAQHIClass = (level) => {
      switch (level.key) {
        case 'LOW':
          return 'aqi-good';
        case 'MODERATE':
          return 'aqi-moderate';
        case 'HIGH':
          return 'aqi-unhealthy-sensitive';
        case 'VERY_HIGH':
          return 'aqi-unhealthy';
        default:
          return 'aqi-moderate';
      }
    };

    // Update main display
    const mainValue = document.getElementById('main-aqi-value');
    const mainCategory = document.getElementById('main-aqi-category');
    const mainDescription = document.getElementById('main-aqi-description');
    const mainCircle = document.getElementById('main-aqi-circle');
    const mainLabel = document.querySelector('.aqi-label');

    if (mainValue) mainValue.textContent = formatAQHI(stats.average);
    if (mainCategory) mainCategory.textContent = aqhiLevel.label;
    if (mainDescription) {
      // Check data quality for AQHI with realistic approach
      let dataQualityNote = '';
      if (stations.length > 0 && stations[0].aqhi) {
        const avgTimeSpan =
          stations.reduce((sum, s) => sum + (s.aqhi?.timeSpanHours || 0), 0) /
          stations.length;
        const commonMethod = stations[0].aqhi?.calculationMethod || 'current';

        if (commonMethod === 'estimated') {
          dataQualityNote = ' (Estimated from current readings)';
        } else if (avgTimeSpan < 1) {
          dataQualityNote = ' (Building moving average...)';
        } else if (avgTimeSpan < 3) {
          dataQualityNote = ` (${avgTimeSpan.toFixed(1)}h average)`;
        }
      }
      mainDescription.textContent = aqhiLevel.description + dataQualityNote;
    }
    if (mainCircle)
      mainCircle.className = `aqi-circle ${getAQHIClass(aqhiLevel)}`;
    if (mainLabel) mainLabel.textContent = 'AQHI';
  }

  updateMainDisplayPM25AQHI(stations) {
    // Calculate PM2.5-only AQHI statistics
    const validStations = stations.filter(
      (s) => s.pm25_aqhi && s.pm25_aqhi.value !== undefined,
    );
    if (validStations.length === 0) return;

    const aqhiValues = validStations.map((s) => s.pm25_aqhi.value);
    const avgAQHI = Math.round(
      aqhiValues.reduce((a, b) => a + b, 0) / aqhiValues.length,
    );
    const aqhiLevel = getAQHILevel(avgAQHI);

    // Map AQHI colors to existing AQI classes
    const getAQHIClass = (level) => {
      switch (level.key) {
        case 'LOW':
          return 'aqi-good';
        case 'MODERATE':
          return 'aqi-moderate';
        case 'HIGH':
          return 'aqi-unhealthy-sensitive';
        case 'VERY_HIGH':
          return 'aqi-unhealthy';
        default:
          return 'aqi-moderate';
      }
    };

    // Update main display
    const mainValue = document.getElementById('main-aqi-value');
    const mainCategory = document.getElementById('main-aqi-category');
    const mainDescription = document.getElementById('main-aqi-description');
    const mainCircle = document.getElementById('main-aqi-circle');
    const mainLabel = document.querySelector('.aqi-label');

    if (mainValue) mainValue.textContent = formatAQHI(avgAQHI);
    if (mainCategory) mainCategory.textContent = aqhiLevel.label;
    if (mainDescription) {
      // Check data quality for PM2.5 AQHI
      let dataQualityNote = '';
      if (validStations.length > 0 && validStations[0].pm25_aqhi) {
        const avgTimeSpan =
          validStations.reduce(
            (sum, s) => sum + (s.pm25_aqhi?.timeSpanHours || 0),
            0,
          ) / validStations.length;
        const commonMethod =
          validStations[0].pm25_aqhi?.calculationMethod || 'current';

        if (commonMethod === 'current') {
          dataQualityNote = ' (Current readings, NO₂ & O₃ = 0)';
        } else if (avgTimeSpan < 1) {
          dataQualityNote = ' (Building 3h average, NO₂ & O₃ = 0)';
        } else if (avgTimeSpan < 3) {
          dataQualityNote = ` (${avgTimeSpan.toFixed(1)}h average, NO₂ & O₃ = 0)`;
        } else {
          dataQualityNote = ' (3h average, NO₂ & O₃ = 0)';
        }
      } else {
        dataQualityNote = ' (PM2.5-only AQHI, NO₂ & O₃ = 0)';
      }
      mainDescription.textContent = aqhiLevel.description + dataQualityNote;
    }
    if (mainCircle)
      mainCircle.className = `aqi-circle ${getAQHIClass(aqhiLevel)}`;
    if (mainLabel) mainLabel.textContent = 'PM2.5 AQHI';
  }


  // Update map legend based on current indicator
  updateMapLegend() {
    const legendElement = document.querySelector('.map-legend');
    if (!legendElement) return;

    const legendTitle = legendElement.querySelector('.legend-title');
    const legendItems = legendElement.querySelector('.legend-items');

    if (this.currentIndicator === 'AQHI') {
      // Update to AQHI legend
      if (legendTitle) {
        legendTitle.textContent = 'Air Quality Health Index (AQHI)';
      }

      if (legendItems) {
        legendItems.innerHTML = `
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQHI_LEVELS.LOW.color};"></div>
                        <span>Low (1-3)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQHI_LEVELS.MODERATE.color};"></div>
                        <span>Moderate (4-6)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQHI_LEVELS.HIGH.color};"></div>
                        <span>High (7-10)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQHI_LEVELS.VERY_HIGH.color};"></div>
                        <span>Very High (11+)</span>
                    </div>
                `;
      }
    } else if (this.currentIndicator === 'PM25_AQHI') {
      // Update to PM2.5 AQHI legend
      if (legendTitle) {
        legendTitle.textContent = 'PM2.5-only AQHI (NO₂ & O₃ = 0)';
      }

      if (legendItems) {
        legendItems.innerHTML = `
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQHI_LEVELS.LOW.color};"></div>
                        <span>Low (1-3)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQHI_LEVELS.MODERATE.color};"></div>
                        <span>Moderate (4-6)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQHI_LEVELS.HIGH.color};"></div>
                        <span>High (7-10)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQHI_LEVELS.VERY_HIGH.color};"></div>
                        <span>Very High (11+)</span>
                    </div>
                `;
      }
    } else if (this.currentIndicator === 'AQHI_CANADA') {
      // Update to Canadian AQHI legend
      if (legendTitle) {
        legendTitle.textContent = 'Canadian Air Quality Health Index';
      }

      if (legendItems) {
        // Import Canadian AQHI levels dynamically
        import('./aqhi-canada.js').then(({ CANADIAN_AQHI_LEVELS }) => {
          legendItems.innerHTML = `
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: ${CANADIAN_AQHI_LEVELS.LOW.color};"></div>
                            <span>Low Risk (1-3)</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: ${CANADIAN_AQHI_LEVELS.MODERATE.color};"></div>
                            <span>Moderate Risk (4-6)</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: ${CANADIAN_AQHI_LEVELS.HIGH.color};"></div>
                            <span>High Risk (7-10)</span>
                        </div>
                        <div class="legend-item">
                            <div class="legend-dot" style="background-color: ${CANADIAN_AQHI_LEVELS.VERY_HIGH.color};"></div>
                            <span>Very High Risk (11+)</span>
                        </div>
                    `;
        });
      }
    } else {
      // Update to AQI legend
      if (legendTitle) {
        legendTitle.textContent = 'Air Quality Index (US AQI)';
      }

      if (legendItems) {
        legendItems.innerHTML = `
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQI_LEVELS.GOOD.color};"></div>
                        <span>Good (0-50)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQI_LEVELS.MODERATE.color};"></div>
                        <span>Moderate (51-100)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQI_LEVELS.UNHEALTHY_SENSITIVE.color};"></div>
                        <span>Unhealthy for Sensitive (101-150)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQI_LEVELS.UNHEALTHY.color};"></div>
                        <span>Unhealthy (151-200)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQI_LEVELS.VERY_UNHEALTHY.color};"></div>
                        <span>Very Unhealthy (201-300)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background-color: ${AQI_LEVELS.HAZARDOUS.color};"></div>
                        <span>Hazardous (301+)</span>
                    </div>
                `;
      }
    }
  }

  updateWeatherInfo() {
    const elements = {
      temperature: '28°C',
      humidity: '65%',
      wind: '12 km/h',
      'last-update': new Date().toLocaleTimeString(),
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

  // Helper method to get AQHI CSS class
  getAQHIClass(aqhi) {
    if (aqhi <= 3) return 'good';
    if (aqhi <= 6) return 'moderate';
    if (aqhi <= 10) return 'unhealthy-sensitive';
    return 'hazardous';
  }

  // Enhanced station information panel with pollutant data
  async showStationInfo(station) {
    const isAQHI = this.currentIndicator === 'AQHI';
    const isPM25AQHI = this.currentIndicator === 'PM25_AQHI';
    let value, level, cssClass, label;

    if (isAQHI && station.aqhi) {
      // Use AQHI data
      value = formatAQHI(station.aqhi.value);
      level = station.aqhi.level;
      cssClass = this.getAQHIClass(station.aqhi.value);
      label = level.label;
    } else if (isPM25AQHI && station.pm25_aqhi) {
      // Use PM2.5-only AQHI data
      value = formatAQHI(station.pm25_aqhi.value);
      level = station.pm25_aqhi.level;
      cssClass = this.getAQHIClass(station.pm25_aqhi.value);
      label = level.label;
    } else {
      // Use AQI data
      const aqi = parseInt(station.aqi);
      value = aqi;
      level = getAQILevel(aqi);
      cssClass = getAQIClass(aqi);
      label = level.label;
    }

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
      stationAqiValue.textContent = value;
    }

    if (stationCategory) {
      stationCategory.textContent = label;
      stationCategory.className = `station-category text-${cssClass}`;
    }

    if (stationTime) {
      const timeStr = station.station?.time
        ? formatDateTime(station.station.time)
        : 'Unknown';
      stationTime.textContent = `Last updated: ${timeStr}`;
    }

    if (stationAqiCircle) {
      stationAqiCircle.className = `station-aqi-circle ${cssClass}`;
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
        this.enhancedStationData = station; // Store enhanced station data with AQHI

        // If in AQHI mode, try to get 3-hour averages for display
        let averageData = null;
        if (isAQHI && station.aqhi) {
          try {
            // Import supabaseAQHI to get 3-hour averages
            const { supabaseAQHI } = await import('./aqhi-supabase.js');
            averageData = await supabaseAQHI.get3HourAverages(
              station.uid?.toString(),
            );
          } catch (avgError) {
            console.warn('Could not fetch 3-hour averages:', avgError);
          }
        } else if (isPM25AQHI && station.pm25_aqhi) {
          try {
            // Import PM2.5-only AQHI to get PM2.5 3-hour averages
            const { pm25OnlySupabaseAQHI } = await import(
              './aqhi-pm25-only.js'
            );
            averageData = await pm25OnlySupabaseAQHI.get3HourPM25Averages(
              station.uid?.toString(),
            );
            // Don't force NO2 and O3 - let the panel show only real pollutants
          } catch (avgError) {
            console.warn(
              'Could not fetch PM2.5-only 3-hour averages:',
              avgError,
            );
          }
        }

        await this.updateStationInfoWithDetails(
          detailsData,
          isAQHI || isPM25AQHI,
          averageData,
          null,
        );
      } else {
        // Fallback for AQI mode - use basic station data if detailed fetch fails
        if (!isAnyAQHI) {
          console.warn('⚠️ Detailed station data unavailable, using basic station data for AQI mode');
          await this.updateStationInfoWithDetails(
            { iaqi: { pm25: { v: station.aqi || 0 } } }, // Mock structure with basic AQI
            false, // Not AQHI mode
            null, // No averageData
            null, // No openWeatherData
          );
        } else {
          this.showErrorInStationInfo('Could not load detailed data');
        }
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

  async updateStationInfoWithDetails(
    detailsData,
    isAQHI = false,
    averageData = null,
    openWeatherData = null,
  ) {
    // Define indicator variables based on current mode
    const isPM25AQHI = this.currentIndicator === 'PM25_AQHI';

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

      // Use 3-hour averages if in any AQHI mode and available, otherwise use API data
      const isAnyAQHI = isAQHI || isPM25AQHI;
      const dataSource = isAnyAQHI && averageData ? averageData : detailsData.iaqi;

      // Determine the correct data label based on mode and data availability
      let dataLabel = 'Current';
      if (isAnyAQHI && averageData) {
        dataLabel = '3-Hour Average (μg/m³)';
      } else if (isAnyAQHI) {
        dataLabel = 'Current (converted to μg/m³)';
      } else {
        dataLabel = 'Current (μg/m³)';
      }

      if (isAnyAQHI && averageData) {
        // For AQHI mode with averages, process the average data structure
        console.log('🔄 AQHI mode: Using 3-hour averages (already in μg/m³)');
        const hasGoogleData = averageData.googleReadings > 0;

        Object.entries(averageData).forEach(([key, value]) => {
          if (POLLUTANTS[key] && value !== null && value !== undefined) {
            // Add asterisk (*) only when Google actually supplemented (WAQI didn't have it)
            const sourceKey = `${key}_source`;
            const isGoogleSupplemented = averageData[sourceKey] === 'GOOGLE';
            const nameWithMarker = isGoogleSupplemented
              ? `${POLLUTANTS[key].name}*`
              : POLLUTANTS[key].name;

            pollutantData.push({
              key,
              config: {
                ...POLLUTANTS[key],
                name: nameWithMarker,
                unit: key === 'co' ? 'mg/m³' : 'μg/m³' // Ensure proper units are shown
              },
              value: Math.round(value * 10) / 10, // Round to 1 decimal place
              isConverted: true,
              isGoogleSupplemented
            });
            console.log(`   ✅ ${key.toUpperCase()}: ${Math.round(value * 10) / 10} ${key === 'co' ? 'mg/m³' : 'μg/m³'} (3h avg)${isGoogleSupplemented ? ' *Google' : ''}`);
          }
        });
      } else {
        // Standard processing for API data - CONVERT AQI TO CONCENTRATIONS
        console.log(`🔄 Detail panel mode: ${isAnyAQHI ? 'AQHI' : 'AQI'} - Converting AQI values to concentrations...`);
        const convertedStation = convertStationToRawConcentrations(detailsData);

        Object.entries(detailsData.iaqi).forEach(([key, data]) => {
          if (POLLUTANTS[key]) {
            // Use converted concentration if available, otherwise fall back to AQI
            const rawConcentration = getRawConcentration(convertedStation, key);

            if (rawConcentration !== null) {
              // Show converted concentration in μg/m³
              pollutantData.push({
                key,
                config: {
                  ...POLLUTANTS[key],
                  unit: key === 'co' ? 'mg/m³' : 'μg/m³' // CO is in mg/m³, others in μg/m³
                },
                value: Math.round(rawConcentration * 10) / 10,
                isConverted: true
              });
              console.log(`   ✅ ${key.toUpperCase()}: ${data.v} AQI → ${rawConcentration} ${key === 'co' ? 'mg/m³' : 'μg/m³'}`);
            } else {
              // Fallback to AQI if conversion failed
              pollutantData.push({
                key,
                config: { ...POLLUTANTS[key], unit: 'AQI' },
                value: data.v,
                isConverted: false
              });
              console.log(`   ⚠️  ${key.toUpperCase()}: ${data.v} AQI (conversion failed)`);
            }
          } else if (WEATHER_PARAMS[key]) {
            weatherData.push({
              key,
              config: WEATHER_PARAMS[key],
              value: data.v,
            });
          }
        });
      }


      // Generate pollutant HTML
      if (pollutantData.length > 0) {
        const hasGoogleSupplements = pollutantData.some(item => item.isGoogleSupplemented);
        const footnote = hasGoogleSupplements
          ? `<div style="font-size: 0.7rem; color: var(--gray-500); margin-top: 8px; font-style: italic;">
               * Supplemented by Google Air Quality API
             </div>`
          : '';

        pollutantHTML = `
                    <div class="pollutant-section">
                        <h4 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 12px; color: var(--gray-700);">
                            🌫️ Pollutants (${dataLabel})
                        </h4>
                        <div class="pollutant-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            ${pollutantData
                              .map(
                                (item) => `
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
                            `,
                              )
                              .join('')}
                        </div>
                        ${footnote}
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
                            ${weatherData
                              .map(
                                (item) => `
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
                            `,
                              )
                              .join('')}
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
                        ${detailsData.attributions
                          .map(
                            (attr) => `
                            <a href="${attr.url}" target="_blank" style="color: var(--primary-color); text-decoration: none;">
                                ${attr.name}
                            </a>
                        `,
                          )
                          .join(' • ')}
                    </div>
                </div>
            `;
    }

    // Generate health recommendations HTML
    let healthHTML = '';
    if (isAQHI && this.enhancedStationData) {
      healthHTML = await this.generateHealthRecommendationsHTML(
        this.enhancedStationData,
      );
    }

    container.innerHTML =
      pollutantHTML + weatherHTML + healthHTML + attributionHTML;
  }

  // Generate health recommendations HTML section
  async generateHealthRecommendationsHTML(station) {
    try {
      // Get AQHI value from station data - use displayed value for consistency
      const aqhiValue = station.aqhi?.displayValue || station.aqhi?.value || 0;

      if (aqhiValue === 0 || aqhiValue === '-') return '';

      // Load recommendations if not loaded
      await healthRecommendations.loadRecommendations();
      // Convert "15+" to 15 for numerical processing
      const numericAqhiValue =
        typeof aqhiValue === 'string' && aqhiValue.includes('+')
          ? parseInt(aqhiValue.replace('+', ''))
          : aqhiValue;

      const groupedRecs =
        healthRecommendations.getGroupedRecommendations(numericAqhiValue);

      if (!groupedRecs || Object.keys(groupedRecs).length === 0) {
        return '';
      }

      let healthHTML = `
                <div class="health-recommendations-section" style="margin-top: 16px;">
                    <h4 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 12px; color: var(--gray-700);">
                        🏥 Health Recommendations
                    </h4>
            `;

      // Add population group selector icons (like Google Maps)
      const allGroups = [];
      Object.entries(groupedRecs).forEach(([type, recommendations]) => {
        recommendations.forEach((rec) => {
          allGroups.push({
            type,
            description: rec.type_description,
            recommendation: rec.health_recommendation,
            icon: healthRecommendations.getGroupIcon(
              type,
              rec.type_description,
            ),
            shortName: healthRecommendations.getShortDescription(
              rec.type_description,
            ),
          });
        });
      });

      if (allGroups.length > 0) {
        // Population group icons bar (horizontal scrollable like Google Maps)
        healthHTML += `
                    <div class="population-groups" style="
                        display: flex;
                        gap: 8px;
                        margin-bottom: 12px;
                        overflow-x: auto;
                        padding-bottom: 4px;
                    ">
                `;

        allGroups.forEach((group, index) => {
          const isFirst = index === 0;
          healthHTML += `
                        <button class="population-group-btn"
                                data-group-index="${index}"
                                style="
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    padding: 0;
                                    border: 2px solid ${isFirst ? 'var(--primary-color)' : 'var(--gray-300)'};
                                    border-radius: 50%;
                                    background: ${isFirst ? 'var(--primary-color)' : 'white'};
                                    color: ${isFirst ? 'white' : 'var(--gray-600)'};
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                    width: 56px;
                                    height: 56px;
                                    min-width: 56px;
                                    max-width: 56px;
                                    flex-shrink: 0;
                                    box-sizing: border-box;
                                "
                                onclick="window.uiManager.selectPopulationGroup(${index})">
                            <i class="material-icons" style="font-size: 24px; line-height: 1; margin: 0;">${group.icon}</i>
                        </button>
                    `;
        });

        healthHTML += `</div>`;

        // Recommendation text (initially shows first group)
        healthHTML += `
                    <div id="health-recommendation-text" style="
                        background: var(--gray-50);
                        padding: 12px;
                        border-radius: 8px;
                        border-left: 4px solid var(--primary-color);
                        font-size: 0.875rem;
                        line-height: 1.5;
                    ">
                        <div style="font-weight: 600; margin-bottom: 6px; color: var(--gray-700);">
                            ${allGroups[0]?.shortName}
                        </div>
                        <div style="color: var(--gray-600);">
                            ${allGroups[0]?.recommendation}
                        </div>
                    </div>
                `;

        // Store groups data for interaction
        this.currentHealthGroups = allGroups;
      }

      healthHTML += `</div>`;
      return healthHTML;
    } catch (error) {
      console.error('Error generating health recommendations:', error);
      return '';
    }
  }

  // Handle population group selection
  selectPopulationGroup(groupIndex) {
    if (!this.currentHealthGroups || !this.currentHealthGroups[groupIndex]) {
      return;
    }

    // Update button states
    const buttons = document.querySelectorAll('.population-group-btn');
    buttons.forEach((btn, index) => {
      const isSelected = index === groupIndex;
      btn.style.border = `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--gray-300)'}`;
      btn.style.background = isSelected ? 'var(--primary-color)' : 'white';
      btn.style.color = isSelected ? 'white' : 'var(--gray-600)';
    });

    // Update recommendation text
    const textElement = document.getElementById('health-recommendation-text');
    if (textElement) {
      const group = this.currentHealthGroups[groupIndex];
      textElement.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 6px; color: var(--gray-700);">
                    ${group.shortName}
                </div>
                <div style="color: var(--gray-600);">
                    ${group.recommendation}
                </div>
            `;
    }
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
      document.documentElement.requestFullscreen().catch((err) => {
        console.log('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
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
      {
        name: 'Unhealthy for Sensitive',
        count: categories.unhealthySensitive,
        color: '#f97316',
      },
      { name: 'Unhealthy', count: categories.unhealthy, color: '#ef4444' },
      {
        name: 'Very Unhealthy',
        count: categories.veryUnhealthy,
        color: '#8b5cf6',
      },
      { name: 'Hazardous', count: categories.hazardous, color: '#6b7280' },
    ].filter((cat) => cat.count > 0);

    const categoryStatsElement = document.getElementById('category-stats');
    if (categoryStatsElement) {
      if (categoryData.length === 0) {
        categoryStatsElement.innerHTML =
          '<div class="error">No category data available</div>';
        return;
      }

      categoryStatsElement.innerHTML = categoryData
        .map(
          (cat) => `
                <div class="category-item">
                    <div class="category-color" style="background-color: ${cat.color};"></div>
                    <span>${cat.name}</span>
                    <span class="category-count">${cat.count}</span>
                </div>
            `,
        )
        .join('');
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
