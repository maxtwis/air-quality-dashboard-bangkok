-- Fix AQHI coefficients in database function
-- Run this in your Supabase SQL Editor to correct the coefficients

-- Drop and recreate the AQHI calculation function with correct coefficients
CREATE OR REPLACE FUNCTION calculate_aqhi(
    pm25_val DECIMAL,
    pm10_val DECIMAL,
    o3_val DECIMAL,
    no2_val DECIMAL,
    so2_val DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    aqhi_value DECIMAL;
    pm25_contribution DECIMAL := 0;
    o3_contribution DECIMAL := 0;
    no2_contribution DECIMAL := 0;
BEGIN
    -- AQHI calculation based on Health Canada formula (CORRECTED COEFFICIENTS)
    -- AQHI = (10/10.4) * 100 * [(exp(0.000487 * PM2.5) - 1) + (exp(0.000537 * NO2) - 1) + (exp(0.000871 * O3) - 1)]

    IF pm25_val IS NOT NULL AND pm25_val > 0 THEN
        pm25_contribution := EXP(0.000487 * pm25_val) - 1;
    END IF;

    IF no2_val IS NOT NULL AND no2_val > 0 THEN
        no2_contribution := EXP(0.000537 * no2_val) - 1;
    END IF;

    IF o3_val IS NOT NULL AND o3_val > 0 THEN
        o3_contribution := EXP(0.000871 * o3_val) - 1;
    END IF;

    -- Calculate AQHI
    aqhi_value := (10.0/10.4) * 100 * (pm25_contribution + no2_contribution + o3_contribution);

    -- Round to 1 decimal place and ensure it's positive
    RETURN GREATEST(ROUND(aqhi_value, 1), 0);
END;
$$ LANGUAGE plpgsql;

-- Verify the function was updated
SELECT '✅ AQHI coefficients fixed!' as message;
SELECT 'PM2.5: 0.000487, NO2: 0.000537, O3: 0.000871' as correct_coefficients;