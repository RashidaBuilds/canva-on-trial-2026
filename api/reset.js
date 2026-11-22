import { resetGameSessionDB } from './lib/supabase.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' });
  }

  // 1. Disable public access: Ordinary players cannot reset the game.
  // Require explicit admin authorization (X-Admin-Key or Bearer token matching SUPABASE_SECRET_KEY or ADMIN_SECRET_KEY)
  const adminSecret = process.env.ADMIN_SECRET_KEY || process.env.SUPABASE_SECRET_KEY;
  const authHeader = req.headers['authorization'] || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
  const customKey = req.headers['x-admin-key'];
  const providedKey = customKey || bearerToken;

  if (!adminSecret || !providedKey || providedKey !== adminSecret) {
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message: 'Forbidden: Public access to reset is disabled. Ordinary players cannot reset the game session.'
    });
  }

  try {
    const result = await resetGameSessionDB();
    return res.status(200).json(result);
  } catch (err) {
    console.error('Reset endpoint error:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
