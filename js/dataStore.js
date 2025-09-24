// Data persistence module for storing historical pollutant data

const STORAGE_KEY = 'aqhi_historical_data';
const MAX_AGE_HOURS = 3;

/**
 * Save historical data to localStorage
 * @param {Map} data - Historical data map
 */
export function saveHistoricalData(data) {
  try {
    const serializable = {};
    data.forEach((value, key) => {
      serializable[key] = value;
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        data: serializable,
      }),
    );
  } catch (error) {
    console.error('Error saving historical data:', error);
  }
}

/**
 * Load historical data from localStorage
 * @returns {Map} Historical data map
 */
export function loadHistoricalData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Map();

    const parsed = JSON.parse(stored);
    const now = new Date();
    const map = new Map();

    // Convert back to Map and filter old data
    Object.entries(parsed.data).forEach(([stationId, entries]) => {
      const validEntries = entries
        .filter((entry) => {
          const entryTime = new Date(entry.timestamp);
          const ageHours = (now - entryTime) / (1000 * 60 * 60);
          return ageHours <= MAX_AGE_HOURS;
        })
        .map((entry) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));

      if (validEntries.length > 0) {
        map.set(stationId, validEntries);
      }
    });

    return map;
  } catch (error) {
    console.error('Error loading historical data:', error);
    return new Map();
  }
}

/**
 * Clear old data from storage
 */
export function clearOldData() {
  const data = loadHistoricalData();
  const now = new Date();
  const cleaned = new Map();

  data.forEach((entries, stationId) => {
    const validEntries = entries.filter((entry) => {
      const ageHours = (now - entry.timestamp) / (1000 * 60 * 60);
      return ageHours <= MAX_AGE_HOURS;
    });

    if (validEntries.length > 0) {
      cleaned.set(stationId, validEntries);
    }
  });

  saveHistoricalData(cleaned);
  return cleaned;
}

/**
 * Get data quality status for a station
 * @param {string} stationId - Station identifier
 * @returns {Object} Data quality information
 */
export function getDataQuality(stationId) {
  const data = loadHistoricalData();
  const stationData = data.get(stationId) || [];

  if (stationData.length === 0) {
    return {
      status: 'no-data',
      message: 'No historical data available',
      percentage: 0,
    };
  }

  const now = new Date();
  const oldestEntry = stationData[0];
  const timeSpanMinutes = (now - oldestEntry.timestamp) / (1000 * 60);

  if (timeSpanMinutes >= 180) {
    // Full 3 hours
    return {
      status: 'complete',
      message: 'Full 3-hour data available',
      percentage: 100,
    };
  } else if (timeSpanMinutes >= 60) {
    // At least 1 hour
    return {
      status: 'partial',
      message: `${Math.round(timeSpanMinutes)} minutes of data`,
      percentage: Math.round((timeSpanMinutes / 180) * 100),
    };
  } else {
    return {
      status: 'insufficient',
      message: `Only ${Math.round(timeSpanMinutes)} minutes of data`,
      percentage: Math.round((timeSpanMinutes / 180) * 100),
    };
  }
}

/**
 * Initialize data store and set up auto-save
 */
export function initializeDataStore() {
  // Load existing data on startup
  const existingData = loadHistoricalData();
  console.log(`Loaded historical data for ${existingData.size} stations`);

  // Set up periodic save (every minute)
  setInterval(() => {
    clearOldData();
  }, 60000);

  // Save on page unload
  window.addEventListener('beforeunload', () => {
    const data = loadHistoricalData();
    saveHistoricalData(data);
  });

  return existingData;
}
