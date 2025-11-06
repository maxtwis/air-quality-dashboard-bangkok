# Bangkok Air Quality Dashboard - Team Presentation

## Executive Summary

The **Bangkok Air Quality Dashboard** is a real-time air quality monitoring system that displays both AQI (Air Quality Index) and AQHI (Air Quality Health Index) data on an interactive map. The dashboard provides comprehensive health guidance and community-level air quality insights for Bangkok residents.

**Live URL**: [Your Dashboard URL]
**Data Sources**: WAQI API, Google Air Quality API, Supabase Database
**Coverage**: 15 community locations across Bangkok
**Update Frequency**: Every 10 minutes (automatic)

---

## Key Features

### 1. Dual Index System

**Air Quality Index (AQI)**
- Standard US EPA air quality measurement
- Real-time current readings
- Based on single dominant pollutant
- Scale: 0-500 (Good to Hazardous)
- Data from WAQI API network

**Air Quality Health Index (AQHI)**
- Health Canada's comprehensive health risk assessment
- Uses 3-hour moving averages for accuracy
- Combines multiple pollutants (PM2.5, NO₂, O₃)
- Scale: 0-10+ (Low to Very High Risk)
- Scientific formula based on health impact studies

**Users can toggle between AQI and AQHI modes** to view different perspectives on air quality.

---

### 2. Interactive Map Interface

**Map Features**:
- **Real-time Markers**: Color-coded circles showing air quality levels at each station
- **Click Interactions**: Detailed station information on marker click
- **Visual Legend**: Clear color coding for different air quality levels
- **Zoom Controls**: Navigate to specific areas of Bangkok
- **Full-screen Mode**: Maximize map for presentations or detailed analysis
- **Auto-refresh**: Updates every 10 minutes automatically

**Color Coding**:
- 🟢 Green: Good (0-50)
- 🟡 Yellow: Moderate (51-100)
- 🟠 Orange: Unhealthy for Sensitive Groups (101-150)
- 🔴 Red: Unhealthy (151-200)
- 🟣 Purple: Very Unhealthy (201-300)
- ⚫ Maroon: Hazardous (301+)

---

### 3. Community Data Integration

**15 Monitored Communities**:
- Geographic boundaries displayed on community map
- Population statistics per community
- AQHI monitoring station locations
- Click on boundary to view detailed community information

**Community Statistics**:
- Total communities: 15
- Total monitoring stations: 15 (one per community)
- Population coverage data
- Interactive community boundaries

**Purpose**: Provides neighborhood-level air quality awareness for local residents.

---

### 4. Detailed Station Information

**When you click on a station marker**, the dashboard displays:

**Primary Metrics**:
- Current AQI or AQHI value (large circle display)
- Air quality category (Good, Moderate, Unhealthy, etc.)
- Last update timestamp
- Station name and location

**Pollutant Breakdown**:
- **PM2.5**: Fine particulate matter (< 2.5 micrometers)
- **PM10**: Coarse particulate matter (< 10 micrometers)
- **NO₂**: Nitrogen dioxide
- **O₃**: Ozone
- **SO₂**: Sulfur dioxide
- **CO**: Carbon monoxide

Each pollutant shows:
- Current concentration (μg/m³ or mg/m³)
- Individual AQI contribution
- Color-coded status indicator

**Weather Conditions**:
- Temperature (°C)
- Humidity (%)
- Atmospheric pressure (hPa)
- Wind speed (m/s)
- Wind direction (degrees)

**Historical Trend Chart**:
- 24-hour historical data visualization
- Line chart showing AQI/AQHI changes over time
- Helps identify pollution patterns and trends

---

### 5. Health Recommendations

**Personalized Health Guidance** based on current air quality levels:

**For General Population**:
- Activity recommendations for current conditions
- When to reduce outdoor activities
- Safe activity guidelines

**For At-Risk Groups**:
- Children and elderly
- People with respiratory conditions (asthma, COPD)
- People with heart conditions
- Pregnant women
- Outdoor workers and athletes

**Guidance Categories**:
- Outdoor activities
- Exercise and sports
- Commuting recommendations
- Indoor air quality tips
- Protective measures (masks, air purifiers)

---

### 6. About AQHI Education Page

**Educational Content**:
- What is AQHI and why it matters
- Difference between AQHI and AQI
- Scientific calculation methodology
- Health impact research references
- Data source transparency

**AQHI Level Meanings**:
- **1-3 (Low Risk)**: Normal activities for everyone
- **4-6 (Moderate Risk)**: At-risk groups should be cautious
- **7-10 (High Risk)**: Reduce outdoor activities
- **10+ (Very High Risk)**: Avoid outdoor exertion

**Scientific Formula Display**:
```
AQHI = (10/10.4) × 100 × [
  (exp(0.000487 × PM2.5_3hr) - 1) +
  (exp(0.000871 × NO2_3hr) - 1) +
  (exp(0.000537 × O3_3hr) - 1)
]
```

**References**: Links to official Thai Ministry of Public Health research documents

---

### 7. Bilingual Support

**Languages**:
- 🇹🇭 Thai (default)
- 🇬🇧 English

**Toggle Button**: Top-right navigation bar allows instant language switching

**Translated Content**:
- All UI elements
- Map legend
- Health recommendations
- Station information
- About pages

---

### 8. Mobile-Responsive Design

**Optimized for All Devices**:
- Desktop (1440px+): Full sidebar + map layout
- Tablet (768px-1440px): Adaptive layout
- Mobile (375px-768px): Stacked layout with hamburger menu

**Mobile Features**:
- Collapsible navigation menu
- Touch-optimized map controls
- Vertical scrolling for content
- Responsive data tables
- Optimized marker sizes for touch

---

## Technical Architecture

### Data Flow

```
┌─────────────────┐
│  WAQI API       │ ──► PM2.5, PM10, AQI data
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Google Air      │ ──► NO₂, O₃ data (15 locations)
│ Quality API     │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │ ──► Store historical data (7 days)
│                 │ ──► Calculate 3-hour moving averages
│                 │ ──► Compute AQHI values
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Dashboard UI   │ ──► Display AQI/AQHI on map
│  (Browser)      │ ──► Show health recommendations
│                 │ ──► Interactive visualizations
└─────────────────┘
```

### Data Collection System

**Automated Collection**:
- **WAQI Data**: Collected every 10 minutes via proxy API
- **Google Data**: Collected every 10 minutes via cron job
- **Supabase Storage**: 7-day rolling window with automatic cleanup
- **3-Hour Averages**: Calculated in real-time by database functions

**Data Persistence**:
- Historical data stored for trend analysis
- Cross-device synchronization
- Automatic data quality validation
- Missing data handling and interpolation

---

## AQHI Implementation Highlights

### Scientific Accuracy

**3-Hour Moving Averages**:
- Collects data points every 10 minutes
- Builds moving average over 3-hour window
- More accurate than instant readings
- Aligns with Health Canada methodology

**Data Quality Indicators**:
- 🎯 **Excellent**: 3+ hours of data, 15+ readings
- ✅ **Good**: 2+ hours of data, 10+ readings
- ⏳ **Fair**: 1+ hours of data, 5+ readings
- 🔄 **Limited**: Building data, < 1 hour
- 📊 **Estimated**: Using current reading estimation

**Calculation Methods**:
1. **Client-Average**: Using collected 3-hour moving averages (most accurate)
2. **Estimated**: Using estimation algorithms with variability factors
3. **Current**: Using immediate readings (initial state)

---

## User Interface Components

### Navigation Bar
- **Brand Logo**: "Breathe Bangkok"
- **Navigation Tabs**: Map, Community, About AQHI, Health Advice
- **Language Switcher**: Thai/English toggle
- **Mobile Menu**: Hamburger icon for responsive menu

### Sidebar (Desktop)
- **Indicator Toggle**: Switch between AQI/AQHI
- **Map Legend**: Color-coded air quality levels
- **Description**: Explanation of current indicator

### Main Map Area
- **Interactive Leaflet Map**: Centered on Bangkok
- **Station Markers**: Color-coded circles at each monitoring location
- **Map Controls**:
  - Refresh button (manual update)
  - Fullscreen toggle
  - Zoom in/out
  - Pan controls

### Station Detail Panel
- **Header**: Station name and close button
- **Main Display**: Large AQI/AQHI circle with value
- **Pollutant Grid**: All pollutants with concentrations
- **Weather Section**: Current weather conditions
- **Health Advice**: Recommendations for current level
- **Historical Chart**: 24-hour trend visualization

### Content Pages
- **Community Map**: Interactive boundary map with statistics
- **About AQHI**: Educational content and formula explanation
- **Health Recommendations**: Detailed guidance for all risk groups

---

## Data Sources

### Primary Data Sources

**1. WAQI (World Air Quality Index)**
- Real-time PM2.5 and PM10 data
- 50+ monitoring stations in Bangkok
- Free tier: 1000 requests/day
- Update frequency: Real-time

**2. Google Air Quality API**
- NO₂ and O₃ measurements
- 15 community grid locations
- Hourly historical data
- Professional-grade accuracy

**3. Supabase Database**
- PostgreSQL database
- Automated data collection via cron jobs
- Built-in AQHI calculation functions
- 7-day data retention policy

### Data Quality Assurance
- Automatic validation of incoming data
- Missing data detection and flagging
- Outlier detection and handling
- Timestamp verification
- Data quality scoring system

---

## Use Cases

### For General Public
- **Daily Planning**: Check air quality before outdoor activities
- **Health Protection**: Know when to wear masks or avoid exercise
- **Commute Planning**: Choose routes and times with better air quality
- **Family Safety**: Protect children and elderly during high pollution days

### For At-Risk Individuals
- **Health Monitoring**: Track air quality for respiratory conditions
- **Activity Planning**: Schedule outdoor activities during safe periods
- **Medication Management**: Adjust medications based on air quality
- **Early Warning**: Receive guidance before conditions worsen

### For Researchers & Policy Makers
- **Trend Analysis**: 24-hour historical data visualization
- **Community Comparison**: Compare air quality across neighborhoods
- **Public Health Data**: AQHI provides health-focused metrics
- **Data Export**: Access to historical data through Supabase

### For Schools & Workplaces
- **Outdoor Activity Decisions**: PE classes, recess, outdoor events
- **Workplace Safety**: Construction sites, outdoor work planning
- **Communication**: Share real-time data with stakeholders
- **Policy Compliance**: Monitor air quality standards

---

## Key Metrics & Performance

### Coverage
- **Geographic Area**: Greater Bangkok metropolitan area
- **Monitoring Stations**: 50+ stations (WAQI) + 15 community locations (Google)
- **Population Served**: 10+ million residents
- **Communities Tracked**: 15 named communities with boundaries

### Update Frequency
- **Data Refresh**: Every 10 minutes (automatic)
- **AQHI Recalculation**: Every 10 minutes (as new data arrives)
- **Historical Data**: Rolling 7-day window
- **Moving Averages**: Continuous 3-hour window

### Accuracy
- **AQI**: Real-time accuracy (single pollutant dominant)
- **AQHI**: 3-hour moving average (scientifically validated)
- **Data Quality**: Monitored and displayed transparently
- **Validation**: Multi-source cross-validation (WAQI + Google)

### Accessibility
- **Mobile-First**: Responsive design for all devices
- **Bilingual**: Thai and English support
- **Color-Coded**: Visual indicators for accessibility
- **Educational**: Built-in learning resources

---

## Future Enhancements

### Planned Features
1. **Push Notifications**: Alert users when air quality changes significantly
2. **Personalized Alerts**: Custom thresholds for individual health needs
3. **Predictive Analytics**: Machine learning for air quality forecasting
4. **Social Sharing**: Share current conditions on social media
5. **API Access**: Public API for third-party integrations
6. **Data Export**: Download historical data in CSV/JSON format

### Technical Improvements
1. **Additional Pollutants**: Add SO₂ monitoring where available
2. **Weather Integration**: More detailed meteorological data
3. **Pollution Source Mapping**: Identify major pollution sources
4. **Air Quality Index Comparison**: Side-by-side AQI vs AQHI comparison
5. **Mobile Apps**: Native iOS and Android applications

---

## How to Use the Dashboard

### Quick Start Guide

**Step 1: Choose Your Index**
- Select **AQHI** for health-focused assessment (recommended)
- Select **AQI** for standard US EPA measurement
- Toggle is located in the left sidebar

**Step 2: View the Map**
- Colored circles represent monitoring stations
- Green = Good, Yellow = Moderate, Red = Unhealthy, etc.
- Click any circle to see detailed information

**Step 3: Explore Station Details**
- Click a station marker on the map
- View current AQI/AQHI value
- See all pollutant concentrations
- Check weather conditions
- View 24-hour trend chart

**Step 4: Get Health Recommendations**
- Navigate to "Health Advice" tab
- Read recommendations for your risk group
- Follow activity guidelines based on current air quality

**Step 5: Learn About AQHI**
- Visit "About AQHI" page
- Understand the science behind the calculations
- Compare AQHI vs AQI methodologies
- Access source documents and research

**Step 6: Explore Communities**
- Go to "Community Data" page
- Click on community boundaries to see details
- View population and station statistics
- Understand neighborhood-level air quality

---

## Technical Specifications

### Frontend
- **Framework**: Vanilla JavaScript (ES6 modules)
- **Mapping**: Leaflet.js
- **Charts**: Chart.js with date-fns adapter
- **Styling**: Custom CSS with CSS variables
- **Icons**: Material Design Icons
- **Fonts**: Google Fonts (Mitr, Noto Sans Thai Looped)

### Backend
- **API Proxy**: Express.js server
- **Database**: Supabase (PostgreSQL)
- **Data Collection**: Cron jobs (node-cron)
- **Authentication**: API key management

### APIs Used
- **WAQI API**: Air quality data
- **Google Air Quality API**: NO₂ and O₃ data
- **Supabase API**: Database and real-time features

### Hosting & Deployment
- **Frontend**: Static hosting (Vercel, Netlify, or similar)
- **Backend**: Node.js server (for API proxy and cron jobs)
- **Database**: Supabase cloud platform
- **CDN**: Cloudflare or similar for static assets

---

## Configuration & Maintenance

### Environment Variables
```
WAQI_API_TOKEN=your_waqi_token
GOOGLE_API_KEY=your_google_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
PORT=3000
```

### Automatic Maintenance
- **Data Cleanup**: Automatic deletion of data older than 7 days
- **Error Handling**: Graceful degradation when APIs are unavailable
- **Health Checks**: Monitor API availability and response times
- **Logging**: Track errors and performance metrics

### Manual Tasks
- **API Key Rotation**: Update keys periodically for security
- **Performance Monitoring**: Check load times and API response times
- **Content Updates**: Update health recommendations as guidelines change
- **Bug Fixes**: Address user-reported issues

---

## Support & Resources

### Documentation Files
- `README.md` - Project overview and setup instructions
- `AQHI-Implementation.md` - AQHI technical implementation details
- `SUPABASE-SETUP.md` - Database setup guide
- `GOOGLE-AIR-QUALITY-SETUP.md` - Google API integration guide
- `COST-OPTIMIZATION.md` - Cost management strategies

### Reference Materials
- [Thai Ministry of Public Health AQHI Study](https://hia.anamai.moph.go.th/...)
- [Health Canada AQHI Documentation](https://www.canada.ca/...)
- [WAQI API Documentation](https://aqicn.org/api/)
- [Google Air Quality API](https://developers.google.com/maps/documentation/air-quality)

### Team Contact
- **Project Lead**: [Your Name]
- **Technical Lead**: [Your Name]
- **Support Email**: [Your Email]
- **GitHub Repository**: [Your Repo URL]

---

## Summary

The Bangkok Air Quality Dashboard is a comprehensive, user-friendly tool that provides:

✅ **Real-time air quality monitoring** with dual AQI/AQHI display
✅ **Scientific accuracy** using 3-hour moving averages
✅ **Health-focused guidance** for all population groups
✅ **Community-level insights** for 15 Bangkok neighborhoods
✅ **Interactive visualization** with maps and charts
✅ **Bilingual support** for Thai and English speakers
✅ **Mobile-responsive design** for access anywhere
✅ **Educational resources** about air quality and health

**Mission**: Empower Bangkok residents with accurate, actionable air quality information to protect their health and make informed decisions about outdoor activities.

---

**Last Updated**: November 2025
**Version**: 2.0
**Platform**: Web Application (Mobile & Desktop)
