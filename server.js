#!/usr/bin/env node

// Simple development server with API proxy endpoints
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { collectGoogleAQHI, healthCheck } from "./api-google-aqhi.js";

// Load environment variables
dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files from root directory

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: {
      hasWAQI: !!process.env.WAQI_API_TOKEN,
      hasSupabase: !!process.env.SUPABASE_URL,
    },
  });
});

// Supabase Proxy - hides API keys from client
app.get("/api/supabase/station-history/:stationId", async (req, res) => {
  try {
    const { stationId } = req.params;
    const { hours = 24 } = req.query;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase not configured",
        message:
          "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required",
      });
    }

    const timestamp = new Date(
      Date.now() - hours * 60 * 60 * 1000,
    ).toISOString();
    const apiUrl = `${supabaseUrl}/rest/v1/waqi_data?station_uid=eq.${stationId}&timestamp=gte.${timestamp}&select=timestamp,pm25,pm10,o3,no2,so2,co,aqi&order=timestamp.asc`;

    console.log(
      `🗄️ Proxying Supabase request: station ${stationId}, ${hours}h history`,
    );

    const response = await fetch(apiUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error("❌ Supabase Proxy Error:", error);
    return res.status(500).json({
      error: "Supabase proxy error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// AQHI 3-hour averages proxy (batch query)
app.post("/api/supabase/aqhi-averages", async (req, res) => {
  try {
    const { stationIds } = req.body;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase not configured",
        message:
          "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required",
      });
    }

    // Build the IN clause for station UIDs
    const stationList = stationIds.join(",");
    const apiUrl = `${supabaseUrl}/rest/v1/combined_3h_averages?select=*&station_uid=in.(${stationList})`;

    console.log(`🗄️ Proxying AQHI averages for ${stationIds.length} stations`);

    const response = await fetch(apiUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    console.log(`📦 Supabase returned ${Array.isArray(data) ? 'array' : 'object'} with ${Array.isArray(data) ? data.length : 'N/A'} items`);

    return res.status(200).json(data);
  } catch (error) {
    console.error("❌ AQHI Proxy Error:", error);
    return res.status(500).json({
      error: "AQHI proxy error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// AQHI 3-hour average for single station
app.get("/api/supabase/aqhi-average/:stationId", async (req, res) => {
  try {
    const { stationId } = req.params;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "Supabase not configured",
        message:
          "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required",
      });
    }

    const apiUrl = `${supabaseUrl}/rest/v1/combined_3h_averages?station_uid=eq.${stationId}&select=*`;

    console.log(`🗄️ Proxying AQHI average for station ${stationId}`);

    const response = await fetch(apiUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error("❌ AQHI Proxy Error:", error);
    return res.status(500).json({
      error: "AQHI proxy error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// WAQI API Proxy - hides API keys from client
app.get("/api/waqi-proxy", async (req, res) => {
  try {
    const { endpoint, uid } = req.query;
    const apiToken = process.env.WAQI_API_TOKEN || process.env.AQICN_API_TOKEN;

    if (!apiToken) {
      return res.status(500).json({
        error: "API token not configured",
        message: "WAQI_API_TOKEN environment variable is required",
      });
    }

    let apiUrl;

    if (endpoint === "bounds") {
      // Bangkok bounds endpoint
      apiUrl = `https://api.waqi.info/v2/map/bounds/?latlng=13.5,100.3,14.0,100.9&networks=all&token=${apiToken}`;
    } else if (endpoint === "station" && uid) {
      // Individual station endpoint
      apiUrl = `https://api.waqi.info/feed/@${uid}/?token=${apiToken}`;
    } else {
      return res.status(400).json({
        error: "Invalid endpoint",
        message: "Use endpoint=bounds or endpoint=station&uid=STATION_ID",
      });
    }

    console.log(
      `🌐 Proxying WAQI API request: ${endpoint}${uid ? ` (station ${uid})` : ""}`,
    );

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== "ok") {
      console.error("❌ WAQI API Error:", data);
      return res.status(500).json({
        error: "WAQI API Error",
        details: data,
        timestamp: new Date().toISOString(),
      });
    }

    // Add metadata to response
    const responseData = {
      ...data,
      _proxy: {
        endpoint,
        timestamp: new Date().toISOString(),
        cached: false,
      },
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("❌ WAQI Proxy Error:", error);
    return res.status(500).json({
      error: "Proxy server error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Google AQHI Collection Endpoint (for cron-job.org)
app.get("/api/google-aqhi/collect", collectGoogleAQHI);

// Google AQHI Health Check
app.get("/api/google-aqhi/health", healthCheck);

// Serve the main application
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      "/ - Main dashboard",
      "/health - Server health check",
      "/api/waqi-proxy?endpoint=bounds - Bangkok air quality stations",
      "/api/waqi-proxy?endpoint=station&uid=ID - Individual station",
      "/api/supabase/station-history/:stationId?hours=24 - Station history data",
    ],
  });
});

// Start server
app.listen(PORT, () => {
  console.log(
    `🚀 Air Quality Dashboard Server running on http://localhost:${PORT}`,
  );
  console.log(`📊 Dashboard available at: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API Proxy endpoints:`);
  console.log(
    `   - WAQI: http://localhost:${PORT}/api/waqi-proxy?endpoint=bounds`,
  );

  // Check environment variables
  const envStatus = {
    WAQI_TOKEN: !!process.env.WAQI_API_TOKEN || !!process.env.AQICN_API_TOKEN,
    OPENWEATHER_KEY: !!process.env.OPENWEATHER_API_KEY,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
  };

  console.log(`🔧 Environment status:`, envStatus);

  if (!envStatus.WAQI_TOKEN) {
    console.warn(
      "⚠️  WARNING: WAQI_API_TOKEN not found in environment variables",
    );
  }
  if (!envStatus.OPENWEATHER_KEY) {
    console.warn(
      "⚠️  WARNING: OPENWEATHER_API_KEY not found in environment variables",
    );
  }
});
