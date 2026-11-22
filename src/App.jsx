import React, { useState, useEffect, useCallback, useRef } from 'react';
import JoinScreen from './screens/JoinScreen';
import LobbyScreen from './screens/LobbyScreen';
import QuestionScreen from './screens/QuestionScreen';
import CompilationScreen from './screens/CompilationScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import MagnifyingLens from './components/MagnifyingLens';
import { QUESTIONS, TOTAL_ROUNDS } from './data/questions';
import {
  useGameClock,
  LOBBY_DURATION_MS,
  ANSWER_DURATION_MS,
  COMPILATION_DURATION_MS,
  QUIZ_DURATION_MS,
  TOTAL_GAME_DURATION_MS
} from './hooks/useGameClock';
import {
  fetchBackendData,
  registerPlayer,
  submitFinalScore,
  isScoreConfirmed,
  markScoreConfirmed,
  STORAGE_KEYS,
  INITIAL_INVESTIGATORS
} from './services/api';

const SESSION_EXPIRY_MS = TOTAL_GAME_DURATION_MS + 60000; // 268,000ms (~4.5 minutes)

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
  localStorage.removeItem(STORAGE_KEYS.SCORE_CONFIRMED);
  localStorage.removeItem(STORAGE_KEYS.QUESTION_HISTORY);
  localStorage.removeItem(STORAGE_KEYS.ROSTER);
  localStorage.removeItem(STORAGE_KEYS.ROW_INDEX);
  localStorage.removeItem(STORAGE_KEYS.REQUEST_ID);
  localStorage.removeItem(STORAGE_KEYS.TIME_OFFSET);
  localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
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

  // 3. Unique game session ID
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.SESSION_ID) || null;
  });

  // 4. State initialization with automatic stale session cleanup
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

  const [playerRequestId, setPlayerRequestId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.REQUEST_ID) || '';
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
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [scoresSubmitted, setScoresSubmitted] = useState(0);
  const [scoresPending, setScoresPending] = useState(0);
  const [allScoresSubmitted, setAllScoresSubmitted] = useState(false);
  const [isScoreConfirmedState, setIsScoreConfirmedState] = useState(() => isScoreConfirmed());
  const [pendingPlayerNames, setPendingPlayerNames] = useState([]);
  const isSubmittingScoreRef = useRef(false);

  // Synchronous and persistent score submission with automatic retries
  const triggerFinalScoreSubmission = useCallback(async () => {
    if (!playerName || isScoreConfirmed() || isSubmittingScoreRef.current) return;
    isSubmittingScoreRef.current = true;
    try {
      const currentRow = playerRowIndex || parseInt(localStorage.getItem(STORAGE_KEYS.ROW_INDEX) || '0', 10) || null;

      // 1. Calculate authoritative cumulative score:
      // Aggregate completed question history from localStorage
      let calculatedScore = 0;
      let hasHistory = false;
      try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTION_HISTORY) || '{}');
        const historyValues = Object.values(history);
        if (historyValues.length > 0) {
          hasHistory = true;
          calculatedScore = historyValues.reduce((sum, item) => sum + (Number(item?.pointsEarned) || 0), 0);
        }
      } catch (_) {}

      // Cross-check with stored PLAYER_SCORE and React playerScore state
      const storedScore = parseInt(localStorage.getItem(STORAGE_KEYS.PLAYER_SCORE) || '0', 10);
      if (!isNaN(storedScore)) {
        calculatedScore = Math.max(calculatedScore, storedScore);
      }
      if (typeof playerScore === 'number' && isFinite(playerScore)) {
        calculatedScore = Math.max(calculatedScore, playerScore);
      }

      const currentReqId = playerRequestId || localStorage.getItem(STORAGE_KEYS.REQUEST_ID) || null;
      const currentSessionId = sessionId || localStorage.getItem(STORAGE_KEYS.SESSION_ID) || null;

      const res = await submitFinalScore(playerName, calculatedScore, currentRow, currentReqId, currentSessionId);
      if (res && res.success && res.updated) {
        markScoreConfirmed();
        setIsScoreConfirmedState(true);
      }
    } catch (err) {
      console.warn('Final score submission encountered error, will retry:', err.message);
    } finally {
      isSubmittingScoreRef.current = false;
    }
  }, [playerName, playerScore, playerRowIndex, playerRequestId, sessionId]);

  // Hook into shared authoritative timestamp clock
  const {
    phase,
    currentRound,
    roundElapsedMs,
    roundRemainingMs,
    lobbyRemainingMs,
    compilationRemainingMs,
    isCompilationTimedOut
  } = useGameClock({
    startTime: startTime,
    serverTimeOffset: serverTimeOffset,
    allScoresSubmitted: allScoresSubmitted,
    totalPlayers: totalPlayers,
    onGameComplete: () => {
      triggerFinalScoreSubmission();
    }
  });

  // Automatically submit and retry final score during compilation or leaderboard until confirmed
  useEffect(() => {
    if ((phase === 'COMPILATION' || phase === 'LEADERBOARD') && playerName && !isScoreConfirmedState) {
      triggerFinalScoreSubmission();
    }
  }, [phase, playerName, isScoreConfirmedState, triggerFinalScoreSubmission]);

  // 5. Staggered Polling, Session Reconciler & Authoritative Sync
  // Polling rules:
  // - Staggered initial delay: 300-800ms
  // - Lobby interval: 6-8s with random jitter
  // - Active questions (phase === 'QUESTION'): PAUSED completely
  // - Compilation & Leaderboard: rapid refresh (2-3.5s) to aggregate all incoming scores
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    let finalisingTimer = null;

    if (phase === 'COMPILATION' || phase === 'LEADERBOARD') {
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

        const backendSessionId = data.sessionId;
        const hasBackendSession = !!(data.lobbyStartTime || (data.players && data.players.length > 0));

        // Session Transition Reconciler:
        // Do NOT purge an active registered player while game is actively in progress
        const isGameActive = phase === 'QUESTION' || phase === 'COMPILATION' || phase === 'LEADERBOARD';

        if (!hasBackendSession && !isGameActive) {
          // Backend has NO active session (sheet was reset or cleared by editor)
          if (sessionId || startTime || playerName) {
            clearStoredSession();
            setSessionId(null);
            setStartTime(null);
            setPlayerName('');
            setPlayerScore(0);
            setPlayerRowIndex(null);
            setInvestigators([]);
            setLeaderboardRows([]);
            setIsLateJoin(false);
            setTotalPlayers(0);
            setScoresSubmitted(0);
            setScoresPending(0);
            setAllScoresSubmitted(false);
            setIsScoreConfirmedState(false);
            setPendingPlayerNames([]);
          }
        } else if (backendSessionId && sessionId && backendSessionId !== sessionId && !isGameActive) {
          // Genuinely NEW game session started on backend! Purge old session only if not in active game
          clearStoredSession();
          setSessionId(backendSessionId);
          localStorage.setItem(STORAGE_KEYS.SESSION_ID, backendSessionId);
          setStartTime(data.lobbyStartTime);
          if (data.lobbyStartTime) {
            localStorage.setItem(STORAGE_KEYS.START_TIME, String(data.lobbyStartTime));
          }
          setPlayerName('');
          setPlayerScore(0);
          setPlayerRowIndex(null);
          setInvestigators(data.players ? data.players.map((p) => p.name).filter(Boolean) : []);
          setLeaderboardRows(data.players || []);
          setIsLateJoin(false);
          setTotalPlayers(typeof data.totalPlayers === 'number' ? data.totalPlayers : 0);
          setScoresSubmitted(typeof data.scoresSubmitted === 'number' ? data.scoresSubmitted : 0);
          setScoresPending(typeof data.scoresPending === 'number' ? data.scoresPending : 0);
          setAllScoresSubmitted(!!data.allScoresSubmitted);
          setIsScoreConfirmedState(false);
          setPendingPlayerNames([]);
        } else if (backendSessionId && !sessionId) {
          // Discovered active session on mount
          setSessionId(backendSessionId);
          localStorage.setItem(STORAGE_KEYS.SESSION_ID, backendSessionId);
          if (data.lobbyStartTime) {
            setStartTime(data.lobbyStartTime);
            localStorage.setItem(STORAGE_KEYS.START_TIME, String(data.lobbyStartTime));
          }
        } else if (data.lobbyStartTime && !startTime) {
          setStartTime(data.lobbyStartTime);
          localStorage.setItem(STORAGE_KEYS.START_TIME, String(data.lobbyStartTime));
        }

        // Sync compilation and score submission metrics from backend
        if (typeof data.totalPlayers === 'number') {
          setTotalPlayers(data.totalPlayers);
        }
        if (typeof data.scoresSubmitted === 'number') {
          setScoresSubmitted(data.scoresSubmitted);
        }
        if (typeof data.scoresPending === 'number') {
          setScoresPending(data.scoresPending);
        }
        if (typeof data.allScoresSubmitted === 'boolean') {
          setAllScoresSubmitted(data.allScoresSubmitted);
        }

        // Check if current player's score is confirmed on backend
        if (playerRowIndex && Array.isArray(data.players)) {
          const myBackendRecord = data.players.find((p) => p.rowIndex === playerRowIndex);
          if (myBackendRecord && myBackendRecord.hasScore && myBackendRecord.numericScore !== null) {
            markScoreConfirmed();
            setIsScoreConfirmedState(true);
          }
        }

        // Track pending player names
        if (Array.isArray(data.players)) {
          const pending = data.players.filter((p) => p.isPending).map((p) => p.name);
          setPendingPlayerNames(pending);
        }

        // Retry final score submission during compilation if still unconfirmed
        if ((phase === 'COMPILATION' || phase === 'LEADERBOARD') && playerName && !isScoreConfirmed()) {
          triggerFinalScoreSubmission();
        }

        // Update leaderboard data
        if (Array.isArray(data.players)) {
          setLeaderboardRows(data.players);

          // Update active roster directly from backend players (NO stale localStorage name merging!)
          // Retains duplicate nicknames properly as separate entries
          const backendNames = data.players.map((p) => p.name).filter(Boolean);
          const currentList = playerName && !backendNames.includes(playerName)
            ? [playerName, ...backendNames]
            : backendNames;

          setInvestigators(currentList);
        }
      }

      // Schedule next polling interval
      if (isMounted && phase !== 'QUESTION') {
        const nextDelayMs = phase === 'COMPILATION'
          ? 2000 + Math.floor(Math.random() * 500) // 2-2.5s rapid refresh during compilation
          : phase === 'LEADERBOARD'
            ? 3000 + Math.floor(Math.random() * 1500) // 3-4.5s rapid refresh on leaderboard
            : 6000 + Math.floor(Math.random() * 2000); // 6-8s during lobby

        timeoutId = setTimeout(poll, nextDelayMs);
      }
    };

    // Stagger initial request by 300-800ms
    const initialDelayMs = 300 + Math.floor(Math.random() * 500);
    timeoutId = setTimeout(poll, initialDelayMs);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (finalisingTimer) clearTimeout(finalisingTimer);
    };
  }, [phase, startTime, playerName, sessionId]);

  // 6. Late joiner detection:
  // ONLY true when game is actively in question phase (elapsed >= 90s && elapsed < 200s) AND visitor has not registered
  useEffect(() => {
    if (startTime && !isProjectorView) {
      const checkLate = () => {
        const now = Date.now() + serverTimeOffset;
        const elapsed = now - startTime;
        if (!playerName && elapsed >= LOBBY_DURATION_MS && elapsed < QUIZ_DURATION_MS) {
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
      if (res.isLobbyClosed) {
        setIsLateJoin(true);
      }
      return { success: false, error: res.error };
    }

    // 2. Persist player details locally
    setPlayerName(nickname);
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, nickname);

    if (res.sessionId) {
      setSessionId(res.sessionId);
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, res.sessionId);
    }

    if (res.rowIndex) {
      setPlayerRowIndex(res.rowIndex);
      localStorage.setItem(STORAGE_KEYS.ROW_INDEX, String(res.rowIndex));
    }

    if (res.requestId) {
      setPlayerRequestId(res.requestId);
      localStorage.setItem(STORAGE_KEYS.REQUEST_ID, res.requestId);
    }

    // 3. Synchronise authoritative lobby start time
    let authoritativeStart = res.lobbyStartTime || startTime;
    if (!authoritativeStart) {
      // Query backend state immediately to receive Player 1's timestamp if not in join response
      const latestData = await fetchBackendData();
      if (latestData && latestData.lobbyStartTime) {
        authoritativeStart = latestData.lobbyStartTime;
        if (latestData.sessionId) {
          setSessionId(latestData.sessionId);
          localStorage.setItem(STORAGE_KEYS.SESSION_ID, latestData.sessionId);
        }
      } else {
        // Player 1 establishing start time
        authoritativeStart = Date.now() + (res.serverTimeOffset || serverTimeOffset);
      }
    }

    setStartTime(authoritativeStart);
    localStorage.setItem(STORAGE_KEYS.START_TIME, String(authoritativeStart));

    if (res.serverTimeOffset) {
      setServerTimeOffset(res.serverTimeOffset);
    }

    // 4. Initialize clean score state and update investigator roster immediately
    localStorage.setItem(STORAGE_KEYS.PLAYER_SCORE, '0');
    localStorage.removeItem(STORAGE_KEYS.SCORE_CONFIRMED);
    localStorage.removeItem(STORAGE_KEYS.QUESTION_HISTORY);
    setPlayerScore(0);
    setIsScoreConfirmedState(false);
    setInvestigators((prev) => [nickname, ...prev]);

    return { success: true };
  }, [startTime, serverTimeOffset]);

  // Handle Answer Submission during Question rounds
  const handleAnswerSubmit = useCallback(({ questionId, pointsEarned, unanswered }) => {
    setPlayerScore((prev) => {
      const nextScore = prev + (pointsEarned || 0);
      localStorage.setItem(STORAGE_KEYS.PLAYER_SCORE, String(nextScore));
      return nextScore;
    });

    try {
      const existingHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTION_HISTORY) || '{}');
      existingHistory[questionId] = {
        pointsEarned: pointsEarned || 0,
        unanswered: !!unanswered,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEYS.QUESTION_HISTORY, JSON.stringify(existingHistory));
    } catch (_) {}
  }, []);

  // ROUTE 1: Public Projector View (/leaderboard)
  if (isProjectorView) {
    if (phase === 'COMPILATION') {
      return (
        <>
          <MagnifyingLens />
          <CompilationScreen
            remainingMs={compilationRemainingMs}
            totalDurationMs={COMPILATION_DURATION_MS}
            playerName=""
            playerScore={0}
            isProjectorView={true}
            isSubmitted={true}
            totalPlayers={totalPlayers}
            scoresSubmitted={scoresSubmitted}
            scoresPending={scoresPending}
            allScoresSubmitted={allScoresSubmitted}
            pendingPlayerNames={pendingPlayerNames}
            isTimedOut={isCompilationTimedOut}
          />
        </>
      );
    }

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
        <MagnifyingLens enableMobileTouch={!isLateJoin} />
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

  // Stage 4: Case Compilation Screen
  if (phase === 'COMPILATION') {
    return (
      <>
        <MagnifyingLens />
        <CompilationScreen
          remainingMs={compilationRemainingMs}
          totalDurationMs={COMPILATION_DURATION_MS}
          playerName={playerName}
          playerScore={playerScore}
          isProjectorView={false}
          isSubmitted={isScoreConfirmedState}
          totalPlayers={totalPlayers}
          scoresSubmitted={scoresSubmitted}
          scoresPending={scoresPending}
          allScoresSubmitted={allScoresSubmitted}
          pendingPlayerNames={pendingPlayerNames}
          isTimedOut={isCompilationTimedOut}
        />
      </>
    );
  }

  // Stage 5: Final Authoritative Leaderboard Screen (T >= 208s)
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
