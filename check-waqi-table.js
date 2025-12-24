import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local file
config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkWaqiData() {
  console.log('🔍 Checking waqi_data table...\n');

  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('waqi_data')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log('❌ Error accessing waqi_data table:', countError.message);
      console.log('   This table may not exist or may be named differently.\n');

      // Try to list all tables
      console.log('📋 Attempting to check air_quality_readings table instead...\n');

      const { count: aqrCount, error: aqrError } = await supabase
        .from('air_quality_readings')
        .select('*', { count: 'exact', head: true });

      if (aqrError) {
        console.log('❌ Error:', aqrError.message);
        return;
      }

      console.log(`✅ air_quality_readings table has ${aqrCount?.toLocaleString() || 0} records`);

      // Get a sample record
      const { data: sample } = await supabase
        .from('air_quality_readings')
        .select('*')
        .limit(1);

      if (sample && sample.length > 0) {
        console.log('\n📊 Sample record structure:');
        console.log(JSON.stringify(sample[0], null, 2));
      }

      return;
    }

    console.log(`✅ Total records in waqi_data: ${totalCount?.toLocaleString() || 0}\n`);

    // Get latest records
    const { data: latest, error: latestError } = await supabase
      .from('waqi_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(5);

    if (!latestError && latest) {
      console.log('📝 Latest 5 records:');
      latest.forEach((record, i) => {
        console.log(`  ${i + 1}. ${record.station_uid} - ${new Date(record.timestamp).toLocaleString()}`);
        console.log(`     AQI: ${record.aqi || 'N/A'}, PM2.5: ${record.pm25 || 'N/A'}`);
      });
    }

    // Estimate storage size (rough calculation)
    if (totalCount > 0) {
      const avgRecordSize = 500; // bytes (rough estimate for JSON + columns)
      const estimatedMB = (totalCount * avgRecordSize) / (1024 * 1024);
      console.log(`\n💾 Estimated storage: ~${estimatedMB.toFixed(2)} MB`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkWaqiData();
