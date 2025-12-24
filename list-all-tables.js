import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local file
config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function listAllTables() {
  console.log('📋 Checking all tables in the database...\n');

  const tablesToCheck = [
    'air_quality_readings',
    'waqi_data',
    'google_aqhi_hourly',
    'google_supplements',
    'stations',
    'aqhi_data',
    'combined_3h_averages'
  ];

  for (const tableName of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${tableName}: Does not exist or inaccessible`);
      } else {
        const formattedCount = (count || 0).toLocaleString();
        const estimatedMB = ((count || 0) * 500) / (1024 * 1024);
        console.log(`✅ ${tableName}: ${formattedCount} records (~${estimatedMB.toFixed(2)} MB)`);
      }
    } catch (err) {
      console.log(`❌ ${tableName}: Error - ${err.message}`);
    }
  }
}

listAllTables();
