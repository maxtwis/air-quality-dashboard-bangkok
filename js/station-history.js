import { AirQualityDB } from '../lib/supabase.js';

// Station History Chart Module
// Displays historical pollutant data using Chart.js

let currentChart = null;

/**
 * WHO Air Quality Guidelines (μg/m³)
 */
const WHO_GUIDELINES = {
  pm25: 5,      // 24-hour mean
  pm10: 15,     // 24-hour mean
  o3: 60,       // 8-hour mean
  no2: 25,      // 24-hour mean
  so2: 40,      // 24-hour mean
};

/**
 * Create or update the station history chart
 */
export async function renderStationHistoryChart(stationUid, hours = 24) {
  try {
    console.log(`📊 Loading ${hours}h history for station ${stationUid}`);

    // Show loading state
    const chartContainer = document.getElementById('station-history-chart');
    const canvas = document.getElementById('history-chart-canvas');

    if (!chartContainer || !canvas) {
      console.error('Chart elements not found');
      return;
    }

    chartContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading historical data...</div>';

    // Fetch historical data
    const historyData = await AirQualityDB.getStationHistory(stationUid, hours);

    if (!historyData || historyData.length === 0) {
      chartContainer.innerHTML = `
        <div class="info" style="padding: 20px; text-align: center;">
          No historical data available for this station yet.
          <br><br>
          Data is collected every 10 minutes and stored for 7 days.
        </div>
      `;
      return;
    }

    console.log(`✅ Loaded ${historyData.length} data points`);

    // Restore canvas
    chartContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="font-weight: 600; font-size: 0.9rem;">Air Quality History</div>
        <div class="history-toggle" style="display: flex; gap: 8px;">
          <button class="history-btn ${hours === 24 ? 'active' : ''}" data-hours="24">24h</button>
          <button class="history-btn ${hours === 168 ? 'active' : ''}" data-hours="168">7d</button>
        </div>
      </div>
      <div style="position: relative; height: 300px;">
        <canvas id="history-chart-canvas"></canvas>
      </div>
      <div id="chart-legend" style="margin-top: 12px; font-size: 0.85rem;"></div>
    `;

    // Setup toggle buttons
    const toggleButtons = chartContainer.querySelectorAll('.history-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const newHours = parseInt(btn.dataset.hours);
        renderStationHistoryChart(stationUid, newHours);
      });
    });

    // Prepare data for chart
    const timestamps = historyData.map(d => new Date(d.timestamp));
    const pm25Data = historyData.map(d => d.pm25);
    const no2Data = historyData.map(d => d.no2);
    const o3Data = historyData.map(d => d.o3);
    const so2Data = historyData.map(d => d.so2);

    // Destroy existing chart if it exists
    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }

    // Get canvas context
    const ctx = document.getElementById('history-chart-canvas');
    if (!ctx) {
      console.error('Canvas not found after restoration');
      return;
    }

    // Create chart
    currentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [
          {
            label: 'PM2.5',
            data: pm25Data,
            borderColor: '#ff6b6b',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: hours === 24 ? 2 : 0,
            pointHoverRadius: 4,
          },
          {
            label: 'NO₂',
            data: no2Data,
            borderColor: '#4ecdc4',
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: hours === 24 ? 2 : 0,
            pointHoverRadius: 4,
          },
          {
            label: 'O₃',
            data: o3Data,
            borderColor: '#95e1d3',
            backgroundColor: 'rgba(149, 225, 211, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: hours === 24 ? 2 : 0,
            pointHoverRadius: 4,
          },
          {
            label: 'SO₂',
            data: so2Data,
            borderColor: '#ffd93d',
            backgroundColor: 'rgba(255, 217, 61, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: hours === 24 ? 2 : 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11,
                family: "'Inter', sans-serif",
              },
            },
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 13,
              family: "'Inter', sans-serif",
            },
            bodyFont: {
              size: 12,
              family: "'Inter', sans-serif",
            },
            callbacks: {
              title: (context) => {
                const date = context[0].parsed.x;
                return new Date(date).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              },
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                return value !== null ? `${label}: ${value.toFixed(1)} μg/m³` : '';
              },
            },
          },
          annotation: {
            annotations: {
              pm25Line: {
                type: 'line',
                yMin: WHO_GUIDELINES.pm25,
                yMax: WHO_GUIDELINES.pm25,
                borderColor: 'rgba(255, 107, 107, 0.3)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: 'WHO PM2.5 Guideline',
                  position: 'end',
                  backgroundColor: 'rgba(255, 107, 107, 0.8)',
                  color: 'white',
                  font: {
                    size: 10,
                  },
                },
              },
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: hours === 24 ? 'hour' : 'day',
              displayFormats: {
                hour: 'HH:mm',
                day: 'MMM d',
              },
            },
            grid: {
              display: false,
            },
            ticks: {
              font: {
                size: 10,
                family: "'Inter', sans-serif",
              },
              maxRotation: 0,
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Concentration (μg/m³)',
              font: {
                size: 11,
                family: "'Inter', sans-serif",
              },
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              font: {
                size: 10,
                family: "'Inter', sans-serif",
              },
            },
          },
        },
      },
    });

    // Add data quality info
    const legendDiv = document.getElementById('chart-legend');
    if (legendDiv) {
      const latestReading = historyData[historyData.length - 1];
      const oldestReading = historyData[0];

      legendDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; color: var(--gray-600); padding: 8px; background: var(--gray-50); border-radius: 6px;">
          <div>
            <strong>${historyData.length}</strong> readings
          </div>
          <div>
            ${new Date(oldestReading.timestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
            →
            ${new Date(latestReading.timestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      `;
    }

  } catch (error) {
    console.error('Error rendering station history chart:', error);
    const chartContainer = document.getElementById('station-history-chart');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div class="error" style="padding: 20px; text-align: center;">
          Failed to load historical data. Please try again later.
        </div>
      `;
    }
  }
}

/**
 * Destroy the current chart
 */
export function destroyChart() {
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
}
