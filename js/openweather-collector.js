// OpenWeather Data Collection Service
// Intelligently collects O3/NO2 data for stations that need it
// Optimizes API usage to stay under 1000 calls/day limit

import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js';
import { OPENWEATHER_CONFIG } from './config.js';

class OpenWeatherCollector {
  constructor() {
    this.supabase = null;
    this.initSupabase();
    this.dailyLimit = 950; // Buffer under 1000
    this.batchSize = 10; // Process stations in batches
  }

  initSupabase() {
    try {
      const supabaseUrl =
        window.SUPABASE_URL || 'https://xqvjrovzhupdfwvdikpo.supabase.co';
      const supabaseAnonKey =
        window.SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxdmpyb3Z6aHVwZGZ3dmRpa3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTQyMjMsImV4cCI6MjA3MzUzMDIyM30.rzJ8-LnZh2dITbh7HcIXJ32BQ1MN-F-O5hCmO0jzIDo';

      this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      console.log('✅ OpenWeather Collector initialized');
    } catch (error) {
      console.warn('⚠️ OpenWeather Collector failed to initialize:', error);
      this.supabase = null;
    }
  }

  /**
   * Check current API usage for today
   */
  async checkApiUsage() {
    if (!this.supabase)
      return { used: 0, remaining: this.dailyLimit, canMakeCall: false };

    try {
      const { data, error } = await this.supabase.rpc('get_api_usage_stats');

      if (error || !data || data.length === 0) {
        // No usage record for today, we can make calls
        return { used: 0, remaining: this.dailyLimit, canMakeCall: true };
      }

      const usage = data[0];
      return {
        used: usage.calls_used,
        remaining: usage.calls_remaining,
        canMakeCall: usage.calls_used < this.dailyLimit,
        percentageUsed: usage.percentage_used,
      };
    } catch (error) {
      console.error('Error checking API usage:', error);
      return { used: 0, remaining: this.dailyLimit, canMakeCall: false };
    }
  }

  /**
   * Increment API usage counter
   */
  async incrementApiUsage() {
    if (!this.supabase) return false;

    try {
      const { data, error } = await this.supabase.rpc(
        'check_and_increment_api_usage',
      );

      return !error && data;
    } catch (error) {
      console.error('Error incrementing API usage:', error);
      return false;
    }
  }

  /**
   * Identify stations that need OpenWeather data
   */
  async identifyStationsNeedingData(stations) {
    if (!stations || stations.length === 0) return [];

    const needingData = [];

    for (const station of stations) {
      const hasO3 = station.iaqi?.o3?.v !== undefined;
      const hasNO2 = station.iaqi?.no2?.v !== undefined;

      // Check if we have recent OpenWeather data for this location
      const hasRecentOpenWeatherData = await this.hasRecentOpenWeatherData(
        station.lat,
        station.lon,
      );

      if ((!hasO3 || !hasNO2) && !hasRecentOpenWeatherData) {
        needingData.push({
          station,
          missing: {
            o3: !hasO3,
            no2: !hasNO2,
          },
          lat: station.lat,
          lon: station.lon,
        });
      }
    }

    console.log(
      `📊 Found ${needingData.length} stations needing OpenWeather data`,
    );
    return needingData;
  }

  /**
   * Check if we have recent OpenWeather data for location
   */
  async hasRecentOpenWeatherData(lat, lon) {
    if (!this.supabase) return false;

    try {
      const latTolerance = 0.01; // ~1km
      const lonTolerance = 0.01;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from('openweather_readings')
        .select('id')
        .gte('lat', lat - latTolerance)
        .lte('lat', lat + latTolerance)
        .gte('lon', lon - lonTolerance)
        .lte('lon', lon + lonTolerance)
        .gte('timestamp', oneHourAgo.toISOString())
        .limit(1);

      return !error && data && data.length > 0;
    } catch (error) {
      console.error('Error checking recent OpenWeather data:', error);
      return false;
    }
  }

  /**
   * Fetch data from OpenWeather API
   */
  async fetchFromOpenWeather(lat, lon) {
    try {
      const url = `${OPENWEATHER_CONFIG.API_URL}?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_CONFIG.API_KEY}`;

      console.log(`🌐 Fetching OpenWeather data for ${lat}, ${lon}`);
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `OpenWeather API error: ${response.status} - ${response.statusText}`,
        );
        console.error('Error response:', errorText);
        return null;
      }

      const data = await response.json();

      // Increment usage counter
      await this.incrementApiUsage();

      return this.formatOpenWeatherData(data, lat, lon);
    } catch (error) {
      console.error('Error fetching OpenWeather data:', error);
      return null;
    }
  }

  /**
   * Format OpenWeather data for storage
   */
  formatOpenWeatherData(apiResponse, lat, lon) {
    if (!apiResponse?.list?.[0]?.components) {
      console.warn('Invalid OpenWeather API response format');
      return null;
    }

    const components = apiResponse.list[0].components;

    return {
      lat: parseFloat(lat.toFixed(7)),
      lon: parseFloat(lon.toFixed(7)),
      pm25: components.pm2_5 || null,
      pm10: components.pm10 || null,
      o3: components.o3 || null,
      no2: components.no2 || null,
      so2: components.so2 || null,
      co: components.co ? components.co / 1000 : null, // Convert to mg/m³
      api_source: 'openweather',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Store OpenWeather data in Supabase
   */
  async storeOpenWeatherData(dataArray) {
    if (!this.supabase || !dataArray || dataArray.length === 0) return false;

    try {
      const { data, error } = await this.supabase
        .from('openweather_readings')
        .insert(dataArray);

      if (error) {
        console.error('Error storing OpenWeather data:', error);
        return false;
      }

      console.log(`✅ Stored ${dataArray.length} OpenWeather readings`);
      return true;
    } catch (error) {
      console.error('Error in storeOpenWeatherData:', error);
      return false;
    }
  }

  /**
   * Smart collection process - optimizes API usage
   */
  async smartCollectData(stations) {
    if (!stations || stations.length === 0)
      return { success: false, message: 'No stations provided' };

    console.log('🔄 Starting smart OpenWeather data collection...');

    // Check API usage limits
    const usage = await this.checkApiUsage();
    console.log(
      `📊 API Usage: ${usage.used}/${this.dailyLimit} (${usage.percentageUsed?.toFixed(1) || 0}%)`,
    );

    if (!usage.canMakeCall) {
      console.warn(
        '⚠️ Daily API limit reached, skipping OpenWeather collection',
      );
      return {
        success: false,
        message: `Daily API limit reached (${usage.used}/${this.dailyLimit})`,
        usage,
      };
    }

    // Identify stations needing data
    const stationsNeedingData =
      await this.identifyStationsNeedingData(stations);

    if (stationsNeedingData.length === 0) {
      console.log('✅ All stations have recent OpenWeather data');
      return {
        success: true,
        message: 'No new data needed',
        collected: 0,
        usage,
      };
    }

    // Limit calls based on remaining quota
    const maxCallsToday = Math.min(
      stationsNeedingData.length,
      usage.remaining,
      50, // Don't use more than 50 calls per collection cycle
    );

    console.log(
      `📞 Planning ${maxCallsToday} API calls for ${stationsNeedingData.length} stations`,
    );

    // Process in batches
    const collectedData = [];
    let successfulCalls = 0;
    let failedCalls = 0;

    for (let i = 0; i < maxCallsToday; i += this.batchSize) {
      const batch = stationsNeedingData.slice(i, i + this.batchSize);

      const batchPromises = batch.map(async (item) => {
        const data = await this.fetchFromOpenWeather(item.lat, item.lon);
        if (data) {
          successfulCalls++;
          return data;
        } else {
          failedCalls++;
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((result) => result !== null);

      if (validResults.length > 0) {
        collectedData.push(...validResults);
      }

      // Add small delay between batches to be respectful
      if (i + this.batchSize < maxCallsToday) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Store all collected data
    let stored = false;
    if (collectedData.length > 0) {
      stored = await this.storeOpenWeatherData(collectedData);
    }

    const finalUsage = await this.checkApiUsage();

    console.log(`✅ OpenWeather collection complete:`);
    console.log(
      `   📞 API calls: ${successfulCalls} successful, ${failedCalls} failed`,
    );
    console.log(`   💾 Data points collected: ${collectedData.length}`);
    console.log(`   📊 Updated usage: ${finalUsage.used}/${this.dailyLimit}`);

    return {
      success: stored,
      collected: collectedData.length,
      apiCalls: successfulCalls + failedCalls,
      successfulCalls,
      failedCalls,
      usage: finalUsage,
      message: `Collected ${collectedData.length} data points with ${successfulCalls} API calls`,
    };
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats() {
    if (!this.supabase) return null;

    try {
      // Get today's OpenWeather data count
      const today = new Date().toISOString().split('T')[0];

      const { data: todayData, error: todayError } = await this.supabase
        .from('openweather_readings')
        .select('id')
        .gte('timestamp', `${today}T00:00:00Z`)
        .lte('timestamp', `${today}T23:59:59Z`);

      // Get API usage
      const usage = await this.checkApiUsage();

      // Get total stored records (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: totalData, error: totalError } = await this.supabase
        .from('openweather_readings')
        .select('id')
        .gte('timestamp', sevenDaysAgo.toISOString());

      return {
        todayCollected: todayData?.length || 0,
        totalStored: totalData?.length || 0,
        apiUsage: usage,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const openWeatherCollector = new OpenWeatherCollector();

// Make globally available for testing
if (typeof window !== 'undefined') {
  window.openWeatherCollector = openWeatherCollector;
}
