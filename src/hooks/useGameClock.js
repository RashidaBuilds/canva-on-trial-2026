import { useState, useEffect, useRef } from 'react';

export const LOBBY_DURATION_MS = 90000;       // 90 seconds
export const NORMAL_LOBBY_DURATION_MS = 80000; // First 80 seconds
export const GET_READY_DURATION_MS = 10000;   // Final 10 seconds of lobby
export const ANSWER_DURATION_MS = 10000;      // 10 seconds per question
export const CLUE_TRIGGER_MS = 5000;          // Clue reveals at 5s elapsed if unanswered
export const TOTAL_ROUNDS = 11;               // 10 regular + 1 Final Exhibit
export const COMPILATION_DURATION_MS = 8000;  // 8 seconds for score tallying & compilation
export const COMPILATION_TIMEOUT_MS = 18000;   // 18 seconds max in compilation to prevent hanging indefinitely
export const QUIZ_DURATION_MS = LOBBY_DURATION_MS + TOTAL_ROUNDS * ANSWER_DURATION_MS; // 200,000ms
export const TOTAL_GAME_DURATION_MS = QUIZ_DURATION_MS + COMPILATION_DURATION_MS;       // 208,000ms

/**
 * Authoritative Timestamp-Based Game Clock
 * Based on server-synchronized epoch delta calculations.
 * Ensures zero drift across devices, re-renders, and background tabs.
 */
export function useGameClock({
  startTime,
  serverTimeOffset = 0,
  allScoresSubmitted = false,
  totalPlayers = 0,
  onPhaseChange,
  onQuestionChange,
  onClueTrigger,
  onRoundTimeout,
  onGameComplete
}) {
  const [phase, setPhase] = useState('LOBBY_NORMAL'); // 'LOBBY_NORMAL' | 'LOBBY_GET_READY' | 'QUESTION' | 'COMPILATION' | 'LEADERBOARD'
  const [currentRound, setCurrentRound] = useState(1);
  const [roundElapsedMs, setRoundElapsedMs] = useState(0);
  const [lobbyRemainingMs, setLobbyRemainingMs] = useState(LOBBY_DURATION_MS);
  const [compilationRemainingMs, setCompilationRemainingMs] = useState(COMPILATION_DURATION_MS);
  const [isCompilationTimedOut, setIsCompilationTimedOut] = useState(false);

  const prevPhaseRef = useRef(phase);
  const prevRoundRef = useRef(currentRound);
  const clueTriggeredRef = useRef(false);
  const scoreTriggeredRef = useRef(false);

  // Preserve latest callbacks in refs to prevent animation frame loop thrashing
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const onQuestionChangeRef = useRef(onQuestionChange);
  onQuestionChangeRef.current = onQuestionChange;
  const onClueTriggerRef = useRef(onClueTrigger);
  onClueTriggerRef.current = onClueTrigger;
  const onGameCompleteRef = useRef(onGameComplete);
  onGameCompleteRef.current = onGameComplete;

  useEffect(() => {
    if (!startTime) {
      setPhase('LOBBY_NORMAL');
      setLobbyRemainingMs(LOBBY_DURATION_MS);
      setCompilationRemainingMs(COMPILATION_DURATION_MS);
      setIsCompilationTimedOut(false);
      return;
    }

    let animFrameId;

    const tick = () => {
      // Synchronise client clock with server
      const now = Date.now() + (serverTimeOffset || 0);
      const totalElapsed = now - startTime;

      if (totalElapsed < NORMAL_LOBBY_DURATION_MS) {
        // Normal Lobby (0s - 80s)
        const remaining = Math.max(0, LOBBY_DURATION_MS - Math.max(0, totalElapsed));
        setLobbyRemainingMs(remaining);
        if (prevPhaseRef.current !== 'LOBBY_NORMAL') {
          prevPhaseRef.current = 'LOBBY_NORMAL';
          setPhase('LOBBY_NORMAL');
          onPhaseChangeRef.current && onPhaseChangeRef.current('LOBBY_NORMAL');
        }
      } else if (totalElapsed < LOBBY_DURATION_MS) {
        // Get Ready State (80s - 90s)
        const remaining = Math.max(0, LOBBY_DURATION_MS - totalElapsed);
        setLobbyRemainingMs(remaining);
        if (prevPhaseRef.current !== 'LOBBY_GET_READY') {
          prevPhaseRef.current = 'LOBBY_GET_READY';
          setPhase('LOBBY_GET_READY');
          onPhaseChangeRef.current && onPhaseChangeRef.current('LOBBY_GET_READY');
        }
      } else if (totalElapsed < QUIZ_DURATION_MS) {
        // Questions phase (90s - 200s, 11 rounds of 10s)
        const questionPhaseElapsed = totalElapsed - LOBBY_DURATION_MS;
        const roundIndex = Math.floor(questionPhaseElapsed / ANSWER_DURATION_MS);
        const roundNumber = roundIndex + 1;

        if (roundNumber <= TOTAL_ROUNDS) {
          const currentRoundElapsed = questionPhaseElapsed % ANSWER_DURATION_MS;
          setRoundElapsedMs(currentRoundElapsed);

          if (prevPhaseRef.current !== 'QUESTION') {
            prevPhaseRef.current = 'QUESTION';
            setPhase('QUESTION');
            onPhaseChangeRef.current && onPhaseChangeRef.current('QUESTION');
          }

          if (prevRoundRef.current !== roundNumber) {
            prevRoundRef.current = roundNumber;
            clueTriggeredRef.current = false;
            setCurrentRound(roundNumber);
            onQuestionChangeRef.current && onQuestionChangeRef.current(roundNumber);
          }

          // Check Clue trigger at 5 seconds
          if (currentRoundElapsed >= CLUE_TRIGGER_MS && !clueTriggeredRef.current) {
            clueTriggeredRef.current = true;
            onClueTriggerRef.current && onClueTriggerRef.current(roundNumber);
          }
        }
      } else {
        // Active questions complete (totalElapsed >= 200s)
        // Automatically dispatch score submission immediately when entering compilation
        if (!scoreTriggeredRef.current) {
          scoreTriggeredRef.current = true;
          onGameCompleteRef.current && onGameCompleteRef.current();
        }

        // Bounded compilation transition:
        // Transition to Leaderboard if all scores are confirmed by the backend,
        // OR if the reasonable compilation timeout (18s) has elapsed so compilation never waits forever.
        const timedOut = totalElapsed >= (QUIZ_DURATION_MS + COMPILATION_TIMEOUT_MS);
        setIsCompilationTimedOut(timedOut);

        const isAllConfirmed = totalPlayers > 0
          ? (allScoresSubmitted && totalElapsed >= (QUIZ_DURATION_MS + 2500))
          : (totalElapsed >= TOTAL_GAME_DURATION_MS);

        const isLeaderboardReady = isAllConfirmed || timedOut;

        if (!isLeaderboardReady) {
          // Stay in Compilation phase while scores are still pending
          const remaining = Math.max(0, TOTAL_GAME_DURATION_MS - totalElapsed);
          setCompilationRemainingMs(remaining);

          if (prevPhaseRef.current !== 'COMPILATION') {
            prevPhaseRef.current = 'COMPILATION';
            setPhase('COMPILATION');
            onPhaseChangeRef.current && onPhaseChangeRef.current('COMPILATION');
          }
        } else {
          // Transition to Authoritative Leaderboard
          if (prevPhaseRef.current !== 'LEADERBOARD') {
            prevPhaseRef.current = 'LEADERBOARD';
            setPhase('LEADERBOARD');
            onPhaseChangeRef.current && onPhaseChangeRef.current('LEADERBOARD');
          }
        }
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [startTime, serverTimeOffset, allScoresSubmitted, totalPlayers]);

  return {
    phase,
    currentRound,
    roundElapsedMs,
    roundRemainingMs: Math.max(0, ANSWER_DURATION_MS - roundElapsedMs),
    lobbyRemainingMs,
    compilationRemainingMs,
    COMPILATION_DURATION_MS,
    isCompilationTimedOut
  };
}
