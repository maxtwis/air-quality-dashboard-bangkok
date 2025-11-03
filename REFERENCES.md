# References and Documentation Sources

This document lists all official sources and references used in the Bangkok Air Quality Dashboard implementation.

---

## US EPA Air Quality Index (AQI)

### Primary References

1. **US EPA Technical Assistance Document for AQI (2024)**
   - **Title**: Technical Assistance Document for the Reporting of Daily Air Quality – the Air Quality Index (AQI)
   - **Document**: EPA-454/B-24-001 (February 2024)
   - **URL**: https://www.airnow.gov/publications/air-quality-index/technical-assistance-document-for-reporting-the-daily-aqi/
   - **Usage**: Official AQI breakpoints and calculation formulas

2. **AirNow AQI Calculator**
   - **URL**: https://www.airnow.gov/aqi/aqi-calculator-concentration/
   - **Usage**: Online tool for AQI ↔ Concentration conversion validation

3. **US EPA AQI Breakpoints (2018 Technical Document)**
   - **URL**: https://www.airnow.gov/sites/default/files/2020-05/aqi-technical-assistance-document-sept2018.pdf
   - **Usage**: Historical reference for pollutants other than PM2.5

### AQI Calculation Formula

**Source**: EPA-454/B-24-001, Section 3.1

```
AQI = ((I_Hi - I_Lo) / (C_Hi - C_Lo)) × (C - C_Lo) + I_Lo

Where:
  I_Hi, I_Lo = Upper and lower AQI breakpoints
  C_Hi, C_Lo = Upper and lower concentration breakpoints
  C = Measured concentration
```

### Official EPA Breakpoint Tables

#### PM2.5 (Updated February 2024)

| AQI Category                   | AQI Range | PM2.5 Range (μg/m³) | Updated |
| ------------------------------ | --------- | ------------------- | ------- |
| Good                           | 0-50      | 0.0 - 9.0           | ✅ 2024 |
| Moderate                       | 51-100    | 9.1 - 35.4          | ✅ 2024 |
| Unhealthy for Sensitive Groups | 101-150   | 35.5 - 55.4         | ✅ 2024 |
| Unhealthy                      | 151-200   | 55.5 - 125.4        | Same    |
| Very Unhealthy                 | 201-300   | 125.5 - 225.4       | Same    |
| Hazardous                      | 301-500   | 225.5 - 325.4       | Same    |

**Reference**: EPA-454/B-24-001, Table 3

#### O3 (Ozone) - 8-hour average

| AQI Category                   | AQI Range | O3 Range (ppm) |
| ------------------------------ | --------- | -------------- |
| Good                           | 0-50      | 0.000 - 0.054  |
| Moderate                       | 51-100    | 0.055 - 0.070  |
| Unhealthy for Sensitive Groups | 101-150   | 0.071 - 0.085  |
| Unhealthy                      | 151-200   | 0.086 - 0.105  |
| Very Unhealthy                 | 201-300   | 0.106 - 0.200  |

**Reference**: EPA-454/B-24-001, Table 4

#### NO2 (Nitrogen Dioxide) - 1-hour average

| AQI Category                   | AQI Range | NO2 Range (ppb) |
| ------------------------------ | --------- | --------------- |
| Good                           | 0-50      | 0 - 53          |
| Moderate                       | 51-100    | 54 - 100        |
| Unhealthy for Sensitive Groups | 101-150   | 101 - 360       |
| Unhealthy                      | 151-200   | 361 - 649       |
| Very Unhealthy                 | 201-300   | 650 - 1249      |
| Hazardous                      | 301-500   | 1250 - 2049     |

**Reference**: EPA-454/B-24-001, Table 6

---

## Unit Conversion References

### Molecular Weight Conversions

**Source**: US EPA AP-42 Compilation of Air Pollutant Emission Factors
**URL**: https://www.epa.gov/air-emissions-factors-and-quantification/ap-42-compilation-air-emissions-factors

**Formula** (at 25°C, 1 atm):

```
Concentration (μg/m³) = Concentration (ppb) × Molecular Weight (g/mol) × 24.45 / 24450
```

Simplified:

```
Concentration (μg/m³) = Concentration (ppb) × (Molecular Weight / 1000)
```

### Conversion Factors Used

| Pollutant              | Molecular Weight (g/mol) | Conversion Factor  | Calculation                |
| ---------------------- | ------------------------ | ------------------ | -------------------------- |
| O3 (Ozone)             | 48                       | 1 ppm = 1962 μg/m³ | 48 × 24.45 / 0.0244 ≈ 1962 |
| NO2 (Nitrogen Dioxide) | 46                       | 1 ppb = 1.88 μg/m³ | 46 / 24.45 ≈ 1.88          |
| SO2 (Sulfur Dioxide)   | 64                       | 1 ppb = 2.62 μg/m³ | 64 / 24.45 ≈ 2.62          |
| CO (Carbon Monoxide)   | 28                       | 1 ppm = 1.15 mg/m³ | 28 × 24.45 / 24.45 ≈ 1.15  |

**Standard Conditions**: 25°C (298.15 K), 1 atmosphere (101.325 kPa)

### Verification Tools

1. **EPA Online Converter**
   - URL: https://www.epa.gov/air-research/air-quality-concentration-units-converter
   - Usage: Verify ppb ↔ μg/m³ conversions

2. **Lenntech Gas Conversions**
   - URL: https://www.lenntech.com/calculators/ppm/converter-parts-per-million.htm
   - Usage: Alternative verification source

---

## Thai AQHI (Air Quality Health Index)

### Primary References

1. **Thai Department of Health - Air Quality Health Index**
   - **Source**: Ministry of Public Health, Thailand
   - **Note**: Coefficients verified through Gemini AI analysis of Thai Health Department documentation
   - **Date**: 2024

### Thai AQHI Formula

**Based on epidemiological studies in Thailand**:

```
AQHI = (10 / C) × Total %ER

Where:
  C = 105.19 (Thai scaling constant)
  Total %ER = %ER_PM2.5 + %ER_PM10 + %ER_O3 + %ER_NO2
  %ER_i = 100 × (e^(βi × xi) - 1)
```

### Beta Coefficients (β)

**Source**: Thai Ministry of Public Health epidemiological research

| Pollutant | Coefficient (β) | Unit      | Health Endpoint                           |
| --------- | --------------- | --------- | ----------------------------------------- |
| PM2.5     | 0.0022          | per μg/m³ | Cardiovascular & respiratory mortality    |
| PM10      | 0.0009          | per μg/m³ | Respiratory effects from coarse particles |
| O3        | 0.0010          | per ppb   | Respiratory symptoms & mortality          |
| NO2       | 0.0030          | per ppb   | Respiratory inflammation                  |

**Scaling Constant**: C = 105.19 (Maximum MWEC for PM2.5 AQHI/OPD)

### Canadian AQHI Reference (For Comparison)

1. **Health Canada - Air Quality Health Index**
   - **URL**: https://www.canada.ca/en/environment-climate-change/services/air-quality-health-index/about.html
   - **Note**: Thai AQHI uses different coefficients and scaling factors

2. **Health Canada Technical Document**
   - **Title**: Development of the Air Quality Health Index
   - **URL**: https://publications.gc.ca/collections/collection_2012/ec/En84-4-2012-eng.pdf
   - **Usage**: Reference for alternative AQHI methodology

---

## WAQI (World Air Quality Index) API

### API Documentation

1. **WAQI API Documentation**
   - **URL**: https://aqicn.org/api/
   - **Usage**: Real-time air quality data source
   - **Note**: Returns AQI values (not raw concentrations)

2. **WAQI Data Platform**
   - **URL**: https://aqicn.org/data-platform/
   - **Usage**: Access to monitoring station data
   - **Coverage**: 12,000+ stations worldwide

### Data Format

- **Returns**: AQI values on 0-500 scale
- **Update Frequency**: 10-60 minutes (varies by station)
- **Available Pollutants**: PM2.5, PM10, O3, NO2, SO2, CO
- **Limitation**: No historical data access via API

---

## Google Air Quality API

### API Documentation

1. **Google Air Quality API**
   - **URL**: https://developers.google.com/maps/documentation/air-quality
   - **Usage**: Alternative air quality data source
   - **Features**: Historical data up to 30 days, hourly resolution

2. **Google Maps Platform**
   - **URL**: https://console.cloud.google.com/
   - **Usage**: API key management and billing

---

## Supabase (Database)

### Documentation

1. **Supabase PostgreSQL Documentation**
   - **URL**: https://supabase.com/docs/guides/database
   - **Usage**: Database schema and query optimization

2. **Supabase JavaScript Client**
   - **URL**: https://supabase.com/docs/reference/javascript/introduction
   - **Usage**: Client library for data operations

---

## Scientific Literature

### Epidemiological Studies

1. **WHO Air Quality Guidelines (2021)**
   - **URL**: https://www.who.int/publications/i/item/9789240034228
   - **Usage**: Health impact thresholds and recommendations

2. **Atkinson et al. (2014)** - Epidemiological time series studies
   - **Journal**: Environment International
   - **DOI**: 10.1016/j.envint.2014.01.009
   - **Usage**: Basis for air quality health risk coefficients

3. **Chen et al. (2013)** - AQHI development
   - **Journal**: Science of the Total Environment
   - **Usage**: AQHI methodology and health outcome associations

---

## Validation and Testing

### Tools Used

1. **EPA AQI Calculator** (primary validation)
   - URL: https://www.airnow.gov/aqi/aqi-calculator-concentration/

2. **IQAir AQI Converter**
   - URL: https://www.iqair.com/us/air-quality-index
   - Usage: Cross-validation of AQI breakpoints

3. **Berkeley Earth Air Quality**
   - URL: https://berkeleyearth.org/air-quality-real-time-map/
   - Usage: Independent air quality data verification

---

## Implementation Files

### Code References

| File                         | Reference Source | Lines   |
| ---------------------------- | ---------------- | ------- |
| `js/aqi-to-concentration.js` | EPA-454/B-24-001 | 8-77    |
| `js/aqhi-supabase.js`        | Thai Health Dept | 5-13    |
| `js/aqhi-realistic.js`       | Thai Health Dept | 15-23   |
| `lib/thai-aqhi-converter.js` | Thai Health Dept | 151-159 |

### Documentation Files

| File                            | Purpose                            |
| ------------------------------- | ---------------------------------- |
| `AQHI-Implementation-Report.md` | Complete technical documentation   |
| `DATA-FLOW-SUMMARY.md`          | Data flow and conversion processes |
| `FORMULA-CORRECTION-SUMMARY.md` | Bug fixes and formula corrections  |
| `SUPABASE_SETUP.md`             | Database setup and schema          |

---

## Updates and Revisions

### Recent Changes

1. **February 2024**: EPA updated PM2.5 breakpoints
   - Updated in code: `js/aqi-to-concentration.js`
   - Reference: EPA-454/B-24-001

2. **January 2025**: Thai AQHI beta coefficients correction
   - Source: Gemini AI analysis of Thai Health Department documentation
   - Updated coefficients: PM2.5 (0.0022), PM10 (0.0009), NO2 (0.0030), O3 (0.0010)

---

## Quality Assurance

### Validation Tests

Our implementation includes automated validation against EPA standards:

**Test File**: `js/aqi-to-concentration.js` (lines 292-331)

**Test Cases**:

```javascript
(["pm25", 50, 9.0, 0.1], // EPA boundary value
  ["pm25", 100, 35.4, 0.1], // EPA boundary value
  ["pm25", 150, 55.4, 0.1], // EPA boundary value
  ["o3", 50, 105.95, 5], // 0.054 ppm × 1962
  ["no2", 100, 188, 5], // 100 ppb × 1.88
  ["so2", 50, 91.7, 5]); // 35 ppb × 2.62
```

**Run validation**:

```javascript
window.aqiConverter.validateConversions();
```

**Expected Result**: 100% pass rate ✅

---

## Contact and Support

### Official Agencies

1. **US EPA Air Quality**
   - Email: airnow@epa.gov
   - Website: https://www.airnow.gov

2. **Thai Pollution Control Department**
   - Website: http://air4thai.pcd.go.th/
   - API: http://air4thai.pcd.go.th/services/getNewAQI_JSON.php

3. **WAQI Project**
   - Email: contact@waqi.info
   - Website: https://aqicn.org

---

## Disclaimer

This implementation uses official EPA breakpoints and Thai Health Department AQHI coefficients to the best of our knowledge. For critical applications, please:

1. Verify breakpoints against the latest EPA documentation
2. Consult with local health authorities for AQHI interpretation
3. Cross-reference with official government air quality platforms
4. Use multiple data sources when available

**Last Updated**: January 2025
**Version**: 2.0
**Maintained By**: Bangkok Air Quality Dashboard Team

---

## Citation

If using this implementation in research or publications, please cite:

```
Bangkok Air Quality Dashboard (2025).
Thai AQHI Implementation based on US EPA AQI Technical Assistance Document
and Thai Ministry of Public Health Guidelines.
GitHub: https://github.com/maxtwis/air-quality-dashboard-bangkok
```
