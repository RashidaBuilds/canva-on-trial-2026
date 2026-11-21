import React, { useState, useEffect, useCallback, useRef } from 'react';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import QuestionScreen from './screens/QuestionScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import MagnifyingLens from './components/MagnifyingLens';
import { QUESTIONS, TOTAL_ROUNDS } from './data/questions';
import { useGameClock, LOBBY_DURATION_MS, ANSWER_DURATION_MS } from './hooks/useGameClock';
import { fetchBackendData, parseLeaderboardRows, registerPlayer, submitFinalScore, INITIAL_INVESTIGATORS } from './services/api';

const STORAGE_KEY_START_TIME = 'canva_trial_2026_start_time';
const STORAGE_KEY_PLAYER_NAME = 'canva_trial_2026_player_name';
const STORAGE_KEY_PLAYER_SCORE = 'canva_trial_2026_player_score';

// Total active quiz game time: 90s lobby + 11 rounds * 10s = 200s
const TOTAL_GAME_DURATION_MS = LOBBY_DURATION_MS + TOTAL_ROUNDS * ANSWER_DURATION_MS; // 200,000ms
const SESSION_EXPIRY_MS = TOTAL_GAME_DURATION_MS + 40000; // 240,000ms (4 minutes)

// Clean path helper for exact pathname matching
function normalizePath(pathname) {
  const clean = (pathname || '').replace(/\/+$/, '');
  return clean === '' ? '/' : clean;
}

export default function App() {
  // 1. Independent exact pathname route matching
  // '/' is the Player experience; '/leaderboard' is strictly the Public Projector View
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isProjectorView = currentPath === '/leaderboard';

  // 2. State initialization with automatic stale session cleanup
  const [playerName, setPlayerName] = useState(() => {
    // If testing reset param is present, wipe storage immediately
    if (window.location.search.includes('reset=true')) {
      localStorage.removeItem(STORAGE_KEY_PLAYER_NAME);
      localStorage.removeItem(STORAGE_KEY_START_TIME);
      localStorage.removeItem(STORAGE_KEY_PLAYER_SCORE);
      return '';
    }

    const savedStartTime = localStorage.getItem(STORAGE_KEY_START_TIME);
    if (savedStartTime) {
      const elapsed = Date.now() - parseInt(savedStartTime, 10);
      // If previous session is older than session expiry threshold, clear stale session
      if (elapsed > SESSION_EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY_PLAYER_NAME);
        localStorage.removeItem(STORAGE_KEY_START_TIME);
        localStorage.removeItem(STORAGE_KEY_PLAYER_SCORE);
        return '';
      }
    }
    return localStorage.getItem(STORAGE_KEY_PLAYER_NAME) || '';
  });

  const [playerScore, setPlayerScore] = useState(() => {
    if (window.location.search.includes('reset=true')) return 0;
    const saved = localStorage.getItem(STORAGE_KEY_PLAYER_SCORE);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [startTime, setStartTime] = useState(() => {
    if (window.location.search.includes('reset=true')) return null;
    const saved = localStorage.getItem(STORAGE_KEY_START_TIME);
    if (!saved) return null;
    const parsed = parseInt(saved, 10);
    const elapsed = Date.now() - parsed;
    if (elapsed > SESSION_EXPIRY_MS) return null;
    return parsed;
  });

  const [investigators, setInvestigators] = useState(INITIAL_INVESTIGATORS);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [isLateJoin, setIsLateJoin] = useState(false);
  const scoreSubmittedRef = useRef(false);

  // Clean URL query string if ?reset=true was passed
  useEffect(() => {
    if (window.location.search.includes('reset=true')) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // 3. Central Reset Handler
  const handleReset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_START_TIME);
    localStorage.removeItem(STORAGE_KEY_PLAYER_NAME);
    localStorage.removeItem(STORAGE_KEY_PLAYER_SCORE);
    setPlayerName('');
    setPlayerScore(0);
    setStartTime(null);
    setIsLateJoin(false);
    scoreSubmittedRef.current = false;

    // If on projector route and resetting to player, navigate to root
    if (normalizePath(window.location.pathname) !== '/') {
      window.history.pushState({}, '', '/');
      setCurrentPath('/');
    }
  }, []);

  // Poll backend for real-time participants and scores
  useEffect(() => {
    let isMounted = true;
    const loadBackendData = async () => {
      const data = await fetchBackendData();
      if (!isMounted || !data) return;

      const parsed = parseLeaderboardRows(data);
      if (parsed.length > 0) {
        setLeaderboardRows(parsed);
        const names = parsed.map(p => p.name);
        setInvestigators(prev => Array.from(new Set([...prev, ...names])));
      }
    };

    loadBackendData();
    const interval = setInterval(loadBackendData, 10000); // 10s poll

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 4. Late joiner detection:
  // ONLY true when game is actively in question phase (elapsed >= 90s && elapsed < 200s) AND visitor has not registered
  useEffect(() => {
    if (startTime && !isProjectorView) {
      const checkLate = () => {
        const elapsed = Date.now() - startTime;
        if (!playerName && elapsed >= LOBBY_DURATION_MS && elapsed < TOTAL_GAME_DURATION_MS) {
          setIsLateJoin(true);
        } else {
          setIsLateJoin(false);
        }
      };
      checkLate();
      const interval = setInterval(checkLate, 1000);
      return () => clearInterval(interval);
    } else {
      setIsLateJoin(false);
    }
  }, [startTime, playerName, isProjectorView]);

  // Hook into shared authoritative timestamp clock
  const {
    phase,
    currentRound,
    roundElapsedMs,
    roundRemainingMs,
    lobbyRemainingMs
  } = useGameClock({
    startTime: startTime,
    onGameComplete: () => {
      // Submit score automatically when all 11 rounds conclude
      if (playerName && !scoreSubmittedRef.current) {
        scoreSubmittedRef.current = true;
        submitFinalScore(playerName, playerScore);
      }
    }
  });

  // Handle Player Registration
  const handleJoin = useCallback((nickname) => {
    setPlayerName(nickname);
    localStorage.setItem(STORAGE_KEY_PLAYER_NAME, nickname);

    // Register with backend service
    registerPlayer(nickname);

    // Add to local investigators roster
    setInvestigators(prev => {
      if (!prev.includes(nickname)) {
        return [nickname, ...prev];
      }
      return prev;
    });

    // If game has not started yet or previous game concluded, establish fresh timestamp
    const now = Date.now();
    if (!startTime || (now - startTime >= TOTAL_GAME_DURATION_MS)) {
      setStartTime(now);
      localStorage.setItem(STORAGE_KEY_START_TIME, String(now));
    }
  }, [startTime]);

  // Handle Answer Submission during Question rounds
  const handleAnswerSubmit = useCallback(({ pointsEarned }) => {
    if (pointsEarned > 0) {
      setPlayerScore(prev => {
        const nextScore = prev + pointsEarned;
        localStorage.setItem(STORAGE_KEY_PLAYER_SCORE, String(nextScore));
        return nextScore;
      });
    }
  }, []);

  // Helper reset button element for local testing convenience
  const renderResetButton = () => (
    <button
      type="button"
      onClick={handleReset}
      title="Reset game state & return to Join screen (?reset=true)"
      style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        padding: '6px 12px',
        backgroundColor: 'rgba(255, 251, 243, 0.92)',
        border: '1px solid var(--border-parchment-dark)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-sans)',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--color-ink-muted)',
        cursor: 'pointer',
        zIndex: 9999,
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)',
        transition: 'opacity var(--transition-fast)'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-burgundy)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-ink-muted)')}
    >
      ↻ Reset Game
    </button>
  );

  // ROUTE 1: Public Projector View (/leaderboard)
  // Strictly independent from player view. Always renders leaderboard without requiring join.
  if (isProjectorView) {
    return (
      <>
        <MagnifyingLens />
        <LeaderboardScreen
          leaderboardData={leaderboardRows}
          currentPlayerName=""
          currentPlayerScore={0}
          isProjectorView={true}
          onReset={handleReset}
        />
        {renderResetButton()}
      </>
    );
  }

  // ROUTE 2: Player Route (/)

  // Stage 1: Player Join Registration (or Late Join Locked Screen)
  if (!playerName || isLateJoin) {
    return (
      <>
        <MagnifyingLens />
        <JoinScreen onJoin={handleJoin} isLateJoin={isLateJoin} />
        {renderResetButton()}
      </>
    );
  }

  // Stage 2: Lobby (Normal 0-80s & Get Ready 80-90s)
  if (phase === 'LOBBY_NORMAL' || phase === 'LOBBY_GET_READY') {
    return (
      <>
        <MagnifyingLens />
        <LobbyScreen
          isGetReady={phase === 'LOBBY_GET_READY'}
          remainingMs={lobbyRemainingMs}
          investigators={investigators}
          nickname={playerName}
        />
        {renderResetButton()}
      </>
    );
  }

  // Stage 3: Question Experience (Rounds 1 through 11)
  if (phase === 'QUESTION') {
    const currentQuestion = QUESTIONS[currentRound - 1] || QUESTIONS[0];

    return (
      <>
        <MagnifyingLens />
        <QuestionScreen
          key={currentQuestion.id}
          question={currentQuestion}
          totalRounds={TOTAL_ROUNDS}
          score={playerScore}
          roundRemainingMs={roundRemainingMs}
          roundElapsedMs={roundElapsedMs}
          onAnswerSubmit={handleAnswerSubmit}
        />
        {renderResetButton()}
      </>
    );
  }

  // Stage 4: Personal Final Results Screen
  return (
    <>
      <MagnifyingLens />
      <LeaderboardScreen
        leaderboardData={leaderboardRows}
        currentPlayerName={playerName}
        currentPlayerScore={playerScore}
        isProjectorView={false}
        onReset={handleReset}
      />
      {renderResetButton()}
    </>
  );
}