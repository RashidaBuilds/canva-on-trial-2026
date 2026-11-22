import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Load environment variables safely from process.env or .env.local
 */
function getEnvConfig() {
  let url = process.env.SUPABASE_URL;
  let key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const k = trimmed.substring(0, eqIdx).trim();
            const v = trimmed.substring(eqIdx + 1).trim();
            if (k === 'SUPABASE_URL' && !url) url = v;
            if (k === 'SUPABASE_SECRET_KEY' && !key) key = v;
          }
        }
      }
    } catch (_) {}
  }

  return { url, key };
}

let supabaseInstance = null;

export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;

  const { url, key } = getEnvConfig();
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY configuration.');
  }

  supabaseInstance = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });

  return supabaseInstance;
}

/**
 * Register Player:
 * Executes atomic registration in Supabase
 */
export async function registerPlayerDB(name, requestId, clientId = null) {
  const supabase = getSupabaseClient();
  const trimmedName = (name || '').trim();
  const trimmedReqId = (requestId || '').trim();

  if (!trimmedName) {
    return { status: 'error', code: 'INVALID_NAME', message: 'Player nickname cannot be blank' };
  }
  if (!trimmedReqId) {
    return { status: 'error', code: 'MISSING_REQUEST_ID', message: 'Missing registration request identifier' };
  }

  // 1. Try atomic PostgreSQL RPC first
  try {
    const { data, error } = await supabase.rpc('register_player', {
      p_name: trimmedName,
      p_request_id: trimmedReqId,
      p_client_id: clientId
    });

    if (!error && data && data.status) {
      return data;
    }
  } catch (_) {}

  // 2. Direct table fallback
  const serverTime = Date.now();

  // Find active session
  const { data: activeSessions, error: sessionErr } = await supabase
    .from('game_sessions')
    .select('*')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1);

  if (sessionErr) {
    return { status: 'error', message: sessionErr.message };
  }

  let session = activeSessions && activeSessions.length > 0 ? activeSessions[0] : null;

  if (!session) {
    // Player 1 establishes session
    const sessionId = 'sess_' + serverTime;
    const { data: newSession, error: createErr } = await supabase
      .from('game_sessions')
      .insert({
        session_id: sessionId,
        lobby_start_time: serverTime,
        is_active: true
      })
      .select()
      .single();

    if (createErr) {
      return { status: 'error', message: createErr.message };
    }
    session = newSession;
  } else {
    // Check for idempotent retry
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', session.session_id)
      .eq('request_id', trimmedReqId)
      .maybeSingle();

    if (existingPlayer) {
      return {
        status: 'success',
        action: 'join',
        isRetry: true,
        sessionId: session.session_id,
        player: {
          rowIndex: existingPlayer.row_index,
          name: existingPlayer.name,
          requestId: existingPlayer.request_id,
          sessionId: session.session_id,
          timestamp: existingPlayer.registered_at,
          serverTimestamp: serverTime
        },
        rowIndex: existingPlayer.row_index,
        requestId: existingPlayer.request_id,
        lobbyStartTime: Number(session.lobby_start_time),
        serverTime: serverTime
      };
    }

    // Check 90s cutoff
    const elapsed = serverTime - Number(session.lobby_start_time);
    if (elapsed >= 90000) {
      return {
        status: 'error',
        code: 'LOBBY_CLOSED',
        message: 'The investigation has already begun. Watch the main screen.',
        sessionId: session.session_id,
        lobbyStartTime: Number(session.lobby_start_time),
        serverTime: serverTime
      };
    }
  }

  // Calculate next row index
  const { data: maxRowData } = await supabase
    .from('players')
    .select('row_index')
    .eq('session_id', session.session_id)
    .order('row_index', { ascending: false })
    .limit(1);

  const nextRow = maxRowData && maxRowData.length > 0 ? maxRowData[0].row_index + 1 : 2;

  // Insert player
  const { data: newPlayer, error: insertErr } = await supabase
    .from('players')
    .insert({
      session_id: session.session_id,
      name: trimmedName,
      row_index: nextRow,
      request_id: trimmedReqId,
      client_id: clientId,
      has_score: false,
      score: null
    })
    .select()
    .single();

  if (insertErr) {
    return { status: 'error', message: insertErr.message };
  }

  return {
    status: 'success',
    action: 'join',
    sessionId: session.session_id,
    player: {
      rowIndex: newPlayer.row_index,
      name: newPlayer.name,
      requestId: newPlayer.request_id,
      sessionId: session.session_id,
      timestamp: newPlayer.registered_at,
      serverTimestamp: serverTime
    },
    rowIndex: newPlayer.row_index,
    requestId: newPlayer.request_id,
    lobbyStartTime: Number(session.lobby_start_time),
    serverTime: serverTime
  };
}

/**
 * Submit Score:
 * Validates session, request ID, player identity, and updates score (strictly accepting numeric 0).
 */
export async function submitScoreDB(sessionId, requestId, name, score, rowIndex = null) {
  const supabase = getSupabaseClient();
  const cleanReqId = (requestId || '').trim();
  const cleanName = (name || '').trim();

  let numScore = null;
  if (typeof score === 'number' && isFinite(score)) {
    numScore = score;
  } else if (typeof score === 'string' && score.trim() !== '') {
    const p = Number(score.trim());
    if (!isNaN(p) && isFinite(p)) numScore = p;
  }

  if (numScore === null) {
    return { status: 'error', code: 'INVALID_SCORE', message: 'Score must be a valid finite number' };
  }
  if (!cleanReqId) {
    return { status: 'error', code: 'MISSING_REQUEST_ID', message: 'Missing registration requestId' };
  }

  // 1. Try atomic PostgreSQL RPC first
  try {
    const { data, error } = await supabase.rpc('submit_player_score', {
      p_session_id: sessionId,
      p_request_id: cleanReqId,
      p_name: cleanName,
      p_score: numScore,
      p_row_index: rowIndex ? parseInt(rowIndex, 10) : null
    });

    if (!error && data && data.status === 'success') {
      return data;
    }
  } catch (_) {}

  // 2. Direct table update fallback
  const { data: player, error: playerErr } = await supabase
    .from('players')
    .select('*')
    .eq('session_id', sessionId)
    .eq('request_id', cleanReqId)
    .maybeSingle();

  if (playerErr || !player) {
    return { status: 'error', code: 'UNKNOWN_REQUEST_ID', message: 'Registration requestId not found in session.' };
  }

  if (player.name.trim().toLowerCase() !== cleanName.toLowerCase()) {
    return { status: 'error', code: 'REQUEST_MISMATCH', message: 'RequestId does not match player name.' };
  }

  const { error: updateErr } = await supabase
    .from('players')
    .update({
      score: numScore,
      has_score: true,
      submitted_at: new Date().toISOString()
    })
    .eq('id', player.id);

  if (updateErr) {
    return { status: 'error', message: updateErr.message };
  }

  return {
    status: 'success',
    action: 'submitScore',
    rowIndex: player.row_index,
    score: numScore,
    updated: true
  };
}

/**
 * Get Game State & Leaderboard:
 * Returns authoritative session countdown, compilation metrics, and sorted players.
 * Unsubmitted scores return score: null, hasScore: false, isPending: true.
 * Numeric 0 is returned as score: 0, hasScore: true, isPending: false.
 */
export async function getGameStateDB(sessionId = null) {
  const supabase = getSupabaseClient();
  const serverTime = Date.now();

  // 1. Try atomic PostgreSQL RPC first
  try {
    if (!error && data && data.status === 'success') {
      if (Array.isArray(data.players)) {
        data.players = data.players.map((p) => ({
          ...p,
          score: p.hasScore ? (p.score !== null ? Number(p.score) : 0) : null,
          numericScore: p.hasScore ? (p.score !== null ? Number(p.score) : 0) : null,
          isPending: !p.hasScore
        }));
      }
      return data;
    }
  } catch (_) {}

  // 2. Direct table fallback
  let sessionQuery = supabase.from('game_sessions').select('*');
  if (sessionId) {
    sessionQuery = sessionQuery.eq('session_id', sessionId).limit(1);
  } else {
    sessionQuery = sessionQuery.eq('is_active', true).order('id', { ascending: false }).limit(1);
  }

  const { data: sessions } = await sessionQuery;
  const session = sessions && sessions.length > 0 ? sessions[0] : null;

  if (!session) {
    return {
      status: 'success',
      sessionId: null,
      serverTime: serverTime,
      lobbyStartTime: null,
      isLobbyClosed: false,
      totalPlayers: 0,
      scoresSubmitted: 0,
      scoresPending: 0,
      allScoresSubmitted: false,
      players: []
    };
  }

  const isClosed = (serverTime - Number(session.lobby_start_time)) >= 90000;

  const { data: playersList } = await supabase
    .from('players')
    .select('*')
    .eq('session_id', session.session_id);

  const players = playersList || [];
  const totalPlayers = players.length;
  const scoresSubmitted = players.filter((p) => p.has_score).length;
  const scoresPending = totalPlayers - scoresSubmitted;
  const allScoresSubmitted = totalPlayers > 0 && scoresPending === 0;

  // Sort descending by score (pending last); tiebreaker by earlier registration timestamp
  const sortedPlayers = players
    .map((p) => ({
      rowIndex: p.row_index,
      name: p.name,
      score: p.has_score && p.score !== null ? Number(p.score) : null,
      stoppedAt: p.has_score && p.score !== null ? Number(p.score) : null,
      hasScore: !!p.has_score,
      isPending: !p.has_score,
      timestamp: p.registered_at
    }))
    .sort((a, b) => {
      if (a.hasScore !== b.hasScore) return a.hasScore ? -1 : 1;
      const scoreA = a.score !== null ? a.score : -1;
      const scoreB = b.score !== null ? b.score : -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      if (tA !== tB) return tA - tB;
      return (a.rowIndex || 0) - (b.rowIndex || 0);
    });

  return {
    status: 'success',
    sessionId: session.session_id,
    serverTime: serverTime,
    lobbyStartTime: Number(session.lobby_start_time),
    isLobbyClosed: isClosed,
    totalPlayers: totalPlayers,
    scoresSubmitted: scoresSubmitted,
    scoresPending: scoresPending,
    allScoresSubmitted: allScoresSubmitted,
    players: sortedPlayers
  };
}

/**
 * Reset Game Session:
 * Marks all sessions inactive for a clean fresh game.
 */
export async function resetGameSessionDB() {
  const supabase = getSupabaseClient();

  // Try RPC first
  try {
    const { data, error } = await supabase.rpc('reset_game_session');
    if (!error && data) return data;
  } catch (_) {}

  // Direct table fallback
  await supabase
    .from('game_sessions')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('is_active', true);

  return {
    status: 'success',
    message: 'Game session cleanly reset. Ready for new Player 1.'
  };
}
