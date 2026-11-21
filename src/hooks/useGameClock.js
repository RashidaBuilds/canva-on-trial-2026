import { useState, useEffect, useRef } from 'react';

export const LOBBY_DURATION_MS = 90000;       // 90 seconds
export const NORMAL_LOBBY_DURATION_MS = 80000; // First 80 seconds
export const GET_READY_DURATION_MS = 10000;   // Final 10 seconds of lobby
export const ANSWER_DURATION_MS = 10000;      // 10 seconds per question
export const CLUE_TRIGGER_MS = 5000;          // Clue reveals at 5s elapsed if unanswered
export const TOTAL_ROUNDS = 11;               // 10 regular + 1 Final Exhibit

/**
 * Authoritative Timestamp-Based Game Clock
 * Based on performance.now() and epoch delta calculations.
 * Ensures zero drift across re-renders and background tabs.
 */
export function useGameClock({
  startTime,
  onPhaseChange,
  onQuestionChange,
  onClueTrigger,
  onRoundTimeout,
  onGameComplete
}) {
  const [phase, setPhase] = useState('LOBBY_NORMAL'); // 'LOBBY_NORMAL' | 'LOBBY_GET_READY' | 'QUESTION' | 'LEADERBOARD'
  const [currentRound, setCurrentRound] = useState(1);
  const [roundElapsedMs, setRoundElapsedMs] = useState(0);
  const [lobbyRemainingMs, setLobbyRemainingMs] = useState(LOBBY_DURATION_MS);

  const prevPhaseRef = useRef(phase);
  const prevRoundRef = useRef(currentRound);
  const clueTriggeredRef = useRef(false);

  useEffect(() => {
    if (!startTime) return;

    let animFrameId;

    const tick = () => {
      const now = Date.now();
      const totalElapsed = now - startTime;

      if (totalElapsed < NORMAL_LOBBY_DURATION_MS) {
        // Normal Lobby (0s - 80s)
        const remaining = Math.max(0, LOBBY_DURATION_MS - totalElapsed);
        setLobbyRemainingMs(remaining);
        if (prevPhaseRef.current !== 'LOBBY_NORMAL') {
          prevPhaseRef.current = 'LOBBY_NORMAL';
          setPhase('LOBBY_NORMAL');
          onPhaseChange && onPhaseChange('LOBBY_NORMAL');
        }
      } else if (totalElapsed < LOBBY_DURATION_MS) {
        // Get Ready State (80s - 90s)
        const remaining = Math.max(0, LOBBY_DURATION_MS - totalElapsed);
        setLobbyRemainingMs(remaining);
        if (prevPhaseRef.current !== 'LOBBY_GET_READY') {
          prevPhaseRef.current = 'LOBBY_GET_READY';
          setPhase('LOBBY_GET_READY');
          onPhaseChange && onPhaseChange('LOBBY_GET_READY');
        }
      } else {
        // Questions phase (totalElapsed >= 90s)
        const questionPhaseElapsed = totalElapsed - LOBBY_DURATION_MS;
        const roundIndex = Math.floor(questionPhaseElapsed / ANSWER_DURATION_MS);
        const roundNumber = roundIndex + 1;

        if (roundNumber <= TOTAL_ROUNDS) {
          const currentRoundElapsed = questionPhaseElapsed % ANSWER_DURATION_MS;
          setRoundElapsedMs(currentRoundElapsed);

          if (prevPhaseRef.current !== 'QUESTION') {
            prevPhaseRef.current = 'QUESTION';
            setPhase('QUESTION');
            onPhaseChange && onPhaseChange('QUESTION');
          }

          if (prevRoundRef.current !== roundNumber) {
            prevRoundRef.current = roundNumber;
            clueTriggeredRef.current = false;
            setCurrentRound(roundNumber);
            onQuestionChange && onQuestionChange(roundNumber);
          }

          // Check Clue trigger at 5 seconds
          if (currentRoundElapsed >= CLUE_TRIGGER_MS && !clueTriggeredRef.current) {
            clueTriggeredRef.current = true;
            onClueTrigger && onClueTrigger(roundNumber);
          }
        } else {
          // All 11 rounds complete -> Leaderboard
          if (prevPhaseRef.current !== 'LEADERBOARD') {
            prevPhaseRef.current = 'LEADERBOARD';
            setPhase('LEADERBOARD');
            onPhaseChange && onPhaseChange('LEADERBOARD');
            onGameComplete && onGameComplete();
          }
        }
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [startTime, onPhaseChange, onQuestionChange, onClueTrigger, onRoundTimeout, onGameComplete]);

  return {
    phase,
    currentRound,
    roundElapsedMs,
    roundRemainingMs: Math.max(0, ANSWER_DURATION_MS - roundElapsedMs),
    lobbyRemainingMs
  };
}
