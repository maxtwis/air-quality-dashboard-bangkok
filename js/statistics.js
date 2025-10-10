import { calculateStationStatistics, getAQIClass } from './utils.js';
import { uiManager } from './ui.js';
import { getAQHILevel, formatAQHI } from './aqhi-supabase.js';
import { calculateAQHIStatistics } from './aqhi-supabase.js';

// Modern statistics calculation and display

export function updateStatisticsPanel(stations) {
  const isAQHI = uiManager.currentIndicator === 'AQHI';
  const isPM25AQHI = uiManager.currentIndicator === 'PM25_AQHI';
  const isCanadianAQHI = uiManager.currentIndicator === 'AQHI_CANADA';

  if (isAQHI) {
    updateStatisticsPanelAQHI(stations);
  } else if (isPM25AQHI) {
    updateStatisticsPanelPM25AQHI(stations);
  } else if (isCanadianAQHI) {
    updateStatisticsPanelCanadianAQHI(stations);
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

  // Check average data quality with realistic approach
  let dataQualityInfo = '';
  if (stations.length > 0 && stations[0].aqhi) {
    const qualityBreakdown = {
      excellent: stations.filter((s) => s.aqhi?.dataQuality === 'excellent')
        .length,
      good: stations.filter((s) => s.aqhi?.dataQuality === 'good').length,
      fair: stations.filter((s) => s.aqhi?.dataQuality === 'fair').length,
      enhanced: stations.filter((s) => s.aqhi?.dataQuality === 'enhanced')
        .length,
      limited: stations.filter((s) => s.aqhi?.dataQuality === 'limited').length,
      estimated: stations.filter((s) => s.aqhi?.dataQuality === 'estimated')
        .length,
    };

    const totalDataStations = Object.values(qualityBreakdown).reduce(
      (a, b) => a + b,
      0,
    );

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
        ${
          stats.stationsWithPartialData > 0
            ? `
            <div class="info" style="margin-top: 12px; padding: 8px; background: var(--gray-100); border-radius: 6px; font-size: 0.875rem;">
                ⚠️ ${stats.stationsWithPartialData} stations missing pollutant sensors (NO₂, O₃, or SO₂)
            </div>
        `
            : ''
        }
    `;

  statsContent.innerHTML = statsHTML;

  // Update category breakdown for AQHI
  updateAQHICategoryBreakdown(stats.categoryCounts);

  console.log('AQHI statistics updated');
}

function updateStatisticsPanelPM25AQHI(stations) {
  // Calculate PM2.5-only AQHI statistics
  const validStations = stations.filter(
    (s) => s.pm25_aqhi && s.pm25_aqhi.value !== undefined,
  );
  const statsContent = document.getElementById('stats-content');

  if (!statsContent) {
    console.error('Statistics content element not found');
    return;
  }

  if (validStations.length === 0) {
    uiManager.showError('stats-content', 'No valid PM2.5 AQHI data available');
    return;
  }

  // Calculate statistics for PM2.5 AQHI
  const aqhiValues = validStations.map((s) => s.pm25_aqhi.value);
  const avgAQHI = Math.round(
    aqhiValues.reduce((a, b) => a + b, 0) / aqhiValues.length,
  );
  const maxAQHI = Math.max(...aqhiValues);
  const minAQHI = Math.min(...aqhiValues);

  const avgLevel = getAQHILevel(avgAQHI);
  const maxLevel = getAQHILevel(maxAQHI);
  const minLevel = getAQHILevel(minAQHI);

  // Map AQHI colors to AQI classes for consistency
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

  // Calculate category counts
  const categoryCounts = {
    LOW: validStations.filter((s) => s.pm25_aqhi.value <= 3).length,
    MODERATE: validStations.filter(
      (s) => s.pm25_aqhi.value >= 4 && s.pm25_aqhi.value <= 6,
    ).length,
    HIGH: validStations.filter(
      (s) => s.pm25_aqhi.value >= 7 && s.pm25_aqhi.value <= 10,
    ).length,
    VERY_HIGH: validStations.filter((s) => s.pm25_aqhi.value >= 11).length,
  };

  // Create PM2.5 AQHI stats grid
  const statsHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${validStations.length}</div>
                <div class="stat-label">Stations with PM2.5 Data</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQHIClass(avgLevel)}">${formatAQHI(avgAQHI)}</div>
                <div class="stat-label">Average PM2.5 AQHI</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQHIClass(maxLevel)}">${formatAQHI(maxAQHI)}</div>
                <div class="stat-label">Highest PM2.5 AQHI</div>
            </div>
            <div class="stat-card">
                <div class="stat-value text-${getAQHIClass(minLevel)}">${formatAQHI(minAQHI)}</div>
                <div class="stat-label">Lowest PM2.5 AQHI</div>
            </div>
        </div>
        <div class="info" style="margin-top: 12px; padding: 8px; background: var(--gray-100); border-radius: 6px; font-size: 0.875rem;">
            <div style="font-weight: 500; margin-bottom: 4px;">📊 PM2.5-only AQHI (Hypothesis Testing):</div>
            <div>• NO₂ and O₃ values set to 0 for all calculations</div>
            <div>• Only PM2.5 concentration affects the AQHI values</div>
            <div>• Compare with normal AQHI to see impact of missing substances</div>
        </div>
    `;

  statsContent.innerHTML = statsHTML;

  // Update category breakdown for PM2.5 AQHI
  updateAQHICategoryBreakdown(categoryCounts);

  console.log('PM2.5-only AQHI statistics updated');
}

function updateStatisticsPanelCanadianAQHI(stations) {
  // Calculate Canadian AQHI statistics
  const validStations = stations.filter(
    (s) => s.canadianAqhi && s.canadianAqhi.value !== undefined,
  );
  const statsContent = document.getElementById('stats-content');

  if (!statsContent) {
    console.error('Statistics content element not found');
    return;
  }

  if (validStations.length === 0) {
    uiManager.showError('stats-content', 'No valid Canadian AQHI data available');
    return;
  }

  // Import Canadian AQHI functions
  import('./aqhi-canada.js').then(({ getCanadianAQHILevel, formatCanadianAQHI, calculateCanadianAQHIStatistics }) => {
    // Calculate statistics for Canadian AQHI
    const aqhiValues = validStations.map((s) => s.canadianAqhi.value);
    const avgAQHI = Math.round(
      aqhiValues.reduce((a, b) => a + b, 0) / aqhiValues.length,
    );
    const maxAQHI = Math.max(...aqhiValues);
    const minAQHI = Math.min(...aqhiValues);

    const avgLevel = getCanadianAQHILevel(avgAQHI);
    const maxLevel = getCanadianAQHILevel(maxAQHI);
    const minLevel = getCanadianAQHILevel(minAQHI);

    // Map Canadian AQHI colors to AQI classes for consistency
    const getCanadianAQHIClass = (level) => {
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

    // Calculate category counts for Canadian AQHI
    const categoryCounts = {
      LOW: validStations.filter((s) => s.canadianAqhi.value >= 1 && s.canadianAqhi.value <= 3).length,
      MODERATE: validStations.filter(
        (s) => s.canadianAqhi.value >= 4 && s.canadianAqhi.value <= 6,
      ).length,
      HIGH: validStations.filter(
        (s) => s.canadianAqhi.value >= 7 && s.canadianAqhi.value <= 10,
      ).length,
      VERY_HIGH: validStations.filter((s) => s.canadianAqhi.value >= 11).length,
    };

    // Count data quality types
    const dataQualityTypes = validStations.reduce((acc, station) => {
      const method = station.canadianAqhi?.calculationMethod || 'unknown';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    const supabaseCount = dataQualityTypes['supabase-average'] || 0;
    const currentCount = dataQualityTypes['current-reading'] || 0;

    // Create Canadian AQHI stats grid
    const statsHTML = `
          <div class="stats-grid">
              <div class="stat-card">
                  <div class="stat-value">${validStations.length}</div>
                  <div class="stat-label">Stations with Canadian AQHI</div>
              </div>
              <div class="stat-card">
                  <div class="stat-value text-${getCanadianAQHIClass(avgLevel)}">${formatCanadianAQHI(avgAQHI)}</div>
                  <div class="stat-label">Average Canadian AQHI</div>
              </div>
              <div class="stat-card">
                  <div class="stat-value text-${getCanadianAQHIClass(maxLevel)}">${formatCanadianAQHI(maxAQHI)}</div>
                  <div class="stat-label">Highest Canadian AQHI</div>
              </div>
              <div class="stat-card">
                  <div class="stat-value text-${getCanadianAQHIClass(minLevel)}">${formatCanadianAQHI(minAQHI)}</div>
                  <div class="stat-label">Lowest Canadian AQHI</div>
              </div>
          </div>
          <div class="info" style="margin-top: 12px; padding: 8px; background: var(--gray-100); border-radius: 6px; font-size: 0.875rem;">
              <div style="font-weight: 500; margin-bottom: 4px;">🍁 Canadian AQHI Formula (Health Canada):</div>
              <div>• β coefficients: PM2.5=0.000487, NO₂=0.000871, O₃=0.000537</div>
              <div>• Scaling factor: C=10.4 (official Canadian standard)</div>
              <div>• Data quality: ${supabaseCount} 3h avg, ${currentCount} current readings</div>
              <div>• Compare with Thai AQHI to see regional differences</div>
          </div>
      `;

    statsContent.innerHTML = statsHTML;

    // Update category breakdown for Canadian AQHI
    updateAQHICategoryBreakdown(categoryCounts);

    console.log('Canadian AQHI statistics updated');
  });
}

function updateAQHICategoryBreakdown(categoryCounts) {
  const categoryData = [
    { name: 'Low (1-3)', count: categoryCounts.LOW, color: '#00e400' },
    {
      name: 'Moderate (4-6)',
      count: categoryCounts.MODERATE,
      color: '#ffff00',
    },
    { name: 'High (7-10)', count: categoryCounts.HIGH, color: '#ff7e00' },
    {
      name: 'Very High (10+)',
      count: categoryCounts.VERY_HIGH,
      color: '#ff0000',
    },
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
      lowestAQI: stats.minAQI,
    },
    breakdown: {
      good: stats.categories.good,
      moderate: stats.categories.moderate,
      unhealthyForSensitive: stats.categories.unhealthySensitive,
      unhealthy: stats.categories.unhealthy,
      veryUnhealthy: stats.categories.veryUnhealthy,
      hazardous: stats.categories.hazardous,
    },
    stations: stats.validStations.map((station) => ({
      name: station.station?.name || 'Unknown',
      aqi: parseInt(station.aqi),
      lat: station.lat,
      lon: station.lon,
      lastUpdate: station.station?.time,
    })),
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
      moderate:
        currentStats.categories.moderate - previousStats.categories.moderate,
      unhealthy:
        currentStats.categories.unhealthy - previousStats.categories.unhealthy,
    },
  };
}

export function identifyHotspots(stations, threshold = 100) {
  const validStations = stations.filter(
    (station) => station.aqi !== '-' && !isNaN(parseInt(station.aqi)),
  );

  return validStations
    .filter((station) => parseInt(station.aqi) > threshold)
    .sort((a, b) => parseInt(b.aqi) - parseInt(a.aqi))
    .map((station) => ({
      name: station.station?.name || 'Unknown Station',
      aqi: parseInt(station.aqi),
      coordinates: [station.lat, station.lon],
      severity: parseInt(station.aqi) > 200 ? 'high' : 'medium',
    }));
}
