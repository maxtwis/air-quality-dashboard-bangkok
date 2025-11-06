import { AirQualityDB } from "../lib/supabase.js";
import { fetchGoogleAQHIHistory } from "./google-aqhi-api.js";

// Station History Chart Module
// Displays historical pollutant data using Chart.js

let currentChart = null;

/**
 * WHO Air Quality Guidelines
 */
const WHO_GUIDELINES = {
  pm25: 5, // μg/m³ - 24-hour mean
  pm10: 15, // μg/m³ - 24-hour mean
  o3: 60, // μg/m³ - 8-hour mean (or 30 ppb)
  no2: 25, // μg/m³ - 24-hour mean (or 13 ppb)
  so2: 40, // μg/m³ - 24-hour mean (or 15 ppb)
};

/**
 * Unit conversion factors for gas pollutants
 * Convert μg/m³ to ppb at 25°C, 1 atm
 */
const CONVERSION_FACTORS = {
  o3: 2.0, // O3: 1 ppb = 2.0 μg/m³
  no2: 1.88, // NO2: 1 ppb = 1.88 μg/m³
  so2: 2.62, // SO2: 1 ppb = 2.62 μg/m³
};

/**
 * Aggregate data points by hour (average values within each hour)
 */
function aggregateByHour(data) {
  if (!data || data.length === 0) return [];

  // Group data by hour
  const hourlyGroups = {};

  data.forEach((point) => {
    // Round timestamp down to the hour
    const date = new Date(point.timestamp);
    const hourKey = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
    ).toISOString();

    if (!hourlyGroups[hourKey]) {
      hourlyGroups[hourKey] = [];
    }
    hourlyGroups[hourKey].push(point);
  });

  // Calculate averages for each hour
  const aggregated = Object.entries(hourlyGroups).map(([hourKey, points]) => {
    const avg = (values) => {
      const valid = values.filter((v) => v != null && !isNaN(v));
      return valid.length > 0
        ? valid.reduce((sum, v) => sum + v, 0) / valid.length
        : null;
    };

    return {
      timestamp: hourKey,
      pm25: avg(points.map((p) => p.pm25)),
      pm10: avg(points.map((p) => p.pm10)),
      o3: avg(points.map((p) => p.o3)),
      no2: avg(points.map((p) => p.no2)),
      so2: avg(points.map((p) => p.so2)),
      co: avg(points.map((p) => p.co)),
      aqi: avg(points.map((p) => p.aqi)),
    };
  });

  // Sort by timestamp
  return aggregated.sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
}

/**
 * Create or update the station history chart
 */
export async function renderStationHistoryChart(stationUid, hours = 24) {
  try {

    // Get chart container
    const chartContainer = document.getElementById("station-history-chart");

    if (!chartContainer) {
      return;
    }

    // Show loading state
    chartContainer.innerHTML =
      '<div class="loading"><div class="loading-spinner"></div>กำลังโหลดข้อมูลย้อนหลัง...</div>';

    // Fetch historical data
    let historyData;

    // Check if this is a Google AQHI station (uid format: "google-1", "google-2", etc.)
    const isGoogleStation = stationUid.toString().startsWith('google-');

    if (isGoogleStation) {
      // Extract location ID from uid (e.g., "google-8" -> 8)
      const locationId = parseInt(stationUid.toString().replace('google-', ''));
      historyData = await fetchGoogleAQHIHistory(locationId, hours);
    } else {
      // Fetch WAQI station history
      historyData = await AirQualityDB.getStationHistory(stationUid, hours);
    }


    if (!historyData || historyData.length === 0) {
      const isGoogleStation = stationUid.toString().startsWith('google-');

      chartContainer.innerHTML = `
        <div class="info" style="padding: 20px; text-align: center; background: #f3f4f6; border-radius: 8px;">
          <div style="font-size: 48px; margin-bottom: 12px;">📊</div>
          <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 8px;">
            ${isGoogleStation ? 'ยังไม่มีข้อมูลย้อนหลัง' : 'กำลังรวบรวมข้อมูล'}
          </div>
          <div style="color: #6b7280; font-size: 0.9rem; line-height: 1.6;">
            ${isGoogleStation
              ? 'ข้อมูลย้อนหลังสำหรับสถานีชุมชนจะพร้อมใช้งานในเร็วๆ นี้<br>ระบบกำลังเก็บรวบรวมข้อมูล AQHI ทุก 10 นาที'
              : 'ระบบเก็บข้อมูล WAQI ทุก 10 นาที และเก็บไว้ 7 วัน<br>กรุณารอสักครู่เพื่อให้ระบบเก็บรวบรวมข้อมูลเพียงพอ'
            }
          </div>
          <div style="margin-top: 16px; padding: 12px; background: white; border-radius: 6px; font-size: 0.85rem;">
            <strong>เวลาที่ขอ:</strong> ${hours === 24 ? '24 ชั่วโมง' : '7 วัน'}<br>
            <strong>จุดข้อมูลที่มี:</strong> ${historyData ? historyData.length : 0} จุด
          </div>
        </div>
      `;
      return;
    }

    // Aggregate data by hour to reduce noise
    const aggregatedData = aggregateByHour(historyData);

    // Restore canvas
    chartContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="font-weight: 600; font-size: 0.9rem;">สถิติคุณภาพอากาศย้อนหลัง</div>
        <div class="history-toggle" style="display: flex; gap: 8px;">
          <button class="history-btn ${hours === 24 ? "active" : ""}" data-hours="24">24 ชม.</button>
          <button class="history-btn ${hours === 168 ? "active" : ""}" data-hours="168">7 วัน</button>
        </div>
      </div>
      <div id="chart-canvas-container" style="position: relative; height: 350px; min-height: 350px; width: 100%; display: block !important;">
        <canvas id="history-chart-canvas" width="800" height="350" style="display: block !important;"></canvas>
      </div>
    `;

    // Ensure container is visible
    chartContainer.style.display = 'block';
    chartContainer.style.visibility = 'visible';

    // Log container dimensions

    // Setup toggle buttons
    const toggleButtons = chartContainer.querySelectorAll(".history-btn");
    toggleButtons.forEach((btn) => {
      // Handle both click and touch events for mobile
      const handleToggle = (e) => {
        e.stopPropagation(); // Prevent event from bubbling to document click handler
        e.preventDefault(); // Prevent default touch behavior on mobile

        // Save current scroll position
        const scrollY = window.scrollY || window.pageYOffset;

        const newHours = parseInt(btn.dataset.hours);
        renderStationHistoryChart(stationUid, newHours).then(() => {
          // Restore scroll position after chart renders
          window.scrollTo(0, scrollY);
        });
      };

      btn.addEventListener("click", handleToggle);
      btn.addEventListener("touchend", handleToggle); // Handle touch events on mobile
    });

    // Prepare data for chart (use aggregated data)
    // Convert gas pollutants from μg/m³ to ppb for display
    const timestamps = aggregatedData.map((d) => new Date(d.timestamp));
    const pm25Data = aggregatedData.map((d) => d.pm25); // Keep in μg/m³
    const pm10Data = aggregatedData.map((d) => d.pm10); // Keep in μg/m³
    const no2Data = aggregatedData.map((d) =>
      d.no2 ? d.no2 / CONVERSION_FACTORS.no2 : null,
    ); // Convert to ppb
    const o3Data = aggregatedData.map((d) =>
      d.o3 ? d.o3 / CONVERSION_FACTORS.o3 : null,
    ); // Convert to ppb

    // Destroy existing chart if it exists
    if (currentChart) {
      currentChart.destroy();
      currentChart = null;
    }

    // Get canvas context
    const ctx = document.getElementById("history-chart-canvas");
    if (!ctx) {
      return;
    }


    // Create chart
    try {
      currentChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: timestamps,
          datasets: [
            {
              label: "PM2.5",
              data: pm25Data,
              borderColor: "#ff6b6b",
              backgroundColor: "rgba(255, 107, 107, 0.1)",
              borderWidth: 2,
              tension: 0.4,
              fill: true,
              pointRadius: hours === 24 ? 2 : 0,
              pointHoverRadius: 4,
            },
            {
              label: "PM10",
              data: pm10Data,
              borderColor: "#ff9f43",
              backgroundColor: "rgba(255, 159, 67, 0.1)",
              borderWidth: 2,
              tension: 0.4,
              fill: false,
              pointRadius: hours === 24 ? 2 : 0,
              pointHoverRadius: 4,
            },
            {
              label: "NO₂",
              data: no2Data,
              borderColor: "#4ecdc4",
              backgroundColor: "rgba(78, 205, 196, 0.1)",
              borderWidth: 2,
              tension: 0.4,
              fill: false,
              pointRadius: hours === 24 ? 2 : 0,
              pointHoverRadius: 4,
            },
            {
              label: "O₃",
              data: o3Data,
              borderColor: "#95e1d3",
              backgroundColor: "rgba(149, 225, 211, 0.1)",
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
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: {
              display: true,
              position: "bottom",
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
              backgroundColor: "rgba(0, 0, 0, 0.8)",
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
                  return new Date(date).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                },
                label: (context) => {
                  const label = context.dataset.label || "";
                  const value = context.parsed.y;
                  if (value === null) return "";

                  // Use correct units for each pollutant
                  const unit =
                    label === "NO₂" || label === "O₃" ? "ppb" : "μg/m³";
                  return `${label}: ${value.toFixed(1)} ${unit}`;
                },
              },
            },
            annotation: {
              annotations: {
                pm25Line: {
                  type: "line",
                  yMin: WHO_GUIDELINES.pm25,
                  yMax: WHO_GUIDELINES.pm25,
                  borderColor: "rgba(255, 107, 107, 0.3)",
                  borderWidth: 2,
                  borderDash: [5, 5],
                  label: {
                    display: true,
                    content: "WHO PM2.5 Guideline",
                    position: "end",
                    backgroundColor: "rgba(255, 107, 107, 0.8)",
                    color: "white",
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
              type: "time",
              time: {
                unit: hours === 24 ? "hour" : "day",
                displayFormats: {
                  hour: "HH:mm",
                  day: "MMM d",
                },
                tooltipFormat: "MMM d, HH:mm",
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
                autoSkip: true,
                maxTicksLimit: hours === 24 ? 12 : 7,
              },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Concentration (PM: μg/m³, Gases: ppb)",
                font: {
                  size: 10,
                  family: "'Inter', sans-serif",
                },
              },
              grid: {
                color: "rgba(0, 0, 0, 0.05)",
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

      // Force a small delay to ensure DOM is updated
      setTimeout(() => {
        const canvasCheck = document.getElementById('history-chart-canvas');
        const containerCheck = document.getElementById('chart-canvas-container');

        if (!canvasCheck) {
        }
      }, 100);

    } catch (chartError) {
      chartContainer.innerHTML = `
        <div class="error" style="padding: 20px; text-align: center;">
          Failed to create chart: ${chartError.message}
        </div>
      `;
      return;
    }
  } catch (error) {
    const chartContainer = document.getElementById("station-history-chart");
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
