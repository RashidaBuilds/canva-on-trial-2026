import { getSupabaseClient } from '../api/lib/supabase.js';

async function check() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('game_sessions').select('*').limit(1);
    if (error) {
      console.log('Table game_sessions query error:', error.message, error.code);
    } else {
      console.log('Table game_sessions exists! Row count:', data.length);
    }
  } catch (err) {
    console.error('Check failed:', err.message);
  }
}

check();
