#!/usr/bin/env node

// Simple development server with API proxy endpoints
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files from root directory

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: {
      hasWAQI: !!process.env.WAQI_API_TOKEN,
      hasSupabase: !!process.env.SUPABASE_URL
    }
  });
});

// WAQI API Proxy - hides API keys from client
app.get('/api/waqi-proxy', async (req, res) => {
  try {
    const { endpoint, uid } = req.query;
    const apiToken = process.env.WAQI_API_TOKEN || process.env.AQICN_API_TOKEN;

    if (!apiToken) {
      return res.status(500).json({
        error: 'API token not configured',
        message: 'WAQI_API_TOKEN environment variable is required'
      });
    }

    let apiUrl;

    if (endpoint === 'bounds') {
      // Bangkok bounds endpoint
      apiUrl = `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&networks=all&token=${apiToken}`;
    } else if (endpoint === 'station' && uid) {
      // Individual station endpoint
      apiUrl = `https://api.waqi.info/feed/@${uid}/?token=${apiToken}`;
    } else {
      return res.status(400).json({
        error: 'Invalid endpoint',
        message: 'Use endpoint=bounds or endpoint=station&uid=STATION_ID'
      });
    }

    console.log(`🌐 Proxying WAQI API request: ${endpoint}${uid ? ` (station ${uid})` : ''}`);

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== 'ok') {
      console.error('❌ WAQI API Error:', data);
      return res.status(500).json({
        error: 'WAQI API Error',
        details: data,
        timestamp: new Date().toISOString()
      });
    }

    // Add metadata to response
    const responseData = {
      ...data,
      _proxy: {
        endpoint,
        timestamp: new Date().toISOString(),
        cached: false
      }
    };

    return res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ WAQI Proxy Error:', error);
    return res.status(500).json({
      error: 'Proxy server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/ - Main dashboard',
      '/health - Server health check',
      '/api/waqi-proxy?endpoint=bounds - Bangkok air quality stations',
      '/api/waqi-proxy?endpoint=station&uid=ID - Individual station'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Air Quality Dashboard Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API Proxy endpoints:`);
  console.log(`   - WAQI: http://localhost:${PORT}/api/waqi-proxy?endpoint=bounds`);

  // Check environment variables
  const envStatus = {
    WAQI_TOKEN: !!process.env.WAQI_API_TOKEN || !!process.env.AQICN_API_TOKEN,
    OPENWEATHER_KEY: !!process.env.OPENWEATHER_API_KEY,
    SUPABASE_URL: !!process.env.SUPABASE_URL
  };

  console.log(`🔧 Environment status:`, envStatus);

  if (!envStatus.WAQI_TOKEN) {
    console.warn('⚠️  WARNING: WAQI_API_TOKEN not found in environment variables');
  }
  if (!envStatus.OPENWEATHER_KEY) {
    console.warn('⚠️  WARNING: OPENWEATHER_API_KEY not found in environment variables');
  }
});