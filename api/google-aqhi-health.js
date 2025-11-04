/**
 * Vercel Serverless Function: Google AQHI Health Check
 * Endpoint: /api/google-aqhi-health
 *
 * Returns the health status of the Google AQHI collection service
 */

export default async function handler(req, res) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }

  const GOOGLE_API_KEY = process.env.GOOGLE_AIR_QUALITY_API_KEY;

  res.status(200).json({
    status: 'OK',
    service: 'Google AQHI Collector',
    timestamp: new Date().toISOString(),
    config: {
      hasGoogleApiKey: !!GOOGLE_API_KEY,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      locations: 15
    }
  });
}
