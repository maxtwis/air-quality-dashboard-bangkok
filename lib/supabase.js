// Supabase client configuration for Bangkok Air Quality Dashboard
import { createClient } from '@supabase/supabase-js';

// For browser environment, we'll use a simple config approach
// In production, these should be set as environment variables or build-time constants
const supabaseUrl = window.SUPABASE_URL || 'https://xqvjrovzhupdfwvdikpo.supabase.co';
const supabaseAnonKey = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxdmpyb3Z6aHVwZGZ3dmRpa3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTQyMjMsImV4cCI6MjA3MzUzMDIyM30.rzJ8-LnZh2dITbh7HcIXJ32BQ1MN-F-O5hCmO0jzIDo';

// Simple validation
if (supabaseUrl.includes('https://xqvjrovzhupdfwvdikpo.supabase.co') || supabaseAnonKey.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxdmpyb3Z6aHVwZGZ3dmRpa3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NTQyMjMsImV4cCI6MjA3MzUzMDIyM30.rzJ8-LnZh2dITbh7HcIXJ32BQ1MN-F-O5hCmO0jzIDo')) {
  console.warn('⚠️ Supabase not configured. Please update supabase.js with your credentials or set window.SUPABASE_URL and window.SUPABASE_ANON_KEY');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We don't need user authentication for this app
    autoRefreshToken: false
  },
  db: {
    schema: 'public'
  }
});

// Database helper functions for air quality data
export class AirQualityDB {
  
  /**
   * Insert air quality readings (bulk insert for efficiency)
   */
  static async insertReadings(readings) {
    const { data, error } = await supabase
      .from('air_quality_readings')
      .insert(readings);
    
    if (error) {
      console.error('Error inserting readings:', error);
      throw error;
    }
    
    console.log(`✅ Inserted ${readings.length} air quality readings`);
    return data;
  }
  
  /**
   * Get current 3-hour moving averages for all stations
   */
  static async get3HourAverages(stationId = null) {
    let query = supabase
      .from('current_3h_averages')
      .select('*');
    
    if (stationId) {
      query = query.eq('station_uid', stationId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching 3-hour averages:', error);
      throw error;
    }
    
    return data;
  }
  
  /**
   * Get all active stations
   */
  static async getStations() {
    const { data, error } = await supabase
      .from('stations')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching stations:', error);
      throw error;
    }
    
    return data;
  }
  
  /**
   * Get recent readings for a specific station
   */
  static async getStationReadings(stationId, hours = 3) {
    const { data, error } = await supabase
      .from('air_quality_readings')
      .select('*')
      .eq('station_uid', stationId)
      .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('Error fetching station readings:', error);
      throw error;
    }
    
    return data;
  }
  
  /**
   * Clean up old data (called by cron job)
   */
  static async cleanupOldData() {
    const { data, error } = await supabase.rpc('cleanup_old_data');
    
    if (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
    
    console.log(`🧹 Cleaned up ${data} old records`);
    return data;
  }
  
  /**
   * Get database statistics
   */
  static async getDBStats() {
    try {
      // Get total readings count
      const { count: totalReadings } = await supabase
        .from('air_quality_readings')
        .select('*', { count: 'exact', head: true });
      
      // Get active stations count
      const { count: activeStations } = await supabase
        .from('stations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      // Get readings from last 24 hours
      const { count: recentReadings } = await supabase
        .from('air_quality_readings')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      return {
        totalReadings: totalReadings || 0,
        activeStations: activeStations || 0,
        recentReadings: recentReadings || 0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting DB stats:', error);
      return null;
    }
  }
  
  /**
   * Test database connection
   */
  static async testConnection() {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      
      console.log('✅ Supabase connection successful');
      return true;
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      return false;
    }
  }
}

// Export configured client
export default supabase;