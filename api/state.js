import { getGameStateDB } from './lib/supabase.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Prevent stale CDN/browser caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const sessionId = req.query?.sessionId || null;
    const result = await getGameStateDB(sessionId);

    return res.status(200).json(result);
  } catch (err) {
    console.error('State endpoint error:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
