// Debug endpoint to check environment variables
export default async function handler(req, res) {
  const envCheck = {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAqicnToken: !!process.env.AQICN_API_TOKEN,
    hasGoogleKey: !!process.env.GOOGLE_API_KEY,

    // Show first/last characters (for verification without exposing keys)
    supabaseUrl: process.env.SUPABASE_URL
      ? `${process.env.SUPABASE_URL.substring(0, 30)}...`
      : 'NOT SET',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
      ? `${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...${process.env.SUPABASE_ANON_KEY.slice(-10)}`
      : 'NOT SET',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(-10)}`
      : 'NOT SET',
  };

  // Test Supabase connection
  let connectionTest = { connected: false, error: null };

  try {
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    );

    // Try a simple query
    const { data, error } = await supabase
      .from("waqi_data")
      .select("count")
      .limit(1);

    if (error) {
      connectionTest = { connected: false, error: error.message };
    } else {
      connectionTest = { connected: true, error: null };
    }
  } catch (err) {
    connectionTest = { connected: false, error: err.message };
  }

  return res.status(200).json({
    environment: envCheck,
    supabaseConnection: connectionTest,
    timestamp: new Date().toISOString(),
  });
}
