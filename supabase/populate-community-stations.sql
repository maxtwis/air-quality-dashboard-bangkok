-- ============================================================================
-- Populate Community Stations Mapping
-- ============================================================================
-- This script maps Bangkok communities to their air quality monitoring stations
-- Note: Station UIDs should match your actual station_uid values in the database
-- ============================================================================

-- Clear existing mappings (if any)
TRUNCATE TABLE community_stations;

-- 1. Phra Nakhon (พระนคร)
INSERT INTO community_stations (community_id, station_uid) VALUES
(1, 'bangkok-phra-nakhon-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 2. Thon Buri (ธนบุรี)
INSERT INTO community_stations (community_id, station_uid) VALUES
(2, 'bangkok-thon-buri-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 3. Bangkok Yai (บางกอกใหญ่)
INSERT INTO community_stations (community_id, station_uid) VALUES
(3, 'bangkok-bangkok-yai-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 4. Khlong San (คลองสาน)
INSERT INTO community_stations (community_id, station_uid) VALUES
(4, 'bangkok-khlong-san-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 5. Bangkok Noi (บางกอกน้อย)
INSERT INTO community_stations (community_id, station_uid) VALUES
(5, 'bangkok-ministry-of-natural-resources-and-environment'),
(5, 'bangkok-noi-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 6. Nong Khaem (หนองแขม)
INSERT INTO community_stations (community_id, station_uid) VALUES
(6, 'bangkok-nong-khaem-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 7. Rat Burana (ราษฎร์บูรณะ)
INSERT INTO community_stations (community_id, station_uid) VALUES
(7, 'bangkok-rat-burana-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 8. Din Daeng (ดินแดง)
INSERT INTO community_stations (community_id, station_uid) VALUES
(8, 'bangkok-din-daeng-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 9. Phra Khanong (พระโขนง)
INSERT INTO community_stations (community_id, station_uid) VALUES
(9, 'bangkok-phra-khanong-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 10. Nong Chok (หนองจอก)
INSERT INTO community_stations (community_id, station_uid) VALUES
(10, 'bangkok-nong-chok-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 11. Pathum Wan (ปทุมวัน)
INSERT INTO community_stations (community_id, station_uid) VALUES
(11, 'bangkok-us-embassy'),
(11, 'bangkok-pathumwan-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 12. Pom Prap Sattru Phai (ป้อมปราบศัตรูพ่าย)
INSERT INTO community_stations (community_id, station_uid) VALUES
(12, 'bangkok-pom-prap-sattru-phai-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 13. Samphanthawong (สัมพันธวงศ์)
INSERT INTO community_stations (community_id, station_uid) VALUES
(13, 'bangkok-samphanthawong-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 14. Bang Phlat (บางพลัด)
INSERT INTO community_stations (community_id, station_uid) VALUES
(14, 'bangkok-bang-phlat-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- 15. Chatuchak (จตุจักร)
INSERT INTO community_stations (community_id, station_uid) VALUES
(15, 'bangkok-chatuchak-district')
ON CONFLICT (community_id, station_uid) DO NOTHING;

-- Verify the mappings
SELECT
    c.name,
    c.name_th,
    COUNT(cs.station_uid) as station_count
FROM communities c
LEFT JOIN community_stations cs ON c.id = cs.community_id
GROUP BY c.id, c.name, c.name_th
ORDER BY c.id;

-- ============================================================================
-- IMPORTANT: Update station UIDs
-- ============================================================================
-- Run this query to see your actual station UIDs:
-- SELECT DISTINCT station_uid, name FROM stations ORDER BY name;
--
-- Then update the INSERT statements above with the correct station UIDs
-- ============================================================================
