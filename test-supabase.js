// Node.js test script for Supabase connection
// Run with: node test-supabase.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Get credentials from environment or use hardcoded values
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plrjbynejtbuawxijejf.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscmpieW5lanRidWF3eGlqZWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTU1MjksImV4cCI6MjA3Mjk5MTUyOX0.BuoYEm1oloP6Fvt87fZagOqRAwPw8B5kf9cUh13uuQk';

console.log('🔧 Supabase Test Script');
console.log('========================');
console.log(`URL: ${SUPABASE_URL}`);
console.log(`Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
console.log('');

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test functions
async function testConnection() {
    console.log('🔗 Testing connection...');
    
    try {
        const { data, error } = await supabase
            .from('stations')
            .select('count')
            .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Connection successful!');
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        return false;
    }
}

async function testInsert() {
    console.log('\n📝 Testing data insertion...');
    
    const testStation = {
        uid: 99999,
        name: 'Test Station Bangkok',
        lat: 13.7563,
        lon: 100.5018,
        city: 'Bangkok',
        country: 'Thailand'
    };
    
    const testReading = {
        station_uid: 99999,
        timestamp: new Date().toISOString(),
        lat: 13.7563,
        lon: 100.5018,
        aqi: 85,
        pm25: 75.5,
        no2: 45.2,
        o3: 35.8,
        so2: 25.1,
        pm10: 90.3,
        co: 1.2,
        station_name: 'Test Station Bangkok'
    };

    try {
        // Insert test station
        const { error: stationError } = await supabase
            .from('stations')
            .upsert([testStation]);
        
        if (stationError) throw stationError;
        console.log('✅ Test station created');
        
        // Insert test reading
        const { data, error: readingError } = await supabase
            .from('air_quality_readings')
            .insert([testReading])
            .select();
        
        if (readingError) throw readingError;
        console.log('✅ Test reading inserted:', data[0].id);
        
        // Clean up
        await supabase
            .from('air_quality_readings')
            .delete()
            .eq('station_uid', 99999);
        
        await supabase
            .from('stations')
            .delete()
            .eq('uid', 99999);
        
        console.log('🧹 Test data cleaned up');
        return true;
        
    } catch (error) {
        console.error('❌ Insert failed:', error.message);
        return false;
    }
}

async function testQuery() {
    console.log('\n🔍 Testing queries...');
    
    try {
        // Query stations
        const { data: stations, error: stationsError } = await supabase
            .from('stations')
            .select('*')
            .limit(5);
        
        if (stationsError) throw stationsError;
        console.log(`✅ Found ${stations.length} stations`);
        
        // Query recent readings
        const { data: readings, error: readingsError } = await supabase
            .from('air_quality_readings')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(5);
        
        if (readingsError) throw readingsError;
        console.log(`✅ Found ${readings.length} recent readings`);
        
        // Test AQHI calculation function
        const { data: aqhiResult, error: aqhiError } = await supabase
            .rpc('calculate_aqhi', {
                pm25_val: 50,
                no2_val: 30,
                o3_val: 40,
                so2_val: 20
            });
        
        if (aqhiError) throw aqhiError;
        console.log(`✅ AQHI calculation test: ${aqhiResult}`);
        
        // Query 3-hour averages view
        const { data: averages, error: avgError } = await supabase
            .from('current_3h_averages')
            .select('*')
            .limit(3);
        
        if (avgError && avgError.code !== 'PGRST116') {
            throw avgError;
        }
        
        console.log(`✅ Found ${averages?.length || 0} stations with 3-hour averages`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Query failed:', error.message);
        return false;
    }
}

async function getStats() {
    console.log('\n📊 Database statistics...');
    
    try {
        const { count: readingsCount } = await supabase
            .from('air_quality_readings')
            .select('*', { count: 'exact', head: true });
        
        const { count: stationsCount } = await supabase
            .from('stations')
            .select('*', { count: 'exact', head: true });
        
        const { count: activeStationsCount } = await supabase
            .from('stations')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
        
        console.log('┌─────────────────────────────┐');
        console.log('│ Database Statistics         │');
        console.log('├─────────────────────────────┤');
        console.log(`│ Total Readings:    ${String(readingsCount || 0).padStart(8)} │`);
        console.log(`│ Total Stations:    ${String(stationsCount || 0).padStart(8)} │`);
        console.log(`│ Active Stations:   ${String(activeStationsCount || 0).padStart(8)} │`);
        console.log('└─────────────────────────────┘');
        
        return true;
        
    } catch (error) {
        console.error('❌ Failed to get stats:', error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting Supabase tests...\n');
    
    const results = {
        connection: await testConnection(),
        insert: await testInsert(),
        query: await testQuery(),
        stats: await getStats()
    };
    
    console.log('\n📋 Test Summary:');
    console.log('================');
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test.charAt(0).toUpperCase() + test.slice(1)}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const allPassed = Object.values(results).every(r => r);
    
    if (allPassed) {
        console.log('\n🎉 All tests passed! Your Supabase setup is working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Please check the error messages above.');
    }
}

// Run tests
runAllTests().catch(console.error);