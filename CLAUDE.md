# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a real-time air quality dashboard for Bangkok that displays AQI (Air Quality Index) data on an interactive map using the WAQI API and Leaflet.js.

## Development Commands

### Run Development Server
```bash
npm run dev
```
Starts a live development server on port 3000 with hot reload.

### Format Code
```bash
npm run format
```
Runs Prettier to format all files in the project.

### Lint JavaScript
```bash
npm run lint
```
Runs ESLint on all JavaScript files in the `js/` directory.

## Architecture

### Frontend-Only Application
This is a client-side application with no backend server. It consists of:
- HTML/CSS/JavaScript modules
- Direct API calls to WAQI (World Air Quality Index) API from the browser
- Leaflet.js for interactive mapping

### Key Modules

**Configuration** (`js/config.js`):
- Contains API token for WAQI API
- Map boundaries for Bangkok area
- AQI level thresholds and color schemes
- Pollutant definitions and metadata

**Main Application** (`js/app.js`):
- `ModernAirQualityDashboard` class manages the entire application lifecycle
- Handles data fetching, display updates, and auto-refresh
- Provides analytics methods for station categorization

**API Layer** (`js/api.js`):
- Fetches air quality data from WAQI API
- Handles station details and current location data

**Map Management** (`js/map.js`, `js/markers.js`):
- Initializes Leaflet map centered on Bangkok
- Creates and manages station markers with AQI color coding
- Handles marker interactions and popups

**UI Components** (`js/ui.js`):
- Updates sidebar displays with current AQI values
- Manages loading states and error displays
- Handles station info panel

**Statistics** (`js/statistics.js`):
- Calculates and displays AQI statistics
- Shows category breakdowns and averages

### Data Flow
1. App initializes and fetches Bangkok area stations from WAQI API
2. Stations are displayed as color-coded markers on the map
3. Sidebar shows main location data and statistics
4. Auto-refresh updates data every 10 minutes
5. User can interact with markers to see station details

### API Integration
The app uses WAQI API v2 endpoints:
- `/v2/map/bounds/` - Fetch stations within Bangkok boundaries
- `/feed/@{uid}/` - Get detailed station data including pollutants
- Token-based authentication required for all API calls