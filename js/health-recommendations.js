// Health Recommendations Service
// Provides health advice for different population groups based on AQHI levels

class HealthRecommendationsService {
  constructor() {
    this.recommendations = [];
    this.loaded = false;
    this.loadPromise = null;
  }

  async loadRecommendations() {
    if (this.loaded) return this.recommendations;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._fetchAndParseCSV();
    return this.loadPromise;
  }

  async _fetchAndParseCSV() {
    try {
      const response = await fetch("/data/health_recommendation.csv");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const csvText = await response.text();
      this.recommendations = this._parseCSV(csvText);
      this.loaded = true;
      return this.recommendations;
    } catch (error) {
      return [];
    }
  }

  _parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index].trim();
        });
        data.push(row);
      }
    }

    return data;
  }

  _parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  getRecommendationsForAQHI(aqhiValue) {
    if (!this.loaded || !this.recommendations.length) {
      return [];
    }

    const aqhiLevel = this._getAQHILevelString(aqhiValue);

    return this.recommendations.filter(
      (rec) => rec.aqhi_level && rec.aqhi_level.includes(aqhiLevel),
    );
  }

  _getAQHILevelString(aqhiValue) {
    if (aqhiValue <= 3) return "AQHI 1-3 (Low)";
    if (aqhiValue <= 6) return "AQHI 4-6 (Moderate)";
    if (aqhiValue <= 10) return "AQHI 7-10 (High)";
    return "AQHI 10+ (Very high)";
  }

  getGroupedRecommendations(aqhiValue) {
    const recommendations = this.getRecommendationsForAQHI(aqhiValue);
    const grouped = {
      age: [],
      diseases: [],
      job: [],
    };

    recommendations.forEach((rec) => {
      if (grouped[rec.type]) {
        grouped[rec.type].push(rec);
      }
    });

    return grouped;
  }

  // Get icon class for population group
  getGroupIcon(groupType, description) {
    const iconMap = {
      // Age groups
      "กลุ่มเด็กเล็ก (0-5 ปี)": "child_care",
      "กลุ่มเด็กวัยเรียนและวัยรุ่น (6-18 ปี)": "school",
      "กลุ่มผู้ใหญ่ (19-60 ปี)": "person",
      "กลุ่มผู้สูงอายุ (60 ปี ขึ้นไป)": "elderly",

      // Health conditions
      โรคระบบทางเดินหายใจ: "air",
      โรคระบบหัวใจและหลอดเลือด: "favorite",
      หญิงตั้งครรภ์: "pregnant_woman",

      // Occupational
      ผู้ที่ทำงานกลางแจ้งเป็นประจำ: "outdoor_grill",
      ผู้ที่ทำงานในสภาพแวดล้อมที่มีการสัมผัสกับฝุ่นหรือควัน: "construction",
    };

    return iconMap[description] || "person";
  }

  // Get Thai title for group type
  getGroupTitle(groupType) {
    const titleMap = {
      age: "กลุ่มอายุ",
      diseases: "กลุ่มโรค",
      job: "กลุ่มอาชีพ",
    };

    return titleMap[groupType] || groupType;
  }

  // Get Thai description (use original Thai from CSV)
  getShortDescription(description) {
    // Return the Thai description as-is from the CSV
    return description;
  }
}

// Export singleton instance
export const healthRecommendations = new HealthRecommendationsService();

// Initialize on module load
healthRecommendations.loadRecommendations().catch(() => {});
