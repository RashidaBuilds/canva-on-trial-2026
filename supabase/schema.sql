-- ============================================================================
-- CANVA ON TRIAL 2026: SUPABASE DATABASE SCHEMA & RPC FUNCTIONS
-- ============================================================================
-- Run this complete script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ============================================================================

-- 1. DROP EXISTING FUNCTIONS (CLEAN RE-RUNNABLE SETUP)
DROP FUNCTION IF EXISTS register_player(text, text, text);
DROP FUNCTION IF EXISTS submit_player_score(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS get_game_state(text);
DROP FUNCTION IF EXISTS reset_game_session();

-- 2. CREATE TABLES
CREATE TABLE IF NOT EXISTS game_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    lobby_start_time BIGINT NOT NULL, -- Unix epoch in milliseconds
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    score INTEGER DEFAULT NULL, -- NULL = Pending; 0 or greater = Confirmed
    has_score BOOLEAN NOT NULL DEFAULT FALSE,
    row_index INTEGER NOT NULL, -- Spreadsheet-compatible row index (2, 3, 4...)
    request_id TEXT NOT NULL,
    client_id TEXT,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_session_player_request UNIQUE (session_id, request_id)
);

-- 3. INDEXES FOR PERFORMANCE & CONCURRENCY
CREATE INDEX IF NOT EXISTS idx_game_sessions_active ON game_sessions (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players (session_id);
CREATE INDEX IF NOT EXISTS idx_players_session_score ON players (session_id, score DESC NULLS LAST, registered_at ASC);
CREATE INDEX IF NOT EXISTS idx_players_request_id ON players (request_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Allow public read-only access for anon and authenticated
DROP POLICY IF EXISTS "Public read game_sessions" ON game_sessions;
CREATE POLICY "Public read game_sessions" ON game_sessions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read players" ON players;
CREATE POLICY "Public read players" ON players FOR SELECT TO anon, authenticated USING (true);

-- Allow service_role full write access (server backend)
DROP POLICY IF EXISTS "Service role full access game_sessions" ON game_sessions;
CREATE POLICY "Service role full access game_sessions" ON game_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access players" ON players;
CREATE POLICY "Service role full access players" ON players FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 5. FUNCTION: register_player
-- Handles Player 1 establishing lobby clock, late join rejection (>90s), duplicate nicknames, and retry idempotency
CREATE OR REPLACE FUNCTION register_player(
    p_name TEXT,
    p_request_id TEXT,
    p_client_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_name TEXT;
    v_clean_request_id TEXT;
    v_server_time BIGINT;
    v_session RECORD;
    v_session_id TEXT;
    v_lobby_start_time BIGINT;
    v_existing_player RECORD;
    v_next_row INTEGER;
    v_new_player RECORD;
BEGIN
    v_clean_name := TRIM(COALESCE(p_name, ''));
    v_clean_request_id := TRIM(COALESCE(p_request_id, ''));
    v_server_time := CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT);

    IF v_clean_name = '' THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'INVALID_NAME',
            'message', 'Player nickname cannot be blank'
        );
    END IF;

    IF v_clean_request_id = '' THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'MISSING_REQUEST_ID',
            'message', 'Missing required registration request identifier'
        );
    END IF;

    -- Lock or select active session
    SELECT * INTO v_session
    FROM game_sessions
    WHERE is_active = TRUE
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE;

    -- If no active session, Player 1 establishes a new session and the shared clock anchor
    IF NOT FOUND THEN
        v_session_id := 'sess_' || v_server_time;
        v_lobby_start_time := v_server_time;

        INSERT INTO game_sessions (session_id, lobby_start_time, is_active)
        VALUES (v_session_id, v_lobby_start_time, TRUE)
        RETURNING * INTO v_session;
    ELSE
        v_session_id := v_session.session_id;
        v_lobby_start_time := v_session.lobby_start_time;

        -- Idempotency check: if this exact request_id was already processed in this session, return original record
        SELECT * INTO v_existing_player
        FROM players
        WHERE session_id = v_session_id AND request_id = v_clean_request_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'status', 'success',
                'action', 'join',
                'isRetry', true,
                'sessionId', v_session_id,
                'player', jsonb_build_object(
                    'rowIndex', v_existing_player.row_index,
                    'name', v_existing_player.name,
                    'requestId', v_existing_player.request_id,
                    'sessionId', v_session_id,
                    'timestamp', v_existing_player.registered_at,
                    'serverTimestamp', v_server_time
                ),
                'rowIndex', v_existing_player.row_index,
                'requestId', v_existing_player.request_id,
                'lobbyStartTime', v_lobby_start_time,
                'serverTime', v_server_time
            );
        END IF;

        -- Check 90s lobby cutoff
        IF (v_server_time - v_lobby_start_time) >= 90000 THEN
            RETURN jsonb_build_object(
                'status', 'error',
                'code', 'LOBBY_CLOSED',
                'message', 'The investigation has already begun. Watch the main screen.',
                'sessionId', v_session_id,
                'lobbyStartTime', v_lobby_start_time,
                'serverTime', v_server_time
            );
        END IF;
    END IF;

    -- Calculate next row_index (starting at 2 for Row 2 data convention)
    SELECT COALESCE(MAX(row_index), 1) + 1 INTO v_next_row
    FROM players
    WHERE session_id = v_session_id;

    -- Insert new player record
    INSERT INTO players (
        session_id,
        name,
        score,
        has_score,
        row_index,
        request_id,
        client_id,
        registered_at
    )
    VALUES (
        v_session_id,
        v_clean_name,
        NULL,
        FALSE,
        v_next_row,
        v_clean_request_id,
        p_client_id,
        NOW()
    )
    RETURNING * INTO v_new_player;

    RETURN jsonb_build_object(
        'status', 'success',
        'action', 'join',
        'sessionId', v_session_id,
        'player', jsonb_build_object(
            'rowIndex', v_new_player.row_index,
            'name', v_new_player.name,
            'requestId', v_new_player.request_id,
            'sessionId', v_session_id,
            'timestamp', v_new_player.registered_at,
            'serverTimestamp', v_server_time
        ),
        'rowIndex', v_new_player.row_index,
        'requestId', v_new_player.request_id,
        'lobbyStartTime', v_lobby_start_time,
        'serverTime', v_server_time
    );
END;
$$;


-- 6. FUNCTION: submit_player_score
-- Verifies sessionId, requestId, rowIndex, name, and updates score (including 0 as valid)
CREATE OR REPLACE FUNCTION submit_player_score(
    p_session_id TEXT,
    p_request_id TEXT,
    p_name TEXT,
    p_score INTEGER,
    p_row_index INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_req_id TEXT;
    v_clean_name TEXT;
    v_active_session RECORD;
    v_player RECORD;
BEGIN
    v_clean_req_id := TRIM(COALESCE(p_request_id, ''));
    v_clean_name := TRIM(COALESCE(p_name, ''));

    IF p_score IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'INVALID_SCORE',
            'message', 'Score must be a valid finite number. Missing or invalid score rejected.'
        );
    END IF;

    IF v_clean_req_id = '' THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'MISSING_REQUEST_ID',
            'message', 'Missing original registration requestId. Score submission rejected.'
        );
    END IF;

    -- Verify active session
    SELECT * INTO v_active_session
    FROM game_sessions
    WHERE is_active = TRUE
    ORDER BY id DESC
    LIMIT 1;

    IF NOT FOUND OR v_active_session.session_id <> p_session_id THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'SESSION_MISMATCH',
            'message', 'Session expired or invalid. Score submission rejected.'
        );
    END IF;

    -- Locate player record by session_id and request_id
    SELECT * INTO v_player
    FROM players
    WHERE session_id = p_session_id AND request_id = v_clean_req_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'UNKNOWN_REQUEST_ID',
            'message', 'Registration requestId not found in active session. Score submission rejected.'
        );
    END IF;

    -- Verify name match
    IF LOWER(TRIM(v_player.name)) <> LOWER(v_clean_name) THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'REQUEST_MISMATCH',
            'message', 'Registration requestId does not match submitted player name. Score submission rejected.'
        );
    END IF;

    -- Verify row_index match if provided
    IF p_row_index IS NOT NULL AND v_player.row_index <> p_row_index THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'REQUEST_MISMATCH',
            'message', 'Registration requestId does not match submitted rowIndex. Score submission rejected.'
        );
    END IF;

    -- Update player record with verified score (0 is valid!)
    UPDATE players
    SET
        score = p_score,
        has_score = TRUE,
        submitted_at = NOW()
    WHERE id = v_player.id;

    RETURN jsonb_build_object(
        'status', 'success',
        'action', 'submitScore',
        'rowIndex', v_player.row_index,
        'score', p_score,
        'updated', true
    );
END;
$$;


-- 7. FUNCTION: get_game_state
-- Returns session countdown metadata, compilation progress metrics, and leaderboard rows
CREATE OR REPLACE FUNCTION get_game_state(
    p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_server_time BIGINT;
    v_session RECORD;
    v_total_players INTEGER := 0;
    v_scores_submitted INTEGER := 0;
    v_scores_pending INTEGER := 0;
    v_all_scores_submitted BOOLEAN := FALSE;
    v_is_closed BOOLEAN := FALSE;
    v_players_list JSONB := '[]'::jsonb;
BEGIN
    v_server_time := CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT);

    -- Find target session (either by ID or active session)
    IF p_session_id IS NOT NULL AND TRIM(p_session_id) <> '' THEN
        SELECT * INTO v_session
        FROM game_sessions
        WHERE session_id = p_session_id
        LIMIT 1;
    ELSE
        SELECT * INTO v_session
        FROM game_sessions
        WHERE is_active = TRUE
        ORDER BY id DESC
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'success',
            'sessionId', NULL,
            'serverTime', v_server_time,
            'lobbyStartTime', NULL,
            'isLobbyClosed', FALSE,
            'totalPlayers', 0,
            'scoresSubmitted', 0,
            'scoresPending', 0,
            'allScoresSubmitted', FALSE,
            'players', '[]'::jsonb
        );
    END IF;

    v_is_closed := (v_server_time - v_session.lobby_start_time >= 90000);

    -- Compute counts
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE has_score = TRUE),
        COUNT(*) FILTER (WHERE has_score = FALSE)
    INTO v_total_players, v_scores_submitted, v_scores_pending
    FROM players
    WHERE session_id = v_session.session_id;

    v_all_scores_submitted := (v_total_players > 0 AND v_scores_pending = 0);

    -- Retrieve sorted players list: score DESC (pending last), then registered_at ASC, then row_index ASC
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'rowIndex', p.row_index,
                'name', p.name,
                'score', CASE WHEN p.has_score THEN p.score ELSE NULL END,
                'stoppedAt', CASE WHEN p.has_score THEN p.score ELSE NULL END,
                'hasScore', p.has_score,
                'isPending', NOT p.has_score,
                'timestamp', p.registered_at
            )
            ORDER BY
                p.has_score DESC,
                p.score DESC NULLS LAST,
                p.registered_at ASC,
                p.row_index ASC
        ),
        '[]'::jsonb
    )
    INTO v_players_list
    FROM players p
    WHERE p.session_id = v_session.session_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'sessionId', v_session.session_id,
        'serverTime', v_server_time,
        'lobbyStartTime', v_session.lobby_start_time,
        'isLobbyClosed', v_is_closed,
        'totalPlayers', v_total_players,
        'scoresSubmitted', v_scores_submitted,
        'scoresPending', v_scores_pending,
        'allScoresSubmitted', v_all_scores_submitted,
        'players', v_players_list
    );
END;
$$;


-- 8. FUNCTION: reset_game_session
-- Deactivates all existing sessions so a clean new investigation can start with Player 1
CREATE OR REPLACE FUNCTION reset_game_session()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE game_sessions
    SET is_active = FALSE, updated_at = NOW()
    WHERE is_active = TRUE;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Game session cleanly reset. Ready for new Player 1.'
    );
END;
$$;

-- 9. PERMISSIONS FOR REST API ACCESS
-- Allow execution of player game functions
GRANT EXECUTE ON FUNCTION register_player(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_player_score(text, text, text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_game_state(text) TO anon, authenticated, service_role;

-- Revoke reset_game_session from anon and authenticated; retain server-side service_role only
REVOKE EXECUTE ON FUNCTION reset_game_session() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_game_session() TO service_role;

-- Ensure ordinary players (anon, authenticated) CANNOT write to database tables:
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE game_sessions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE players FROM PUBLIC, anon, authenticated;

-- Allow ordinary players read-only access (SELECT)
GRANT SELECT ON TABLE game_sessions TO anon, authenticated;
GRANT SELECT ON TABLE players TO anon, authenticated;

-- Retain full table and sequence access for server-side service_role
GRANT ALL ON TABLE game_sessions TO service_role;
GRANT ALL ON TABLE players TO service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
