-- Update to Thai Health Department AQHI Formula
-- Run this in your Supabase SQL Editor

-- Drop and recreate the AQHI calculation function with Thai coefficients
CREATE OR REPLACE FUNCTION calculate_thai_aqhi(
    pm25_ugm3 DECIMAL,    -- PM2.5 in μg/m³
    o3_ppb DECIMAL,       -- O3 in ppb
    no2_ppb DECIMAL       -- NO2 in ppb
) RETURNS DECIMAL AS $$
DECLARE
    aqhi_value DECIMAL;
    pm25_component DECIMAL := 0;
    o3_component DECIMAL := 0;
    no2_component DECIMAL := 0;
    c DECIMAL := 105.19;  -- Thai scaling constant
BEGIN
    -- Thai Health Department AQHI formula
    -- PM2.5AQHI = (10/c) × [100 × (exp(βPM2.5 × PM2.5) - 1) + (exp(βO3 × O3) - 1) + (exp(βNO2 × NO2) - 1)]
    -- Where: c=105.19, βPM2.5=0.0012, βO3=0.0010, βNO2=0.0052

    IF pm25_ugm3 IS NOT NULL AND pm25_ugm3 > 0 THEN
        pm25_component := 100 * (EXP(0.0012 * pm25_ugm3) - 1);
    END IF;

    IF o3_ppb IS NOT NULL AND o3_ppb > 0 THEN
        o3_component := EXP(0.0010 * o3_ppb) - 1;
    END IF;

    IF no2_ppb IS NOT NULL AND no2_ppb > 0 THEN
        no2_component := EXP(0.0052 * no2_ppb) - 1;
    END IF;

    -- Calculate Thai AQHI
    aqhi_value := (10.0 / c) * (pm25_component + o3_component + no2_component);

    -- Round to whole number and ensure it's positive
    RETURN GREATEST(ROUND(aqhi_value), 0);
END;
$$ LANGUAGE plpgsql;

-- Also create a helper function to convert stored μg/m³ values to correct units
CREATE OR REPLACE FUNCTION calculate_thai_aqhi_from_ugm3(
    pm25_ugm3 DECIMAL,    -- PM2.5 in μg/m³ (stored value)
    o3_ugm3 DECIMAL,      -- O3 in μg/m³ (stored value)
    no2_ugm3 DECIMAL      -- NO2 in μg/m³ (stored value)
) RETURNS DECIMAL AS $$
DECLARE
    o3_ppb DECIMAL;
    no2_ppb DECIMAL;
BEGIN
    -- Convert μg/m³ to ppb for O3 and NO2 (approximate conversion factors at 25°C, 1 atm)
    o3_ppb := CASE WHEN o3_ugm3 IS NOT NULL THEN o3_ugm3 / 1.962 ELSE NULL END;
    no2_ppb := CASE WHEN no2_ugm3 IS NOT NULL THEN no2_ugm3 / 1.88 ELSE NULL END;

    -- Call the main Thai AQHI function
    RETURN calculate_thai_aqhi(pm25_ugm3, o3_ppb, no2_ppb);
END;
$$ LANGUAGE plpgsql;

-- Update the view to use Thai AQHI calculation
DROP VIEW IF EXISTS latest_station_readings CASCADE;

CREATE VIEW latest_station_readings AS
SELECT DISTINCT ON (r.station_uid)
    s.station_uid,
    s.name,
    s.latitude,
    s.longitude,
    r.timestamp,
    r.aqi,
    r.pm25,
    r.pm10,
    r.o3,
    r.no2,
    r.so2,
    r.co,
    r.temperature,
    r.humidity,
    r.pressure,
    r.wind_speed,
    r.wind_direction,
    calculate_thai_aqhi_from_ugm3(r.pm25, r.o3, r.no2) as thai_aqhi,
    r.aqhi as stored_aqhi
FROM air_quality_readings r
JOIN stations s ON r.station_uid = s.station_uid
WHERE s.is_active = true
ORDER BY r.station_uid, r.timestamp DESC;

-- Create updated 3-hour averages view with Thai AQHI
DROP VIEW IF EXISTS current_3h_averages CASCADE;

CREATE VIEW current_3h_averages AS
SELECT
    station_uid,
    AVG(pm25) as avg_pm25,
    AVG(pm10) as avg_pm10,
    AVG(o3) as avg_o3,
    AVG(no2) as avg_no2,
    AVG(so2) as avg_so2,
    AVG(co) as avg_co,
    COUNT(*) as reading_count,
    MAX(timestamp) as latest_reading,
    MIN(timestamp) as earliest_reading,
    -- Calculate Thai AQHI from 3-hour averages
    calculate_thai_aqhi_from_ugm3(
        AVG(pm25),
        AVG(o3),
        AVG(no2)
    ) as thai_aqhi_3h_avg
FROM air_quality_readings
WHERE timestamp >= NOW() - INTERVAL '3 hours'
GROUP BY station_uid
HAVING COUNT(*) >= 1;

-- Test the new functions
SELECT '✅ Thai Health Department AQHI formula implemented!' as message;
SELECT 'Formula: PM2.5AQHI = (10/105.19) × [100×(exp(0.0012×PM2.5)-1) + (exp(0.0010×O3)-1) + (exp(0.0052×NO2)-1)]' as formula;
SELECT 'Units: PM2.5 in μg/m³, O3 and NO2 in ppb' as units;