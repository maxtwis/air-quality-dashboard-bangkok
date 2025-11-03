# Air Quality Dashboard - Bangkok

Real-time air quality monitoring dashboard for Bangkok with interactive maps, multiple data sources, and comprehensive health metrics.

## Features

- **Multiple Data Sources**
  - 🌍 WAQI (World Air Quality Index) - Real monitoring stations
  - 🗺️ Google Air Quality API - Grid-based coverage
  - Toggle between sources in real-time

- **Multiple Health Metrics**
  - US EPA AQI (Air Quality Index)
  - Canadian AQHI (Air Quality Health Index)
  - PM2.5-only AQHI
  - Switch indicators instantly

- **Interactive Map**
  - Color-coded markers for air quality levels
  - Click stations for detailed pollutant data
  - Real-time updates every 10 minutes
  - Leaflet.js-powered mapping

- **Comprehensive Data**
  - 6 pollutants: PM2.5, PM10, NO₂, O₃, SO₂, CO
  - Weather information (temperature, humidity, wind)
  - Historical data with 3-hour moving averages
  - Supabase integration for data persistence

- **Health Recommendations**
  - Personalized advice based on air quality
  - Special guidance for sensitive groups
  - Activity recommendations

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- API keys (see below)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/air-quality-dashboard-bangkok.git
cd air-quality-dashboard-bangkok

# Install dependencies
npm install

# Set up environment variables (see below)
cp .env.example .env.local

# Run development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with the following:

```env
# WAQI API Token (get from https://aqicn.org/data-platform/token/)
WAQI_API_TOKEN=your_waqi_token_here

# Google Air Quality API Key (get from Google Cloud Console)
GOOGLE_AIR_QUALITY_API_KEY=your_google_api_key_here

# Supabase Configuration (optional, for historical data)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### API Keys Setup

#### WAQI API Token

1. Go to https://aqicn.org/data-platform/token/
2. Request a free token
3. Add to `.env.local`

#### Google Air Quality API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing
3. Enable "Air Quality API"
4. Create an API key
5. Add to `.env.local`

See [GOOGLE-AIR-QUALITY-SETUP.md](GOOGLE-AIR-QUALITY-SETUP.md) for detailed Google API setup.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

The project includes serverless functions for API proxying.

## Documentation

- [GOOGLE-AIR-QUALITY-SETUP.md](GOOGLE-AIR-QUALITY-SETUP.md) - Google API integration guide
- [GOOGLE-API-SETUP-SUMMARY.md](GOOGLE-API-SETUP-SUMMARY.md) - Quick setup summary
- [AQHI-Implementation.md](AQHI-Implementation.md) - AQHI calculation details
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Database setup guide
- [CLAUDE.md](CLAUDE.md) - Claude Code integration guide

## Usage

### Switching Data Sources

In the sidebar, use the **Data Source** toggle:

- **WAQI**: Real monitoring stations from World Air Quality Index
- **Google**: Grid-based air quality data from Google API

### Switching Indicators

Use the **Indicator** toggle:

- **AQI**: Standard US EPA Air Quality Index (0-500 scale)
- **AQHI**: Canadian Air Quality Health Index (1-10+ scale)
- **PM2.5 AQHI**: AQHI based solely on PM2.5 levels

### Testing Google API

```bash
# Test Google API integration
node test-google-api.js

# Check the output in test-google-api-response.json
```

## Architecture

```
air-quality-dashboard-bangkok/
├── api/                          # Serverless functions
│   ├── waqi-proxy.js            # WAQI API proxy
│   ├── google-air-quality-proxy.js  # Google API proxy
│   └── collect-data.js          # Data collection cron
├── js/                           # Client-side modules
│   ├── app.js                   # Main application
│   ├── api.js                   # WAQI API client
│   ├── google-api.js            # Google API client
│   ├── aqhi-supabase.js         # AQHI calculations
│   ├── map.js                   # Leaflet map
│   └── ui.js                    # UI management
├── css/                          # Styles
└── index.html                    # Main page
```

## API Costs

### WAQI

- Free tier: Sufficient for most uses
- Rate limits: Check aqicn.org

### Google Air Quality API

- Free tier: 10,000 requests/month
- Current usage (maximally optimized): ~9-45 calls/day (~270-1,350/month)
- Configuration: 3x3 grid, on-demand refresh only (no auto-refresh)
- Recommendation: Use WAQI by default (auto-refresh), switch to Google for comparison

See [GOOGLE-AIR-QUALITY-SETUP.md](GOOGLE-AIR-QUALITY-SETUP.md) for cost optimization.

## Development

```bash
# Run development server
npm run dev

# Format code
npm run format

# Lint code
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT

## Support

For issues or questions:

- Open an issue on GitHub
- Check documentation in the repo
