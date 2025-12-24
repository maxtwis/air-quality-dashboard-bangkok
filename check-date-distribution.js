import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkDateDistribution() {
  console.log('📅 Checking date distribution in waqi_data...\n');

  try {
    // Get oldest and newest records
    const { data: oldest } = await supabase
      .from('waqi_data')
      .select('timestamp, station_uid')
      .order('timestamp', { ascending: true })
      .limit(1);

    const { data: newest } = await supabase
      .from('waqi_data')
      .select('timestamp, station_uid')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (oldest && oldest.length > 0) {
      console.log('📊 Date Range:');
      console.log(`   Oldest: ${new Date(oldest[0].timestamp).toLocaleString()}`);
      console.log(`   Newest: ${new Date(newest[0].timestamp).toLocaleString()}`);

      const ageInDays = (new Date(newest[0].timestamp) - new Date(oldest[0].timestamp)) / (1000 * 60 * 60 * 24);
      console.log(`   Range: ${ageInDays.toFixed(1)} days\n`);
    }

    // Count records by day
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const { count: last7Days } = await supabase
      .from('waqi_data')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', cutoffDate.toISOString());

    const { count: total } = await supabase
      .from('waqi_data')
      .select('*', { count: 'exact', head: true });

    console.log('📈 Record Distribution:');
    console.log(`   Last 7 days: ${last7Days?.toLocaleString() || 0}`);
    console.log(`   Total: ${total?.toLocaleString() || 0}`);
    console.log(`   Older than 7 days: ${((total || 0) - (last7Days || 0)).toLocaleString()}\n`);

    // Count unique stations
    const { data: stations } = await supabase
      .from('waqi_data')
      .select('station_uid')
      .limit(10000);

    if (stations) {
      const uniqueStations = new Set(stations.map(s => s.station_uid)).size;
      console.log(`📍 Unique stations: ${uniqueStations}`);
      console.log(`   Records per station (avg): ${Math.round((total || 0) / uniqueStations)}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDateDistribution();
