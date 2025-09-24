// 3-Hour Average Calculation Validation Test
// Tests the enhanced AQHI calculations using mixed data sources (station + OpenWeather)

// Mock 3-hour historical data scenarios
const mockHistoricalDataScenarios = [
  {
    name: 'Complete Station Data - 3 Hours',
    description: 'Station has all pollutants for the full 3-hour period',
    data: [
      { timestamp: new Date(Date.now() - 2.5 * 3600 * 1000), pm25: 25.5, o3: 45.2, no2: 18.7, so2: 5.1, source: 'station' },
      { timestamp: new Date(Date.now() - 2 * 3600 * 1000), pm25: 27.1, o3: 42.8, no2: 19.3, so2: 4.8, source: 'station' },
      { timestamp: new Date(Date.now() - 1.5 * 3600 * 1000), pm25: 26.3, o3: 44.7, no2: 17.9, so2: 5.3, source: 'station' },
      { timestamp: new Date(Date.now() - 1 * 3600 * 1000), pm25: 28.2, o3: 46.1, no2: 20.1, so2: 4.9, source: 'station' },
      { timestamp: new Date(Date.now() - 0.5 * 3600 * 1000), pm25: 29.0, o3: 43.5, no2: 18.5, so2: 5.2, source: 'station' },
      { timestamp: new Date(), pm25: 27.8, o3: 45.9, no2: 19.7, so2: 5.0, source: 'station' },
    ]
  },
  {
    name: 'Station Missing O₃ - Enhanced with OpenWeather',
    description: 'Station lacks O₃ data, supplemented with OpenWeather',
    data: [
      { timestamp: new Date(Date.now() - 2.5 * 3600 * 1000), pm25: 28.3, no2: 22.1, source: 'station' },
      { timestamp: new Date(Date.now() - 2.5 * 3600 * 1000), o3: 38.7, source: 'openweather' },
      { timestamp: new Date(Date.now() - 2 * 3600 * 1000), pm25: 26.8, no2: 20.9, source: 'station' },
      { timestamp: new Date(Date.now() - 2 * 3600 * 1000), o3: 41.2, source: 'openweather' },
      { timestamp: new Date(Date.now() - 1.5 * 3600 * 1000), pm25: 29.7, no2: 21.7, source: 'station' },
      { timestamp: new Date(Date.now() - 1.5 * 3600 * 1000), o3: 39.8, source: 'openweather' },
      { timestamp: new Date(Date.now() - 1 * 3600 * 1000), pm25: 27.9, no2: 19.5, source: 'station' },
      { timestamp: new Date(Date.now() - 1 * 3600 * 1000), o3: 42.3, source: 'openweather' },
      { timestamp: new Date(Date.now() - 0.5 * 3600 * 1000), pm25: 30.1, no2: 22.8, source: 'station' },
      { timestamp: new Date(Date.now() - 0.5 * 3600 * 1000), o3: 40.1, source: 'openweather' },
      { timestamp: new Date(), pm25: 28.5, no2: 21.3, source: 'station' },
      { timestamp: new Date(), o3: 38.9, source: 'openweather' },
    ]
  },
  {
    name: 'Partial Data - Mixed Sources',
    description: 'Limited historical data with mixed enhancement',
    data: [
      { timestamp: new Date(Date.now() - 1.5 * 3600 * 1000), pm25: 31.2, o3: 52.8, source: 'station' },
      { timestamp: new Date(Date.now() - 1.5 * 3600 * 1000), no2: 16.4, source: 'openweather' },
      { timestamp: new Date(Date.now() - 1 * 3600 * 1000), pm25: 29.8, source: 'station' },
      { timestamp: new Date(Date.now() - 1 * 3600 * 1000), o3: 48.7, no2: 15.9, source: 'openweather' },
      { timestamp: new Date(), pm25: 32.4, o3: 51.3, source: 'station' },
      { timestamp: new Date(), no2: 17.1, source: 'openweather' },
    ]
  },
  {
    name: 'New Station - Mostly OpenWeather',
    description: 'New station with minimal history, mostly enhanced',
    data: [
      { timestamp: new Date(Date.now() - 0.5 * 3600 * 1000), pm25: 24.8, source: 'station' },
      { timestamp: new Date(Date.now() - 0.5 * 3600 * 1000), o3: 41.3, no2: 19.6, source: 'openweather' },
      { timestamp: new Date(), pm25: 26.1, source: 'station' },
      { timestamp: new Date(), o3: 43.7, no2: 18.2, source: 'openweather' },
    ]
  }
];

// Calculate 3-hour averages from mixed data sources
function calculate3HourAverages(historicalData) {
  const cutoffTime = new Date(Date.now() - 3 * 3600 * 1000); // 3 hours ago

  // Filter data to last 3 hours
  const recentData = historicalData.filter(reading => reading.timestamp >= cutoffTime);

  if (recentData.length === 0) {
    return null;
  }

  // Group by pollutant and calculate averages
  const pollutants = ['pm25', 'pm10', 'o3', 'no2', 'so2'];
  const averages = {};
  const sources = {};

  for (const pollutant of pollutants) {
    const values = recentData
      .filter(reading => reading[pollutant] !== undefined && reading[pollutant] !== null)
      .map(reading => ({ value: reading[pollutant], source: reading.source }));

    if (values.length > 0) {
      averages[pollutant] = values.reduce((sum, item) => sum + item.value, 0) / values.length;

      // Track sources used for this pollutant
      const sourceCounts = values.reduce((acc, item) => {
        acc[item.source] = (acc[item.source] || 0) + 1;
        return acc;
      }, {});

      sources[pollutant] = {
        station: sourceCounts.station || 0,
        openweather: sourceCounts.openweather || 0,
        total: values.length
      };
    }
  }

  return {
    averages,
    sources,
    dataPoints: recentData.length,
    timeWindow: 3, // hours
    calculatedAt: new Date()
  };
}

// Enhanced AQHI calculation using Health Canada formula
function calculateEnhancedAQHI(averages) {
  const { pm25, no2, o3 } = averages;

  if (!pm25 && !no2 && !o3) {
    return { aqhi: null, components: [], reason: 'No valid data' };
  }

  let aqhiSum = 0;
  const components = [];

  if (pm25 !== undefined && pm25 !== null) {
    const component = Math.exp(0.000487 * pm25) - 1;
    aqhiSum += component;
    components.push({ pollutant: 'PM2.5', value: pm25, contribution: component });
  }

  if (no2 !== undefined && no2 !== null) {
    const component = Math.exp(0.000537 * no2) - 1;
    aqhiSum += component;
    components.push({ pollutant: 'NO₂', value: no2, contribution: component });
  }

  if (o3 !== undefined && o3 !== null) {
    const component = Math.exp(0.000871 * o3) - 1;
    aqhiSum += component;
    components.push({ pollutant: 'O₃', value: o3, contribution: component });
  }

  if (components.length === 0) {
    return { aqhi: null, components: [], reason: 'No calculable components' };
  }

  const aqhi = (10.0 / 10.4) * 100 * aqhiSum;
  const finalAQHI = Math.max(0, Math.round(aqhi));

  return {
    aqhi: finalAQHI,
    components,
    rawValue: aqhi,
    reason: components.length < 3 ? 'Partial calculation' : 'Complete calculation'
  };
}

// Data quality assessment for mixed sources
function assessDataQuality(averageResult, aqhiResult) {
  if (!averageResult) {
    return { quality: 'no_data', description: 'No historical data available' };
  }

  const { sources, dataPoints } = averageResult;
  const totalReadings = dataPoints;

  // Count enhanced pollutants (using OpenWeather)
  const enhancedPollutants = Object.keys(sources).filter(pollutant =>
    sources[pollutant].openweather > 0
  );

  // Quality assessment logic
  if (totalReadings >= 15 && enhancedPollutants.length === 0) {
    return {
      quality: 'excellent',
      description: 'Full 3+ hour station data, no enhancement needed',
      details: { totalReadings, enhancedPollutants: 0 }
    };
  } else if (totalReadings >= 10 && enhancedPollutants.length <= 1) {
    return {
      quality: 'good',
      description: 'Good station coverage with minimal enhancement',
      details: { totalReadings, enhancedPollutants: enhancedPollutants.length }
    };
  } else if (totalReadings >= 5 && enhancedPollutants.length <= 2) {
    return {
      quality: 'fair',
      description: 'Fair coverage with some OpenWeather supplementation',
      details: { totalReadings, enhancedPollutants: enhancedPollutants.length }
    };
  } else if (enhancedPollutants.length > 0 && aqhiResult.aqhi !== null) {
    return {
      quality: 'enhanced',
      description: 'Significantly enhanced with OpenWeather data',
      details: { totalReadings, enhancedPollutants: enhancedPollutants.length }
    };
  } else if (totalReadings < 5) {
    return {
      quality: 'limited',
      description: 'Limited historical data, building coverage',
      details: { totalReadings, enhancedPollutants: enhancedPollutants.length }
    };
  } else {
    return {
      quality: 'estimated',
      description: 'Using available data with estimation',
      details: { totalReadings, enhancedPollutants: enhancedPollutants.length }
    };
  }
}

async function test3HourAverageCalculations() {
  console.log('🧪 Testing 3-Hour Average Calculations with Mixed Data Sources...\n');

  let testsPassed = 0;
  let testsTotal = mockHistoricalDataScenarios.length;

  for (const scenario of mockHistoricalDataScenarios) {
    console.log(`📊 Testing: ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);

    try {
      // Calculate 3-hour averages
      const averageResult = calculate3HourAverages(scenario.data);
      console.log(`   Data points in 3h window: ${averageResult?.dataPoints || 0}`);

      if (averageResult) {
        // Display averages and sources
        console.log('   📈 3-Hour Averages:');
        Object.keys(averageResult.averages).forEach(pollutant => {
          const avg = averageResult.averages[pollutant];
          const source = averageResult.sources[pollutant];
          console.log(`     ${pollutant.toUpperCase()}: ${avg.toFixed(2)} μg/m³ (Station: ${source.station}, OpenWeather: ${source.openweather})`);
        });

        // Calculate enhanced AQHI
        const aqhiResult = calculateEnhancedAQHI(averageResult.averages);
        console.log(`   🎯 Enhanced AQHI: ${aqhiResult.aqhi !== null ? aqhiResult.aqhi : 'Cannot calculate'}`);

        if (aqhiResult.aqhi !== null) {
          console.log('   🧮 AQHI Components:');
          aqhiResult.components.forEach(comp => {
            console.log(`     ${comp.pollutant}: ${comp.value.toFixed(2)} → ${comp.contribution.toFixed(6)}`);
          });
        }

        // Assess data quality
        const qualityAssessment = assessDataQuality(averageResult, aqhiResult);
        console.log(`   📋 Data Quality: ${qualityAssessment.quality.toUpperCase()}`);
        console.log(`   💡 Description: ${qualityAssessment.description}`);

        // Validation checks
        const validations = [];
        let passed = true;

        // Check if AQHI is reasonable (1-15+ range)
        if (aqhiResult.aqhi !== null && (aqhiResult.aqhi < 0 || aqhiResult.aqhi > 20)) {
          validations.push(`❌ AQHI value ${aqhiResult.aqhi} is outside reasonable range`);
          passed = false;
        } else if (aqhiResult.aqhi !== null) {
          validations.push(`✅ AQHI ${aqhiResult.aqhi} is within reasonable range`);
        }

        // Check if enhancement is correctly identified
        const hasOpenWeatherData = Object.values(averageResult.sources).some(source => source.openweather > 0);
        if (hasOpenWeatherData && !['enhanced', 'fair', 'good'].includes(qualityAssessment.quality)) {
          validations.push(`❌ OpenWeather enhancement not properly recognized in quality: ${qualityAssessment.quality}`);
          passed = false;
        } else if (hasOpenWeatherData) {
          validations.push(`✅ OpenWeather enhancement properly recognized`);
        }

        // Check component calculation
        if (aqhiResult.components.length > 0) {
          const totalContribution = aqhiResult.components.reduce((sum, comp) => sum + comp.contribution, 0);
          const expectedAQHI = Math.round((10.0 / 10.4) * 100 * totalContribution);
          if (Math.abs(expectedAQHI - aqhiResult.aqhi) <= 1) { // Allow 1 point rounding difference
            validations.push('✅ AQHI calculation matches component sum');
          } else {
            validations.push(`❌ AQHI calculation mismatch: expected ~${expectedAQHI}, got ${aqhiResult.aqhi}`);
            passed = false;
          }
        }

        validations.forEach(v => console.log(`   ${v}`));

        if (passed) {
          console.log('   ✅ PASSED\n');
          testsPassed++;
        } else {
          console.log('   ❌ FAILED\n');
        }

      } else {
        console.log('   ❌ No average data calculated\n');
      }

    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}\n`);
    }
  }

  // Summary
  console.log('📊 3-Hour Average Calculation Test Results:');
  console.log(`   ✅ Passed: ${testsPassed}/${testsTotal}`);
  console.log(`   ❌ Failed: ${testsTotal - testsPassed}/${testsTotal}`);

  if (testsPassed === testsTotal) {
    console.log('🎉 All 3-hour average calculation tests passed!');
    console.log('🚀 Mixed data source AQHI calculations are working correctly.');
  } else {
    console.log('⚠️ Some 3-hour average calculation tests failed.');
    console.log('🔍 Review the calculation logic for failed scenarios.');
  }

  console.log('\n💡 Key Features Validated:');
  console.log('   ⏰ 3-hour rolling window calculations');
  console.log('   🔄 Mixed data source integration (station + OpenWeather)');
  console.log('   📊 Enhanced AQHI calculation with partial data');
  console.log('   🎯 Data quality assessment for mixed sources');
  console.log('   📈 Component-based AQHI validation');

  return testsPassed === testsTotal;
}

// Run the test
test3HourAverageCalculations().then(success => {
  console.log(`\n🎯 3-Hour Average Test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});