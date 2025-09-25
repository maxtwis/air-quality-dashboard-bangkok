-- Migration script to fix existing AQI values stored as concentrations
-- WARNING: This converts AQI values to proper concentrations for existing data
-- Only run this if you have existing data that was stored as AQI values

-- CRITICAL: Backup your data before running this migration!
-- CREATE TABLE air_quality_readings_backup AS SELECT * FROM air_quality_readings;

-- First, let's add a column to track if data has been converted
ALTER TABLE air_quality_readings ADD COLUMN IF NOT EXISTS data_converted BOOLEAN DEFAULT FALSE;

-- Create AQI to concentration conversion function in PostgreSQL
CREATE OR REPLACE FUNCTION convert_aqi_to_concentration(
    aqi_value DECIMAL,
    pollutant TEXT
) RETURNS DECIMAL AS $$
DECLARE
    concentration DECIMAL := NULL;
    -- EPA AQI Breakpoints for PM2.5 (Updated 2024)
    breakpoints DECIMAL[][];
    i INTEGER;
    aqi_lo DECIMAL;
    aqi_hi DECIMAL;
    conc_lo DECIMAL;
    conc_hi DECIMAL;
BEGIN
    -- Return NULL for invalid inputs
    IF aqi_value IS NULL OR aqi_value < 0 THEN
        RETURN NULL;
    END IF;

    -- Define breakpoints based on pollutant type
    CASE pollutant
        WHEN 'pm25' THEN
            -- PM2.5 breakpoints [AQI_lo, AQI_hi, Conc_lo, Conc_hi]
            breakpoints := ARRAY[
                ARRAY[0, 50, 0.0, 9.0],
                ARRAY[51, 100, 9.1, 35.4],
                ARRAY[101, 150, 35.5, 55.4],
                ARRAY[151, 200, 55.5, 125.4],
                ARRAY[201, 300, 125.5, 225.4],
                ARRAY[301, 500, 225.5, 325.4]
            ];
        WHEN 'pm10' THEN
            -- PM10 breakpoints
            breakpoints := ARRAY[
                ARRAY[0, 50, 0, 54],
                ARRAY[51, 100, 55, 154],
                ARRAY[101, 150, 155, 254],
                ARRAY[151, 200, 255, 354],
                ARRAY[201, 300, 355, 424],
                ARRAY[301, 500, 425, 604]
            ];
        WHEN 'no2' THEN
            -- NO2 breakpoints (convert ppb to μg/m³: ppb * 1.88)
            breakpoints := ARRAY[
                ARRAY[0, 50, 0, 99.64],     -- 53 ppb * 1.88
                ARRAY[51, 100, 100.52, 188], -- 54-100 ppb * 1.88
                ARRAY[101, 150, 189.88, 676.8], -- 101-360 ppb * 1.88
                ARRAY[151, 200, 678.68, 1220.12], -- 361-649 ppb * 1.88
                ARRAY[201, 300, 1222, 2348.12], -- 650-1249 ppb * 1.88
                ARRAY[301, 500, 2350, 3852.12] -- 1250-2049 ppb * 1.88
            ];
        WHEN 'o3' THEN
            -- O3 8-hour breakpoints (convert ppm to μg/m³: ppm * 1962)
            breakpoints := ARRAY[
                ARRAY[0, 50, 0, 105.95],     -- 0-0.054 ppm * 1962
                ARRAY[51, 100, 107.91, 137.34], -- 0.055-0.070 ppm * 1962
                ARRAY[101, 150, 139.30, 166.77], -- 0.071-0.085 ppm * 1962
                ARRAY[151, 200, 168.73, 206.01], -- 0.086-0.105 ppm * 1962
                ARRAY[201, 300, 208.01, 392.4] -- 0.106-0.200 ppm * 1962
            ];
        WHEN 'so2' THEN
            -- SO2 breakpoints (convert ppb to μg/m³: ppb * 2.62)
            breakpoints := ARRAY[
                ARRAY[0, 50, 0, 91.7],      -- 0-35 ppb * 2.62
                ARRAY[51, 100, 94.32, 196.5], -- 36-75 ppb * 2.62
                ARRAY[101, 150, 199.12, 484.7], -- 76-185 ppb * 2.62
                ARRAY[151, 200, 487.32, 796.48], -- 186-304 ppb * 2.62
                ARRAY[201, 300, 799.1, 1582.48], -- 305-604 ppb * 2.62
                ARRAY[301, 500, 1585.1, 2630.48] -- 605-1004 ppb * 2.62
            ];
        WHEN 'co' THEN
            -- CO breakpoints (convert ppm to mg/m³: ppm * 1.15)
            breakpoints := ARRAY[
                ARRAY[0, 50, 0.0, 5.06],    -- 0-4.4 ppm * 1.15
                ARRAY[51, 100, 5.18, 10.81], -- 4.5-9.4 ppm * 1.15
                ARRAY[101, 150, 10.93, 14.26], -- 9.5-12.4 ppm * 1.15
                ARRAY[151, 200, 14.38, 17.71], -- 12.5-15.4 ppm * 1.15
                ARRAY[201, 300, 17.83, 34.96], -- 15.5-30.4 ppm * 1.15
                ARRAY[301, 500, 35.08, 57.96] -- 30.5-50.4 ppm * 1.15
            ];
        ELSE
            RETURN NULL; -- Unknown pollutant
    END CASE;

    -- Find the correct breakpoint range
    FOR i IN 1..array_length(breakpoints, 1) LOOP
        aqi_lo := breakpoints[i][1];
        aqi_hi := breakpoints[i][2];
        conc_lo := breakpoints[i][3];
        conc_hi := breakpoints[i][4];

        IF aqi_value >= aqi_lo AND aqi_value <= aqi_hi THEN
            -- Linear interpolation: CP = ((IP - ILo) / (IHi - ILo)) * (CHi - CLo) + CLo
            concentration := ((aqi_value - aqi_lo) / (aqi_hi - aqi_lo)) * (conc_hi - conc_lo) + conc_lo;
            EXIT;
        END IF;
    END LOOP;

    RETURN ROUND(concentration, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to migrate existing AQI data to concentrations
-- WARNING: This will permanently modify your data!
CREATE OR REPLACE FUNCTION migrate_aqi_to_concentrations() RETURNS TEXT AS $$
DECLARE
    record_count INTEGER := 0;
    converted_count INTEGER := 0;
    result_message TEXT;
BEGIN
    -- Get count of records that need conversion
    SELECT COUNT(*) INTO record_count
    FROM air_quality_readings
    WHERE data_converted = FALSE OR data_converted IS NULL;

    IF record_count = 0 THEN
        RETURN 'No records need conversion.';
    END IF;

    -- Convert AQI values to concentrations for unconverted records
    UPDATE air_quality_readings SET
        pm25 = CASE
            WHEN pm25 IS NOT NULL AND pm25 <= 500 THEN convert_aqi_to_concentration(pm25, 'pm25')
            ELSE pm25
        END,
        pm10 = CASE
            WHEN pm10 IS NOT NULL AND pm10 <= 500 THEN convert_aqi_to_concentration(pm10, 'pm10')
            ELSE pm10
        END,
        no2 = CASE
            WHEN no2 IS NOT NULL AND no2 <= 500 THEN convert_aqi_to_concentration(no2, 'no2')
            ELSE no2
        END,
        o3 = CASE
            WHEN o3 IS NOT NULL AND o3 <= 500 THEN convert_aqi_to_concentration(o3, 'o3')
            ELSE o3
        END,
        so2 = CASE
            WHEN so2 IS NOT NULL AND so2 <= 500 THEN convert_aqi_to_concentration(so2, 'so2')
            ELSE so2
        END,
        co = CASE
            WHEN co IS NOT NULL AND co <= 500 THEN convert_aqi_to_concentration(co, 'co')
            ELSE co
        END,
        data_converted = TRUE
    WHERE data_converted = FALSE OR data_converted IS NULL;

    GET DIAGNOSTICS converted_count = ROW_COUNT;

    result_message := format('Migration completed: %s records processed, %s records converted',
                           record_count, converted_count);

    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- Instructions for manual execution:
-- 1. Backup your data first!
-- 2. To see what would be converted: SELECT COUNT(*) FROM air_quality_readings WHERE data_converted = FALSE OR data_converted IS NULL;
-- 3. To run the migration: SELECT migrate_aqi_to_concentrations();
-- 4. To verify: SELECT station_uid, timestamp, pm25, pm10, no2, o3 FROM air_quality_readings WHERE data_converted = TRUE LIMIT 5;

-- NOTE: This migration assumes values <= 500 are AQI values needing conversion
-- Values > 500 are assumed to already be concentrations and are left unchanged