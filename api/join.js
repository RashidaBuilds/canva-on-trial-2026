import { registerPlayerDB } from './lib/supabase.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }

    const { name, requestId, clientId } = body || {};
    const result = await registerPlayerDB(name, requestId, clientId);

    if (result.status === 'error') {
      const statusCode = result.code === 'LOBBY_CLOSED' ? 403 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Join endpoint error:', err.message);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
