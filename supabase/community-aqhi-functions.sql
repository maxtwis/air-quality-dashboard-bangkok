-- ============================================================================
-- Community AQHI Aggregation Functions
-- ============================================================================
-- Functions to aggregate AQHI data by Bangkok communities for LINE messaging
-- ============================================================================

-- Create communities table
CREATE TABLE IF NOT EXISTS communities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_th VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create community_stations junction table
CREATE TABLE IF NOT EXISTS community_stations (
    id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    station_uid VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, station_uid)
);

-- Insert Bangkok communities (based on data/community_point.csv)
INSERT INTO communities (id, name, name_th) VALUES
(1, 'Phra Nakhon', 'พระนคร'),
(2, 'Thon Buri', 'ธนบุรี'),
(3, 'Bangkok Yai', 'บางกอกใหญ่'),
(4, 'Khlong San', 'คลองสาน'),
(5, 'Bangkok Noi', 'บางกอกน้อย'),
(6, 'Nong Khaem', 'หนองแขม'),
(7, 'Rat Burana', 'ราษฎร์บูรณะ'),
(8, 'Din Daeng', 'ดินแดง'),
(9, 'Phra Khanong', 'พระโขนง'),
(10, 'Nong Chok', 'หนองจอก'),
(11, 'Pathum Wan', 'ปทุมวัน'),
(12, 'Pom Prap Sattru Phai', 'ป้อมปราบศัตรูพ่าย'),
(13, 'Samphanthawong', 'สัมพันธวงศ์'),
(14, 'Bang Phlat', 'บางพลัด'),
(15, 'Chatuchak', 'จตุจักร')
ON CONFLICT (id) DO NOTHING;

-- Function to get AQHI category from value
CREATE OR REPLACE FUNCTION get_aqhi_category(aqhi_value DECIMAL)
RETURNS TEXT AS $$
BEGIN
    IF aqhi_value IS NULL THEN
        RETURN 'Unknown';
    ELSIF aqhi_value <= 3 THEN
        RETURN 'Low Risk';
    ELSIF aqhi_value <= 6 THEN
        RETURN 'Moderate Risk';
    ELSIF aqhi_value <= 9 THEN
        RETURN 'High Risk';
    ELSE
        RETURN 'Very High Risk';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get Thai AQHI category
CREATE OR REPLACE FUNCTION get_aqhi_category_th(aqhi_value DECIMAL)
RETURNS TEXT AS $$
BEGIN
    IF aqhi_value IS NULL THEN
        RETURN 'ไม่ทราบ';
    ELSIF aqhi_value <= 3 THEN
        RETURN 'เสี่ยงต่ำ';
    ELSIF aqhi_value <= 6 THEN
        RETURN 'เสี่ยงปานกลาง';
    ELSIF aqhi_value <= 9 THEN
        RETURN 'เสี่ยงสูง';
    ELSE
        RETURN 'เสี่ยงสูงมาก';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get health advice based on AQHI
CREATE OR REPLACE FUNCTION get_health_advice_th(aqhi_value DECIMAL)
RETURNS TEXT AS $$
BEGIN
    IF aqhi_value IS NULL THEN
        RETURN 'ไม่มีข้อมูล';
    ELSIF aqhi_value <= 3 THEN
        RETURN 'สามารถทำกิจกรรมกลางแจ้งได้ตามปกติ';
    ELSIF aqhi_value <= 6 THEN
        RETURN 'กลุ่มเสี่ยงควรพิจารณาลดกิจกรรมกลางแจ้งที่หนัก';
    ELSIF aqhi_value <= 9 THEN
        RETURN 'กลุ่มเสี่ยงควรลดกิจกรรมกลางแจ้ง ประชาชนทั่วไปควรพิจารณาลดกิจกรรมที่หนัก';
    ELSE
        RETURN 'กลุ่มเสี่ยงควรหลีกเลี่ยงกิจกรรมกลางแจ้ง ประชาชนทั่วไปควรลดกิจกรรมกลางแจ้ง';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get community AQHI summary
CREATE OR REPLACE FUNCTION get_community_aqhi_summary(target_community_id INTEGER)
RETURNS TABLE (
    community_id INTEGER,
    community_name VARCHAR(100),
    community_name_th VARCHAR(100),
    avg_aqhi DECIMAL(4,1),
    max_aqhi DECIMAL(4,1),
    min_aqhi DECIMAL(4,1),
    station_count INTEGER,
    category TEXT,
    category_th TEXT,
    health_advice_th TEXT,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as community_id,
        c.name as community_name,
        c.name_th as community_name_th,
        ROUND(AVG(lsr.stored_aqhi), 1) as avg_aqhi,
        ROUND(MAX(lsr.stored_aqhi), 1) as max_aqhi,
        ROUND(MIN(lsr.stored_aqhi), 1) as min_aqhi,
        COUNT(lsr.station_uid)::INTEGER as station_count,
        get_aqhi_category(ROUND(AVG(lsr.stored_aqhi), 1)) as category,
        get_aqhi_category_th(ROUND(AVG(lsr.stored_aqhi), 1)) as category_th,
        get_health_advice_th(ROUND(AVG(lsr.stored_aqhi), 1)) as health_advice_th,
        MAX(lsr.timestamp) as last_updated
    FROM communities c
    JOIN community_stations cs ON c.id = cs.community_id
    JOIN latest_station_readings lsr ON cs.station_uid = lsr.station_uid
    WHERE c.id = target_community_id
    AND lsr.stored_aqhi IS NOT NULL
    GROUP BY c.id, c.name, c.name_th;
END;
$$ LANGUAGE plpgsql;

-- Function to get all communities AQHI summary
CREATE OR REPLACE FUNCTION get_all_communities_aqhi()
RETURNS TABLE (
    community_id INTEGER,
    community_name VARCHAR(100),
    community_name_th VARCHAR(100),
    avg_aqhi DECIMAL(4,1),
    max_aqhi DECIMAL(4,1),
    min_aqhi DECIMAL(4,1),
    station_count INTEGER,
    category TEXT,
    category_th TEXT,
    health_advice_th TEXT,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as community_id,
        c.name as community_name,
        c.name_th as community_name_th,
        ROUND(AVG(lsr.stored_aqhi), 1) as avg_aqhi,
        ROUND(MAX(lsr.stored_aqhi), 1) as max_aqhi,
        ROUND(MIN(lsr.stored_aqhi), 1) as min_aqhi,
        COUNT(lsr.station_uid)::INTEGER as station_count,
        get_aqhi_category(ROUND(AVG(lsr.stored_aqhi), 1)) as category,
        get_aqhi_category_th(ROUND(AVG(lsr.stored_aqhi), 1)) as category_th,
        get_health_advice_th(ROUND(AVG(lsr.stored_aqhi), 1)) as health_advice_th,
        MAX(lsr.timestamp) as last_updated
    FROM communities c
    JOIN community_stations cs ON c.id = cs.community_id
    JOIN latest_station_readings lsr ON cs.station_uid = lsr.station_uid
    WHERE lsr.stored_aqhi IS NOT NULL
    GROUP BY c.id, c.name, c.name_th
    ORDER BY avg_aqhi DESC;
END;
$$ LANGUAGE plpgsql;

-- Create view for quick access to community AQHI
CREATE OR REPLACE VIEW community_aqhi_current AS
SELECT * FROM get_all_communities_aqhi();

-- ============================================================================
-- How to use:
-- ============================================================================
-- 1. Get all communities AQHI:
--    SELECT * FROM get_all_communities_aqhi();
--
-- 2. Get specific community AQHI:
--    SELECT * FROM get_community_aqhi_summary(1); -- Bangkok Noi
--
-- 3. Use view for quick access:
--    SELECT * FROM community_aqhi_current WHERE avg_aqhi > 6;
-- ============================================================================
