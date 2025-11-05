/**
 * Fetch Google AQHI data directly from Supabase
 * For the 15 community monitoring locations
 */

import { supabase } from '../lib/supabase.js';

// Use shared Supabase client
function getSupabaseClient() {
  return supabase;
}

/**
 * Fetch the latest AQHI data for all 15 community locations
 * @returns {Promise<Array>} Array of stations with AQHI data
 */
export async function fetchGoogleAQHIStations() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    // Get the latest data for each location
    // Group by location_id and get the most recent hour_timestamp
    const { data, error } = await supabase
      .from('google_aqhi_hourly')
      .select('*')
      .order('hour_timestamp', { ascending: false })
      .limit(15); // Get latest 15 records (one per location)

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Get unique locations (in case there are duplicates)
    const locationMap = new Map();
    data.forEach(row => {
      if (!locationMap.has(row.location_id) ||
          new Date(row.hour_timestamp) > new Date(locationMap.get(row.location_id).hour_timestamp)) {
        locationMap.set(row.location_id, row);
      }
    });

    // Get community location names
    const LOCATION_NAMES = {
      1: 'มัสยยิดบ้านตึกดิน',
      2: 'หลังศูนย์จันทร์ฉิมไพบูลย์',
      3: 'ปลายซอยศักดิ์เจริญ',
      4: 'ซอยท่าดินแดง 14 และ 16',
      5: 'วัดไชยทิศ',
      6: 'รักเจริญ',
      7: 'หมู่ 7 ราษฎร์บูรณะ',
      8: 'ชุมชนสวัสดี',
      9: 'สาหร่ายทองคำ',
      10: 'นันทวันเซ็นต์ 2',
      11: 'ซอยพระเจน',
      12: 'มัสยิดมหานาค',
      13: 'ชุมชนสะพานหัน',
      14: 'บ้านมั่นคงฟ้าใหม่',
      15: 'บ่อฝรั่งริมน้ำ'
    };

    // Get community location coordinates
    const LOCATION_COORDS = {
      1: { lat: 13.758108, lng: 100.500366 },
      2: { lat: 13.720943, lng: 100.481581 },
      3: { lat: 13.733446, lng: 100.463527 },
      4: { lat: 13.735493, lng: 100.504763 },
      5: { lat: 13.768083, lng: 100.463323 },
      6: { lat: 13.716707, lng: 100.355342 },
      7: { lat: 13.66671, lng: 100.515025 },
      8: { lat: 13.772018, lng: 100.558131 },
      9: { lat: 13.701217, lng: 100.612882 },
      10: { lat: 13.845409, lng: 100.88052 },
      11: { lat: 13.731048, lng: 100.546676 },
      12: { lat: 13.752959, lng: 100.515871 },
      13: { lat: 13.74281, lng: 100.502217 },
      14: { lat: 13.79493179, lng: 100.5014054 },
      15: { lat: 13.82163586, lng: 100.5425091 }
    };

    // Transform to station format
    const stations = Array.from(locationMap.values()).map(row => {
      const coords = LOCATION_COORDS[row.location_id] || { lat: 0, lng: 0 };

      return {
        uid: `google-${row.location_id}`,
        lat: coords.lat,
        lon: coords.lng,
        aqi: row.aqhi ? Math.round(row.aqhi * 10) : 0, // Convert AQHI to display value
        station: {
          name: LOCATION_NAMES[row.location_id] || `Location ${row.location_id}`,
          time: row.hour_timestamp
        },
        aqhi: {
          value: row.aqhi,
          level: getAQHILevel(row.aqhi),
          category: row.aqhi_category,
          calculationMethod: '3h_avg',
          dataQuality: 'excellent',
          dataQualityIcon: '🎯',
          dataSources: 'google_supabase',
          averages: {
            pm25: row.pm25_3h_avg,
            pm10: row.pm10_3h_avg,
            o3: row.o3_3h_avg,
            no2: row.no2_3h_avg,
            so2: row.so2_3h_avg
          },
          current: {
            pm25: row.pm25,
            pm10: row.pm10,
            o3: row.o3,
            no2: row.no2,
            so2: row.so2,
            co: row.co
          }
        },
        // Include raw pollutant data for compatibility
        iaqi: {
          pm25: { v: row.pm25 },
          pm10: { v: row.pm10 },
          o3: { v: row.o3 },
          no2: { v: row.no2 },
          so2: { v: row.so2 },
          co: { v: row.co }
        }
      };
    });
    return stations;

  } catch (error) {
    return [];
  }
}

/**
 * Fetch Google AQHI history for a specific location
 * @param {number} locationId - Location ID (1-15)
 * @param {number} hours - Number of hours of history (24 or 168)
 * @returns {Promise<Array>} Array of historical AQHI data points
 */
export async function fetchGoogleAQHIHistory(locationId, hours = 24) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return [];
    }

    // Query google_aqhi_hourly for the specified location and time range
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - hours);

    const { data, error } = await supabase
      .from('google_aqhi_hourly')
      .select('*')
      .eq('location_id', locationId)
      .gte('hour_timestamp', hoursAgo.toISOString())
      .order('hour_timestamp', { ascending: true });

    if (error) {
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Transform to chart-compatible format
    const history = data.map(row => ({
      timestamp: row.hour_timestamp,
      pm25: row.pm25,
      pm10: row.pm10,
      o3: row.o3,
      no2: row.no2,
      so2: row.so2,
      co: row.co,
      aqhi: row.aqhi,
      // For chart display
      pm25_3h_avg: row.pm25_3h_avg,
      pm10_3h_avg: row.pm10_3h_avg,
      o3_3h_avg: row.o3_3h_avg,
      no2_3h_avg: row.no2_3h_avg
    }));

    return history;

  } catch (error) {
    return [];
  }
}

/**
 * Get AQHI level information
 * @param {number} aqhi - AQHI value
 * @returns {Object} Level information
 */
function getAQHILevel(aqhi) {
  if (aqhi === null || aqhi === undefined) {
    return { key: 'unknown', label: 'Unknown', color: '#999999' };
  }

  if (aqhi < 4) {
    return { key: 'LOW', label: 'Low Risk', color: '#10b981' };
  } else if (aqhi < 7) {
    return { key: 'MODERATE', label: 'Moderate Risk', color: '#f59e0b' };
  } else if (aqhi < 10) {
    return { key: 'HIGH', label: 'High Risk', color: '#ef4444' };
  } else {
    return { key: 'VERY_HIGH', label: 'Very High Risk', color: '#7f1d1d' };
  }
}
