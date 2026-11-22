-- ============================================================================
-- CANVA ON TRIAL 2026: PRE-DEPLOYMENT SECURITY ADJUSTMENT
-- ============================================================================
-- Safe to run on live database: DOES NOT RESET, TRUNCATE, OR DELETE GAME DATA.
-- Preserves existing game session and player score records.
-- ============================================================================

-- 1. REVOKE EXECUTION OF reset_game_session() FROM anon AND authenticated
-- Retains server-side service_role access only
REVOKE EXECUTE ON FUNCTION reset_game_session() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_game_session() TO service_role;

-- 2. ENSURE ORDINARY PLAYERS CANNOT DIRECTLY WRITE TO DATABASE TABLES
-- Revoke all direct write privileges (INSERT, UPDATE, DELETE, TRUNCATE) from ordinary roles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE game_sessions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE players FROM PUBLIC, anon, authenticated;

-- Allow ordinary players read-only (SELECT) access
GRANT SELECT ON TABLE game_sessions TO anon, authenticated;
GRANT SELECT ON TABLE players TO anon, authenticated;

-- Retain full access for server-side service_role
GRANT ALL ON TABLE game_sessions TO service_role;
GRANT ALL ON TABLE players TO service_role;

-- Revoke sequence write access from ordinary players
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. ENSURE ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Read policies for public
DROP POLICY IF EXISTS "Public read game_sessions" ON game_sessions;
CREATE POLICY "Public read game_sessions" ON game_sessions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read players" ON players;
CREATE POLICY "Public read players" ON players FOR SELECT TO anon, authenticated USING (true);

-- Full access policies for service_role
DROP POLICY IF EXISTS "Service role full access game_sessions" ON game_sessions;
CREATE POLICY "Service role full access game_sessions" ON game_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access players" ON players;
CREATE POLICY "Service role full access players" ON players FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop any accidental write policies for anon/authenticated if they exist
DROP POLICY IF EXISTS "Public insert game_sessions" ON game_sessions;
DROP POLICY IF EXISTS "Public update game_sessions" ON game_sessions;
DROP POLICY IF EXISTS "Public delete game_sessions" ON game_sessions;
DROP POLICY IF EXISTS "Public insert players" ON players;
DROP POLICY IF EXISTS "Public update players" ON players;
DROP POLICY IF EXISTS "Public delete players" ON players;
