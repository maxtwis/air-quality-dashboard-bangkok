-- Fix combined_3h_averages view to prefer WAQI over Google supplements
-- Run this in Supabase SQL Editor

-- Drop and recreate the view with correct priority
DROP VIEW IF EXISTS combined_3h_averages;

CREATE VIEW combined_3h_averages AS
SELECT
    w.station_uid,
    -- WAQI averages (typically 9 readings per 3 hours)
    w.avg_pm25,
    w.avg_pm10,
    w.avg_so2,
    w.avg_co,
    -- O3/NO2: Prefer WAQI, use Google only as supplement when WAQI doesn't have it
    COALESCE(w.avg_o3, g.avg_o3) as avg_o3,
    COALESCE(w.avg_no2, g.avg_no2) as avg_no2,
    -- Track which source was used for O3/NO2
    CASE WHEN w.avg_o3 IS NOT NULL THEN 'WAQI' ELSE 'GOOGLE' END as o3_source,
    CASE WHEN w.avg_no2 IS NOT NULL THEN 'WAQI' ELSE 'GOOGLE' END as no2_source,
    -- Reading counts
    w.reading_count as waqi_readings,
    g.reading_count as google_readings,
    -- Timestamps
    w.latest_reading as waqi_latest,
    g.latest_reading as google_latest,
    -- Data quality indicators
    CASE WHEN g.reading_count >= 3 THEN 'EXCELLENT'
         WHEN g.reading_count >= 2 THEN 'GOOD'
         WHEN g.reading_count >= 1 THEN 'FAIR'
         ELSE 'LIMITED' END as data_quality
FROM waqi_3h_averages w
LEFT JOIN google_3h_averages g ON w.station_uid = g.station_uid;
