import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function verifyWaqiTable() {
  console.log('🔍 Analyzing waqi_data table structure...\n');

  try {
    // Get a sample record to see the structure
    const { data: sample, error } = await supabase
      .from('waqi_data')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    if (sample && sample.length > 0) {
      console.log('📊 Current table structure (sample record):');
      console.log(JSON.stringify(sample[0], null, 2));

      console.log('\n📋 Columns in waqi_data:');
      Object.keys(sample[0]).forEach(key => {
        const value = sample[0][key];
        const type = value === null ? 'null' : typeof value;
        console.log(`  - ${key}: ${type}`);
      });

      // Check if AQI column exists
      const hasAQI = 'aqi' in sample[0];
      console.log(`\n${hasAQI ? '⚠️' : '✅'} AQI column ${hasAQI ? 'EXISTS' : 'NOT FOUND'}`);

      if (hasAQI) {
        console.log('\n💡 You can remove the AQI column by running:');
        console.log('   Run cleanup-aqi-data.sql in your Supabase SQL Editor\n');
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

verifyWaqiTable();
