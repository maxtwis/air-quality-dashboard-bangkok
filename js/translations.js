// Translation strings for Thai and English
export const translations = {
  th: {
    nav: {
      map: 'แผนที่คุณภาพอากาศ',
      about: 'เกี่ยวกับ AQHI',
      health: 'คำแนะนำสุขภาพ',
    },
    sidebar: {
      currentAQI: 'AQI ปัจจุบัน',
      currentAQHI: 'AQHI ปัจจุบัน',
      location: 'สถานที่',
      dominant: 'มลพิษหลัก',
      lastUpdate: 'อัปเดตล่าสุด',
      statistics: 'สถิติ',
      avgAQI: 'AQI เฉลี่ย',
      avgAQHI: 'AQHI เฉลี่ย',
      stations: 'สถานี',
      breakdown: 'แยกตามระดับ',
    },
    aqhiLevels: {
      title: 'ความหมายของระดับ AQHI',
      headerLevel: 'ระดับ AQHI',
      headerGeneral: 'ประชากรทั่วไป',
      headerAtRisk: 'ประชากรกลุ่มเสี่ยง',
      low: 'ต่ำ (Low Risk)',
      moderate: 'ปานกลาง (Moderate Risk)',
      high: 'สูง (High Risk)',
      veryHigh: 'สูงมาก (Very High Risk)',
      lowGeneral: 'ทำกิจกรรมต่าง ๆ ทั้งภายในและภายนอกอาคารได้ปกติ',
      lowAtRisk: 'ทำกิจกรรมต่าง ๆ ทั้งภายในและภายนอกอาคารได้ปกติ',
      moderateGeneral:
        'ทำกิจกรรมต่าง ๆ ทั้งภายในและภายนอกอาคารได้ปกติ ยกเว้นผู้ที่มีอาการระคายเคืองที่ผิวหนังหรือลำคอ',
      moderateAtRisk:
        'ควรลดหรือปรับเปลี่ยนกิจกรรมภายนอกอาคารหากมีอาการไม่พึงประสงค์ต่าง ๆ',
      highGeneral:
        'ควรลดหรือปรับเปลี่ยนกิจกรรมภายนอกอาคาร หากมีอาการไม่พึงประสงค์ต่าง ๆ เช่น ระคายเคืองคอ เป็นต้น',
      highAtRisk:
        'ลดกิจกรรมภายนอกอาคาร หากมีอาการไม่พึงประสงค์ต่าง ๆ เด็กและผู้สูงอายุควรลดกิจกรรมภายนอกอาคาร',
      veryHighGeneral:
        'ลดหรือปรับเปลี่ยนกิจกรรมภายนอกอาคารหากมีอาการไม่พึงประสงค์ต่าง ๆ เช่นไอ ระคายเคืองคอ เป็นต้น',
      veryHighAtRisk:
        'หลีกเลี่ยงกิจกรรมภายนอกอาคารที่ต้องออกแรงเยอะ เด็กและผู้สูงอายุควรงดกิจกรรมภายนอกอาคาร',
    },
    about: {
      title: 'เกี่ยวกับ AQHI',
      what: 'AQHI คืออะไร?',
      whatDesc:
        'Air Quality Health Index (AQHI) เป็นดัชนีคุณภาพอากาศที่พัฒนาโดยประเทศแคนาดา ซึ่งแสดงผลกระทบต่อสุขภาพจากมลพิษทางอากาศ โดยคำนวณจากค่าเฉลี่ยเคลื่อนที่ 3 ชั่วโมงของ PM2.5, NO₂, O₃ และ SO₂',
      why: 'ทำไมต้องใช้ AQHI?',
      whyDesc:
        'AQHI มุ่งเน้นไปที่ผลกระทบต่อสุขภาพมากกว่า AQI แบบดั้งเดิม โดยใช้สูตรทางวิทยาศาสตร์ที่พัฒนาจากการศึกษาทางระบาดวิทยา และให้คำแนะนำที่ชัดเจนสำหรับประชากรทั่วไปและกลุ่มเสี่ยง',
      how: 'AQHI คำนวณอย่างไร?',
      howDesc:
        'AQHI ใช้สูตร: 1000/10.4 × [(e^(0.000871×NO₂) - 1) + (e^(0.000537×O₃) - 1) + (e^(0.000487×PM2.5) - 1) + (e^(0.00126×SO₂) - 1)] โดยค่าที่ได้จะอยู่ในช่วง 1-10+ แบ่งเป็น 4 ระดับความเสี่ยง',
    },
    health: {
      title: 'คำแนะนำสุขภาพ',
      general: 'ประชากรทั่วไป',
      atRisk: 'กลุ่มเสี่ยง',
      atRiskDesc:
        'ผู้ที่มีโรคระบบหายใจ โรคหัวใจและหลอดเลือด ผู้สูงอายุ เด็กเล็ก และสตรีมีครรภ์',
    },
    map: {
      legend: 'ดัชนีคุณภาพอากาศ',
      good: 'ดี',
      moderate: 'ปานกลาง',
      sensitive: 'ไม่ดีต่อกลุ่มเสี่ยง',
      unhealthy: 'ไม่ดีต่อสุขภาพ',
      veryUnhealthy: 'อันตรายต่อสุขภาพ',
      hazardous: 'อันตราย',
    },
  },
  en: {
    nav: {
      map: 'Air Quality Map',
      about: 'About AQHI',
      health: 'Health Advice',
    },
    sidebar: {
      currentAQI: 'Current AQI',
      currentAQHI: 'Current AQHI',
      location: 'Location',
      dominant: 'Dominant Pollutant',
      lastUpdate: 'Last Update',
      statistics: 'Statistics',
      avgAQI: 'Average AQI',
      avgAQHI: 'Average AQHI',
      stations: 'Stations',
      breakdown: 'Breakdown by Level',
    },
    aqhiLevels: {
      title: 'AQHI Level Meanings',
      headerLevel: 'AQHI Level',
      headerGeneral: 'General Population',
      headerAtRisk: 'At-Risk Population',
      low: 'Low Risk',
      moderate: 'Moderate Risk',
      high: 'High Risk',
      veryHigh: 'Very High Risk',
      lowGeneral:
        'Enjoy your usual outdoor activities.',
      lowAtRisk: 'Enjoy your usual outdoor activities.',
      moderateGeneral:
        'Consider reducing or rescheduling strenuous activities outdoors if you experience symptoms.',
      moderateAtRisk:
        'Consider reducing or rescheduling strenuous activities outdoors if you experience symptoms.',
      highGeneral:
        'Consider reducing or rescheduling strenuous activities outdoors if you experience symptoms such as coughing and throat irritation.',
      highAtRisk:
        'Reduce or reschedule strenuous activities outdoors. Children and the elderly should also take it easy.',
      veryHighGeneral:
        'Reduce or reschedule strenuous activities outdoors, especially if you experience symptoms such as coughing and throat irritation.',
      veryHighAtRisk:
        'Avoid strenuous activities outdoors. Children and the elderly should also avoid outdoor physical exertion.',
    },
    about: {
      title: 'About AQHI',
      what: 'What is AQHI?',
      whatDesc:
        'The Air Quality Health Index (AQHI) is developed by Health Canada to communicate the health risks associated with air pollution. It is calculated using a 3-hour moving average of PM2.5, NO₂, O₃, and SO₂ concentrations.',
      why: 'Why use AQHI?',
      whyDesc:
        'AQHI focuses more on health impacts than traditional AQI. It uses a scientifically developed formula based on epidemiological studies and provides clear guidance for both general and at-risk populations.',
      how: 'How is AQHI calculated?',
      howDesc:
        'AQHI uses the formula: 1000/10.4 × [(e^(0.000871×NO₂) - 1) + (e^(0.000537×O₃) - 1) + (e^(0.000487×PM2.5) - 1) + (e^(0.00126×SO₂) - 1)]. The resulting value ranges from 1-10+ divided into 4 risk categories.',
    },
    health: {
      title: 'Health Advice',
      general: 'General Population',
      atRisk: 'At-Risk Groups',
      atRiskDesc:
        'People with respiratory diseases, cardiovascular diseases, elderly, young children, and pregnant women',
    },
    map: {
      legend: 'Air Quality Index',
      good: 'Good',
      moderate: 'Moderate',
      sensitive: 'Unhealthy for Sensitive Groups',
      unhealthy: 'Unhealthy',
      veryUnhealthy: 'Very Unhealthy',
      hazardous: 'Hazardous',
    },
  },
};

// Current language (default: Thai)
let currentLanguage = 'th';

// Get translation by key
export function t(key) {
  const keys = key.split('.');
  let value = translations[currentLanguage];

  for (const k of keys) {
    value = value?.[k];
  }

  return value || key;
}

// Set language
export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updatePageTranslations();
  }
}

// Get current language
export function getLanguage() {
  return currentLanguage;
}

// Initialize language from localStorage
export function initLanguage() {
  const savedLang = localStorage.getItem('language');
  if (savedLang && translations[savedLang]) {
    currentLanguage = savedLang;
  }
}

// Update all translations on the page
function updatePageTranslations() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });

  // Dispatch custom event for dynamic content updates
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: currentLanguage } }));
}
