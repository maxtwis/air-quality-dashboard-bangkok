/**
 * Cleanup Script - Delete Old Records via Supabase API
 * This script deletes old records in small batches using the Supabase client API
 * to avoid SQL timeout errors.
 *
 * Usage: node cleanup-via-api.js
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Configuration
const KEEP_DAYS = 7; // Keep last 7 days of data
const BATCH_SIZE = 1000; // Delete 1000 records at a time
const DELAY_MS = 1000; // Wait 1 second between batches

async function deleteOldRecords() {
  console.log('🗑️  Starting cleanup process...\n');

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - KEEP_DAYS);
  const cutoffISO = cutoffDate.toISOString();

  console.log(`📅 Keeping records after: ${cutoffDate.toLocaleString()}`);
  console.log(`🗑️  Deleting records before: ${cutoffDate.toLocaleString()}\n`);

  // First, count how many records will be deleted
  const { count: totalToDelete, error: countError } = await supabase
    .from('waqi_data')
    .select('*', { count: 'exact', head: true })
    .lt('timestamp', cutoffISO);

  if (countError) {
    console.error('❌ Error counting records:', countError);
    return;
  }

  console.log(`📊 Total records to delete: ${totalToDelete?.toLocaleString() || 0}\n`);

  if (!totalToDelete || totalToDelete === 0) {
    console.log('✅ No old records to delete!');
    return;
  }

  // Confirm before proceeding
  console.log('⚠️  This will permanently delete old records!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  let deletedTotal = 0;
  let batchNumber = 0;

  while (deletedTotal < totalToDelete) {
    batchNumber++;

    try {
      // Delete one batch
      const { error: deleteError, count } = await supabase
        .from('waqi_data')
        .delete({ count: 'exact' })
        .lt('timestamp', cutoffISO)
        .limit(BATCH_SIZE);

      if (deleteError) {
        console.error(`❌ Error in batch ${batchNumber}:`, deleteError.message);
        break;
      }

      deletedTotal += count || BATCH_SIZE;
      const progress = Math.min(100, (deletedTotal / totalToDelete) * 100);

      console.log(`✓ Batch ${batchNumber}: Deleted ${count || BATCH_SIZE} records (${progress.toFixed(1)}% complete)`);

      // Wait before next batch to avoid rate limits
      if (deletedTotal < totalToDelete) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }

    } catch (error) {
      console.error(`❌ Exception in batch ${batchNumber}:`, error.message);
      break;
    }
  }

  console.log(`\n✅ Deletion complete! Deleted ${deletedTotal.toLocaleString()} records`);

  // Get final statistics
  const { count: remainingCount } = await supabase
    .from('waqi_data')
    .select('*', { count: 'exact', head: true });

  const { data: dateRange } = await supabase
    .from('waqi_data')
    .select('timestamp')
    .order('timestamp', { ascending: true })
    .limit(1);

  const { data: latestDate } = await supabase
    .from('waqi_data')
    .select('timestamp')
    .order('timestamp', { ascending: false })
    .limit(1);

  console.log('\n📊 Final Statistics:');
  console.log(`   Remaining records: ${remainingCount?.toLocaleString() || 0}`);
  if (dateRange && dateRange.length > 0) {
    console.log(`   Oldest record: ${new Date(dateRange[0].timestamp).toLocaleString()}`);
  }
  if (latestDate && latestDate.length > 0) {
    console.log(`   Newest record: ${new Date(latestDate[0].timestamp).toLocaleString()}`);
  }

  console.log('\n🎉 Next step: Run cleanup-remove-aqi-column.sql to remove AQI column');
}

// Run the cleanup
deleteOldRecords().catch(console.error);
