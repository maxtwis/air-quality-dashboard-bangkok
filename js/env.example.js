// Environment variables loader for client-side
// Copy this file to env.js and update with your actual API keys
// This file loads environment variables into window object for browser access

// Set environment variables on window object
// IMPORTANT: Replace these with your actual API keys
window.WAQI_API_TOKEN = 'your_waqi_api_token_here';
window.OPENWEATHER_API_KEY = 'your_openweather_api_key_here';
window.SUPABASE_URL = 'your_supabase_url_here';
window.SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';

// Debug info
console.log('🔧 Environment variables loaded:', {
  hasWAQI: !!window.WAQI_API_TOKEN && !window.WAQI_API_TOKEN.includes('your_'),
  hasOpenWeather: !!window.OPENWEATHER_API_KEY && !window.OPENWEATHER_API_KEY.includes('your_'),
  hasSupabase: !!window.SUPABASE_URL && !window.SUPABASE_URL.includes('your_')
});