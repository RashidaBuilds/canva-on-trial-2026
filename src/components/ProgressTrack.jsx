import React from 'react';

/**
 * ProgressTrack Component
 * Displays "QUESTION X OF 11", the countdown timer ("00:07 left"),
 * and the 11-step progress bar matching the Figma design.
 */
export default function ProgressTrack({
  currentRound = 1,
  totalRounds = 11,
  remainingMs = 10000,
  isFinalExhibit = false
}) {
  const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
  const formattedSeconds = String(secondsLeft).padStart(2, '0');

  return (
    <div style={{ width: '100%', marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: isFinalExhibit ? 'var(--color-crimson)' : 'var(--color-ink-secondary)'
          }}
        >
          {isFinalExhibit ? 'FINAL EXHIBIT (ROUND 11 OF 11)' : `QUESTION ${String(currentRound).padStart(2, '0')} OF ${totalRounds}`}
        </span>

        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 600,
            color: secondsLeft <= 3 ? 'var(--color-crimson)' : 'var(--color-ink-primary)',
            transition: 'color var(--transition-fast)'
          }}
        >
          00:{formattedSeconds} left
        </span>
      </div>

      {/* 11-segment progress bar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          width: '100%',
          height: '6px'
        }}
      >
        {Array.from({ length: totalRounds }).map((_, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentRound;
          const isCurrent = stepNum === currentRound;

          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: '100%',
                borderRadius: '2px',
                backgroundColor: isCompleted
                  ? 'var(--color-crimson)'
                  : isCurrent
                  ? 'var(--color-gold)'
                  : 'rgba(107, 88, 68, 0.18)',
                transition: 'background-color var(--transition-normal)'
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
