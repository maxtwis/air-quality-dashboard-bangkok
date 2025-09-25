# Secure API Setup Guide

## Overview

The dashboard now uses **server-side proxy endpoints** to hide API keys from client-side code, making it safe for public deployment.

## Architecture Change

**Before (Insecure):**
- API keys exposed in client-side JavaScript
- Anyone could view source and steal keys
- Direct API calls from browser

**After (Secure):**
- API keys stored server-side only
- Client calls proxy endpoints
- API keys never exposed to users

## API Endpoints

### WAQI (Air Quality) Proxy
- **Endpoint**: `/api/waqi-proxy`
- **Bangkok Stations**: `GET /api/waqi-proxy?endpoint=bounds`
- **Station Details**: `GET /api/waqi-proxy?endpoint=station&uid=STATION_ID`

### OpenWeather (Weather) Proxy
- **Endpoint**: `/api/openweather-proxy`
- **Pollution Data**: `GET /api/openweather-proxy?lat=13.7563&lon=100.5018`

## Environment Setup

### 1. Server-Side Environment Variables

```bash
# Required for API proxies (server-side only)
WAQI_API_TOKEN=your_waqi_api_token_here
OPENWEATHER_API_KEY=your_openweather_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Public configuration (can be client-side)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Client-Side Configuration

The client-side `js/env.js` file now only contains:
- Supabase public configuration
- No API keys (they're handled server-side)

## Development Workflow

### 1. Local Development
```bash
# Set environment variables in .env.local
WAQI_API_TOKEN=your_token
OPENWEATHER_API_KEY=your_key

# Start development server
npm run dev
```

### 2. Production Deployment
```bash
# Set environment variables in your hosting platform
# Vercel: vercel env add
# Netlify: Site settings > Environment variables
# Railway: Variables tab

# Deploy
npm run build
npm run deploy
```

## Security Benefits

✅ **API Keys Protected**: Never exposed to client-side code
✅ **Rate Limiting**: Can be implemented server-side
✅ **Access Control**: Can add authentication if needed
✅ **Monitoring**: Server-side logging of API usage
✅ **Public Safe**: Dashboard can be deployed publicly

## Files Changed

- `api/waqi-proxy.js` - WAQI API proxy endpoint
- `api/openweather-proxy.js` - OpenWeather API proxy endpoint
- `js/api.js` - Updated to use proxy endpoints
- `js/openweather-api.js` - Updated to use proxy endpoints
- `js/config.js` - Removed client-side API key references
- `js/env.js` - Only public configuration remains

## Testing

Test the proxy endpoints directly:
```bash
curl http://localhost:3000/api/waqi-proxy?endpoint=bounds
curl http://localhost:3000/api/openweather-proxy?lat=13.7563&lon=100.5018
```

Your dashboard is now **secure and ready for public deployment**! 🔒