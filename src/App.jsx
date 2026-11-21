import React, { useState, useEffect, useCallback, useRef } from 'react';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import QuestionScreen from './screens/QuestionScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import MagnifyingLens from './components/MagnifyingLens';
import { QUESTIONS, TOTAL_ROUNDS } from './data/questions';
import { useGameClock, LOBBY_DURATION_MS, ANSWER_DURATION_MS } from './hooks/useGameClock';
import {
  fetchBackendData,
  registerPlayer,
  submitFinalScore,
  STORAGE_KEYS,
  INITIAL_INVESTIGATORS
} from './services/api';

// Total active quiz game time: 90s lobby + 11 rounds * 10s = 200s (200,000ms)
const TOTAL_GAME_DURATION_MS = LOBBY_DURATION_MS + TOTAL_ROUNDS * ANSWER_DURATION_MS;
const SESSION_EXPIRY_MS = TOTAL_GAME_DURATION_MS + 40000; // 240,000ms (4 minutes)

// Clean path helper for exact pathname matching
function normalizePath(pathname) {
  const clean = (pathname || '').replace(/\/+$/, '');
  return clean === '' ? '/' : clean;
}

// Purge all stored session state to prevent stale players (e.g. Sarah) or old timers from leaking
function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEYS.PLAYER_NAME);
  localStorage.removeItem(STORAGE_KEYS.START_TIME);
  localStorage.removeItem(STORAGE_KEYS.PLAYER_SCORE);
  localStorage.removeItem(STORAGE_KEYS.ROSTER);
  localStorage.removeItem(STORAGE_KEYS.ROW_INDEX);
  localStorage.removeItem(STORAGE_KEYS.TIME_OFFSET);
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

  // 2. Server time offset for clock drift synchronization
  const [serverTimeOffset, setServerTimeOffset] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TIME_OFFSET);
    return saved ? parseInt(saved, 10) || 0 : 0;
  });

  // 3. State initialization with automatic stale session cleanup
  const [playerName, setPlayerName] = useState(() => {
    const savedStartTime = localStorage.getItem(STORAGE_KEYS.START_TIME);
    if (savedStartTime) {
      const elapsed = Date.now() - parseInt(savedStartTime, 10);
      if (elapsed > SESSION_EXPIRY_MS) {
        clearStoredSession();
        return '';
      }
    }
    return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || '';
  });

  const [playerRowIndex, setPlayerRowIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROW_INDEX);
    return saved ? parseInt(saved, 10) : null;
  });

  const [playerScore, setPlayerScore] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PLAYER_SCORE);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [startTime, setStartTime] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.START_TIME);
    if (!saved) return null;
    const parsed = parseInt(saved, 10);
    const elapsed = Date.now() - parsed;
    if (elapsed > SESSION_EXPIRY_MS) return null;
    return parsed;
  });

  // Dynamic Investigator Roster: populated ONLY by active backend participants
  const [investigators, setInvestigators] = useState(() => INITIAL_INVESTIGATORS);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [isLateJoin, setIsLateJoin] = useState(false);
  const [isFinalising, setIsFinalising] = useState(false);
  const scoreSubmittedRef = useRef(false);

  // Hook into shared authoritative timestamp clock
  const {
    phase,
    currentRound,
    roundElapsedMs,
    roundRemainingMs,
    lobbyRemainingMs
  } = useGameClock({
    startTime: startTime,
    serverTimeOffset: serverTimeOffset,
    onGameComplete: () => {
      if (playerName && !scoreSubmittedRef.current) {
        scoreSubmittedRef.current = true;
        submitFinalScore(playerName, playerScore, playerRowIndex);
      }
    }
  });

  // 4. Staggered Polling & Authoritative Session Sync
  // Polling rules:
  // - Staggered initial delay: 500-1500ms
  // - Lobby interval: 6-8s with random jitter
  // - Active questions (phase === 'QUESTION'): PAUSED completely
  // - Leaderboard: brief rapid refresh (3-4s for first 15s) to finalize scores
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    let finalisingTimer = null;

    if (phase === 'LEADERBOARD') {
      setIsFinalising(true);
      finalisingTimer = setTimeout(() => {
        if (isMounted) setIsFinalising(false);
      }, 15000);
    }

    const poll = async () => {
      // Never poll during active questions to avoid client-side network contention
      if (phase === 'QUESTION') return;

      const data = await fetchBackendData();
      if (!isMounted) return;

      if (data) {
        // Sync clock offset if provided
        if (typeof data.serverTimeOffset === 'number' && data.serverTimeOffset !== 0) {
          setServerTimeOffset(data.serverTimeOffset);
        }

        // Session reset detection:
        // If the backend has a new session or reset lobbyStartTime, reconcile state
        if (data.lobbyStartTime) {
          if (startTime && Math.abs(data.lobbyStartTime - startTime) > 5000) {
            // Backend session changed (e.g. sheet cleared for fresh game)
            clearStoredSession();
            setStartTime(data.lobbyStartTime);
            setPlayerRowIndex(null);
            scoreSubmittedRef.current = false;
          } else if (!startTime) {
            setStartTime(data.lobbyStartTime);
            localStorage.setItem(STORAGE_KEYS.START_TIME, String(data.lobbyStartTime));
          }
        }

        // Update leaderboard data
        if (Array.isArray(data.players)) {
          setLeaderboardRows(data.players);

          // Update active roster directly from backend players (NO stale localStorage name merging!)
          // Retains duplicate nicknames properly as separate entries!
          const backendNames = data.players.map((p) => p.name).filter(Boolean);
          const currentList = playerName && !backendNames.includes(playerName)
            ? [playerName, ...backendNames]
            : backendNames;

          setInvestigators(currentList);
        }
      }

      // Schedule next polling interval
      if (isMounted && phase !== 'QUESTION') {
        const nextDelayMs = phase === 'LEADERBOARD'
          ? 3000 + Math.floor(Math.random() * 1500) // 3-4.5s rapid refresh on leaderboard
          : 6000 + Math.floor(Math.random() * 2000); // 6-8s during lobby

        timeoutId = setTimeout(poll, nextDelayMs);
      }
    };

    // Stagger initial request by 400-1200ms
    const initialDelayMs = 400 + Math.floor(Math.random() * 800);
    timeoutId = setTimeout(poll, initialDelayMs);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (finalisingTimer) clearTimeout(finalisingTimer);
    };
  }, [phase, startTime, playerName]);

  // 5. Late joiner detection:
  // ONLY true when game is actively in question phase (elapsed >= 90s && elapsed < 200s) AND visitor has not registered
  useEffect(() => {
    if (startTime && !isProjectorView) {
      const checkLate = () => {
        const now = Date.now() + serverTimeOffset;
        const elapsed = now - startTime;
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
  }, [startTime, playerName, isProjectorView, serverTimeOffset]);

  // Handle Player Registration
  const handleJoin = useCallback(async (nickname) => {
    // 1. Call backend registration with ~0.5s stagger, client ID & retry safety
    const res = await registerPlayer(nickname);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    // 2. Persist player details locally
    setPlayerName(nickname);
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, nickname);

    if (res.rowIndex) {
      setPlayerRowIndex(res.rowIndex);
      localStorage.setItem(STORAGE_KEYS.ROW_INDEX, String(res.rowIndex));
    }

    // 3. Synchronise authoritative lobby start time
    if (res.lobbyStartTime) {
      setStartTime(res.lobbyStartTime);
      localStorage.setItem(STORAGE_KEYS.START_TIME, String(res.lobbyStartTime));
    } else if (!startTime) {
      const now = Date.now() + (res.serverTimeOffset || serverTimeOffset);
      setStartTime(now);
      localStorage.setItem(STORAGE_KEYS.START_TIME, String(now));
    }

    if (res.serverTimeOffset) {
      setServerTimeOffset(res.serverTimeOffset);
    }

    // 4. Update investigator roster immediately
    setInvestigators((prev) => [nickname, ...prev]);

    return { success: true };
  }, [startTime, serverTimeOffset]);

  // Handle Answer Submission during Question rounds
  const handleAnswerSubmit = useCallback(({ pointsEarned }) => {
    if (pointsEarned > 0) {
      setPlayerScore((prev) => {
        const nextScore = prev + pointsEarned;
        localStorage.setItem(STORAGE_KEYS.PLAYER_SCORE, String(nextScore));
        return nextScore;
      });
    }
  }, []);

  // ROUTE 1: Public Projector View (/leaderboard)
  if (isProjectorView) {
    return (
      <>
        <MagnifyingLens />
        <LeaderboardScreen
          leaderboardData={leaderboardRows}
          currentPlayerName=""
          currentPlayerScore={0}
          currentPlayerRowIndex={null}
          isProjectorView={true}
          isFinalising={isFinalising}
        />
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
        currentPlayerRowIndex={playerRowIndex}
        isProjectorView={false}
        isFinalising={isFinalising}
      />
    </>
  );
}
