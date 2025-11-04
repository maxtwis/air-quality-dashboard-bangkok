import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log('🔍 Checking Supabase google_aqhi_hourly table...\n');

// Get latest data
const { data, error } = await supabase
  .from('google_aqhi_hourly')
  .select('*')
  .order('hour_timestamp', { ascending: false })
  .limit(15);

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log('⚠️  No data found in google_aqhi_hourly table');
  process.exit(0);
}

console.log(`✅ Found ${data.length} records\n`);

// Group by location_id
const byLocation = {};
data.forEach(row => {
  if (!byLocation[row.location_id]) {
    byLocation[row.location_id] = [];
  }
  byLocation[row.location_id].push(row);
});

console.log(`📊 Unique locations: ${Object.keys(byLocation).length}\n`);

// Show latest for each location
Object.entries(byLocation).forEach(([locId, records]) => {
  const latest = records[0];
  const timestamp = new Date(latest.hour_timestamp);
  console.log(`Location ${locId}:`);
  console.log(`  Last updated: ${timestamp.toLocaleString()}`);
  console.log(`  AQHI: ${latest.aqhi} (${latest.aqhi_category})`);
  console.log(`  PM2.5: ${latest.pm25} μg/m³ (3h avg: ${latest.pm25_3h_avg})`);
  console.log(`  Total records: ${records.length}`);
  console.log('');
});

// Check if data is coming from all 3 batches
console.log('\n📈 Records per location:');
for (let i = 1; i <= 15; i++) {
  const count = byLocation[i]?.length || 0;
  const batch = i <= 5 ? 'batch=1' : i <= 10 ? 'batch=2' : 'batch=3';
  console.log(`  Location ${i.toString().padStart(2)}: ${count} records (${batch})`);
}
