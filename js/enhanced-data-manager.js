// Enhanced Data Management - coordinates both WAQI and OpenWeather data
// Provides a unified interface for enhanced AQHI calculations

import { openWeatherCollector } from './openweather-collector.js';

class EnhancedDataManager {
  constructor() {
    this.lastCollectionTime = 0;
    this.collectionInterval = 10 * 60 * 1000; // 10 minutes
    this.isCollecting = false;
  }

  /**
   * Check if it's time to collect new data
   */
  shouldCollectData() {
    const now = Date.now();
    return now - this.lastCollectionTime >= this.collectionInterval;
  }

  /**
   * Trigger enhanced data collection cycle
   * This would typically be called by a cron job or scheduled task
   */
  async triggerDataCollection(stations) {
    if (this.isCollecting) {
      console.log('⏳ Data collection already in progress');
      return { success: false, message: 'Collection already in progress' };
    }

    if (!this.shouldCollectData()) {
      const nextCollection = new Date(
        this.lastCollectionTime + this.collectionInterval,
      );
      console.log(
        `⏰ Next collection scheduled for: ${nextCollection.toLocaleTimeString()}`,
      );
      return {
        success: false,
        message: 'Too soon since last collection',
        nextCollection: nextCollection.toISOString(),
      };
    }

    console.log('🚀 Starting enhanced data collection cycle...');
    this.isCollecting = true;

    try {
      // Phase 1: Collect OpenWeather data for stations that need it
      const openWeatherResult =
        await openWeatherCollector.smartCollectData(stations);

      this.lastCollectionTime = Date.now();

      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        openWeather: openWeatherResult,
        nextCollection: new Date(
          this.lastCollectionTime + this.collectionInterval,
        ).toISOString(),
      };

      console.log(
        '✅ Enhanced data collection completed:',
        result.openWeather.message,
      );

      return result;
    } catch (error) {
      console.error('❌ Enhanced data collection failed:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Get comprehensive collection statistics
   */
  async getCollectionStatistics() {
    try {
      const openWeatherStats = await openWeatherCollector.getCollectionStats();

      return {
        openWeather: openWeatherStats,
        lastCollection: new Date(this.lastCollectionTime).toISOString(),
        nextCollection: new Date(
          this.lastCollectionTime + this.collectionInterval,
        ).toISOString(),
        collectionStatus: this.isCollecting ? 'active' : 'idle',
      };
    } catch (error) {
      console.error('Error getting collection statistics:', error);
      return null;
    }
  }

  /**
   * Manual trigger for testing (ignores timing constraints)
   */
  async forceDataCollection(stations) {
    console.log('🔧 Force triggering data collection (manual)...');

    this.isCollecting = true;
    try {
      const result = await openWeatherCollector.smartCollectData(stations);
      this.lastCollectionTime = Date.now();
      return result;
    } catch (error) {
      console.error('Force collection failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Check system health and API usage
   */
  async getSystemHealth() {
    try {
      const usage = await openWeatherCollector.checkApiUsage();
      const stats = await this.getCollectionStatistics();

      return {
        status: 'healthy',
        apiUsage: usage,
        collections: stats,
        recommendations: this.generateRecommendations(usage),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Generate usage recommendations
   */
  generateRecommendations(usage) {
    const recommendations = [];

    if (usage.percentageUsed > 80) {
      recommendations.push(
        '⚠️ High API usage - consider reducing collection frequency',
      );
    } else if (usage.percentageUsed < 20) {
      recommendations.push(
        '💡 Low API usage - can increase collection frequency for better coverage',
      );
    }

    if (usage.remaining < 50) {
      recommendations.push(
        '🔴 Low remaining quota - collection may be throttled',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ API usage is within optimal range');
    }

    return recommendations;
  }
}

// Export singleton instance
export const enhancedDataManager = new EnhancedDataManager();

// Make globally available for testing and debugging
if (typeof window !== 'undefined') {
  window.enhancedDataManager = enhancedDataManager;

  // Add convenience functions to window for easy testing
  window.collectOpenWeatherData = async (stations) => {
    return await enhancedDataManager.forceDataCollection(stations);
  };

  window.getDataCollectionStats = async () => {
    return await enhancedDataManager.getCollectionStatistics();
  };

  window.getSystemHealth = async () => {
    return await enhancedDataManager.getSystemHealth();
  };
}
