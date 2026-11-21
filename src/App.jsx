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
const STORAGE_KEY_ROSTER = 'canva_trial_2026_roster';

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
    const savedStartTime = localStorage.getItem(STORAGE_KEY_START_TIME);
    if (savedStartTime) {
      const elapsed = Date.now() - parseInt(savedStartTime, 10);
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
    const saved = localStorage.getItem(STORAGE_KEY_PLAYER_SCORE);
    return saved ? parseInt(saved, 10) : 0;
  });

  const [startTime, setStartTime] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_START_TIME);
    if (!saved) return null;
    const parsed = parseInt(saved, 10);
    const elapsed = Date.now() - parsed;
    if (elapsed > SESSION_EXPIRY_MS) return null;
    return parsed;
  });

  // Dynamic Investigator Roster: populated by actual joins and backend participants
  const [investigators, setInvestigators] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ROSTER);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_INVESTIGATORS;
  });

  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [isLateJoin, setIsLateJoin] = useState(false);
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
    onGameComplete: () => {
      if (playerName && !scoreSubmittedRef.current) {
        scoreSubmittedRef.current = true;
        submitFinalScore(playerName, playerScore);
      }
    }
  });

  // 3. Modest Lobby Polling with Random Jitter (6–8s offset; suspended during active questions)
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const poll = async () => {
      // Do not poll during question rounds to prevent network contention on mobile devices
      if (phase === 'QUESTION') return;

      const data = await fetchBackendData();
      if (!isMounted) return;

      if (data) {
        const parsed = parseLeaderboardRows(data);
        if (parsed.length > 0) {
          setLeaderboardRows(parsed);
          const names = parsed.map(p => p.name);
          setInvestigators(prev => {
            const merged = Array.from(new Set([...prev, ...names]));
            localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(merged));
            return merged;
          });
        }
      }

      // Schedule next polling request with 6-8s random offset (jitter)
      if (isMounted && phase !== 'QUESTION') {
        const jitterMs = 6000 + Math.floor(Math.random() * 2000);
        timeoutId = setTimeout(poll, jitterMs);
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [phase]);

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

  // Handle Player Registration
  const handleJoin = useCallback((nickname) => {
    setPlayerName(nickname);
    localStorage.setItem(STORAGE_KEY_PLAYER_NAME, nickname);

    // Register with backend service
    registerPlayer(nickname);

    // Add player to investigators roster immediately and persist
    setInvestigators(prev => {
      const updated = prev.includes(nickname) ? prev : [nickname, ...prev];
      localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(updated));
      return updated;
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

  // ROUTE 1: Public Projector View (/leaderboard)
  if (isProjectorView) {
    return (
      <>
        <MagnifyingLens />
        <LeaderboardScreen
          leaderboardData={leaderboardRows}
          currentPlayerName=""
          currentPlayerScore={0}
          isProjectorView={true}
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
        isProjectorView={false}
      />
    </>
  );
}
