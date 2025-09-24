// OpenWeather Air Pollution API Client
// Provides fallback O3 and NO2 data for AQHI calculations
import { OPENWEATHER_CONFIG } from './config.js';

class OpenWeatherAirPollution {
  constructor() {
    this.cache = new Map();
    this.requestCount = 0;
    this.resetTime = Date.now() + 24 * 60 * 60 * 1000; // Reset daily counter
  }

  /**
   * Get pollution data for specific coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Promise<Object|null>} Formatted pollution data or null if failed
   */
  async getPollutionData(lat, lon) {
    // Check rate limits
    if (!this.checkRateLimit()) {
      console.warn('OpenWeather API rate limit reached for today');
      return null;
    }

    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

    // Check cache first
    if (this.isCached(cacheKey)) {
      console.log(`Using cached OpenWeather data for ${cacheKey}`);
      return this.cache.get(cacheKey).data;
    }

    try {
      const url = `${OPENWEATHER_CONFIG.API_URL}?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_CONFIG.API_KEY}`;

      console.log(`Fetching OpenWeather data for coordinates: ${lat}, ${lon}`);
      console.log(
        `API URL: ${url.replace(OPENWEATHER_CONFIG.API_KEY, 'API_KEY_HIDDEN')}`,
      );

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `OpenWeather API error: ${response.status} - ${response.statusText}`,
        );
        console.error('Error response body:', errorText);

        if (response.status === 401) {
          console.error('❌ OpenWeather API key is invalid or unauthorized');
          console.error('Please check:');
          console.error(
            '1. API key is correct and activated (new keys take ~10 minutes)',
          );
          console.error('2. Account has Air Pollution API access');
          console.error('3. Account is active and not suspended');
          console.error(
            '4. Try testing manually: https://api.openweathermap.org/data/2.5/air_pollution?lat=13.7563&lon=100.5018&appid=YOUR_KEY',
          );
        }

        return null;
      }

      const data = await response.json();
      this.requestCount++;

      // Format data for AQHI calculations
      const formattedData = this.formatForAQHI(data);

      // Cache the result
      this.cache.set(cacheKey, {
        data: formattedData,
        timestamp: Date.now(),
      });

      console.log(
        `OpenWeather API call successful. Daily usage: ${this.requestCount}/${OPENWEATHER_CONFIG.MAX_REQUESTS_PER_DAY}`,
      );
      return formattedData;
    } catch (error) {
      console.error('Error fetching OpenWeather data:', error);
      return null;
    }
  }

  /**
   * Format OpenWeather API response for AQHI calculations
   * @param {Object} apiResponse - Raw OpenWeather API response
   * @returns {Object} Formatted data with pollutant concentrations
   */
  formatForAQHI(apiResponse) {
    if (!apiResponse?.list?.[0]?.components) {
      console.warn('Invalid OpenWeather API response format');
      return null;
    }

    const components = apiResponse.list[0].components;

    // Convert OpenWeather concentrations to our format
    // OpenWeather already provides values in μg/m³ for all pollutants
    const formatted = {
      pm25: components.pm2_5 || null,
      pm10: components.pm10 || null,
      o3: components.o3 || null,
      no2: components.no2 || null,
      so2: components.so2 || null,
      co: components.co ? components.co / 1000 : null, // Convert μg/m³ to mg/m³ for CO
      timestamp: Date.now(),
      source: 'openweather',
    };

    // Log available pollutants
    const available = Object.entries(formatted)
      .filter(
        ([key, value]) =>
          value !== null && !['timestamp', 'source'].includes(key),
      )
      .map(([key]) => key);

    console.log(`OpenWeather provides: ${available.join(', ')}`);

    return formatted;
  }

  /**
   * Check if data is cached and still valid
   * @param {string} cacheKey - Cache key for location
   * @returns {boolean} True if cached data is still valid
   */
  isCached(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    return age < OPENWEATHER_CONFIG.CACHE_DURATION;
  }

  /**
   * Check if we're within rate limits
   * @returns {boolean} True if we can make more requests
   */
  checkRateLimit() {
    // Reset counter if 24 hours have passed
    if (Date.now() > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = Date.now() + 24 * 60 * 60 * 1000;
    }

    return this.requestCount < OPENWEATHER_CONFIG.MAX_REQUESTS_PER_DAY;
  }

  /**
   * Get current rate limit status
   * @returns {Object} Rate limit information
   */
  getRateLimitStatus() {
    return {
      used: this.requestCount,
      limit: OPENWEATHER_CONFIG.MAX_REQUESTS_PER_DAY,
      remaining: OPENWEATHER_CONFIG.MAX_REQUESTS_PER_DAY - this.requestCount,
      resetTime: this.resetTime,
    };
  }

  /**
   * Test API key validity
   * @returns {Promise<boolean>} True if API key is valid
   */
  async testApiKey() {
    try {
      // Test with Bangkok coordinates
      const testUrl = `${OPENWEATHER_CONFIG.API_URL}?lat=13.7563&lon=100.5018&appid=${OPENWEATHER_CONFIG.API_KEY}`;

      console.log('🔍 Testing OpenWeather API key...');
      const response = await fetch(testUrl);

      if (response.ok) {
        console.log('✅ OpenWeather API key is valid');
        return true;
      } else {
        const errorText = await response.text();
        console.error(
          `❌ OpenWeather API key test failed: ${response.status} - ${response.statusText}`,
        );
        console.error('Error details:', errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ OpenWeather API key test error:', error);
      return false;
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
    console.log('OpenWeather cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache information
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Create singleton instance
export const openWeatherClient = new OpenWeatherAirPollution();

// Make it globally available for testing
if (typeof window !== 'undefined') {
  window.openWeatherClient = openWeatherClient;
}

/**
 * Convenience function to get OpenWeather fallback data for a station
 * Only fetches if station is missing critical AQHI pollutants
 * @param {Object} station - Station data from WAQI API
 * @param {Object} averages - Stored 3-hour averages (if any)
 * @returns {Promise<Object|null>} Supplementary data or null
 */
export async function getOpenWeatherFallback(station, averages = null) {
  if (!station?.lat || !station?.lon) {
    return null;
  }

  // Check if we need O3 or NO2 data
  const needsO3 = !station.iaqi?.o3?.v && !averages?.o3;
  const needsNO2 = !station.iaqi?.no2?.v && !averages?.no2;

  if (!needsO3 && !needsNO2) {
    console.log(
      `Station ${station.station?.name || station.uid} has sufficient O3/NO2 data`,
    );
    return null;
  }

  console.log(
    `Station ${station.station?.name || station.uid} missing: ${[
      needsO3 && 'O3',
      needsNO2 && 'NO2',
    ]
      .filter(Boolean)
      .join(', ')}`,
  );

  return await openWeatherClient.getPollutionData(station.lat, station.lon);
}
