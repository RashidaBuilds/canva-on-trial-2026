import React from 'react';

/**
 * FeedbackBanner Component
 * Matches Figma component set #19:731:
 * - 'correct': Green banner with checkmark and points earned
 * - 'incorrect': Red banner with "Not quite!" (never reveals correct answer)
 * - 'expired': Amber banner when deadline expires without submission
 */
export default function FeedbackBanner({
  status, // 'correct' | 'incorrect' | 'expired'
  pointsEarned = 0,
  explanation = ''
}) {
  if (!status) return null;

  let bg = 'var(--color-correct-bg)';
  let border = 'var(--color-correct-border)';
  let textColor = 'var(--color-correct-text)';
  let title = `✓ Correct! +${pointsEarned} points`;
  let subtitle = explanation || 'Evidence verified. Next question soon.';

  if (status === 'incorrect') {
    bg = 'var(--color-incorrect-bg)';
    border = 'var(--color-incorrect-border)';
    textColor = 'var(--color-incorrect-text)';
    title = '× Not quite!';
    subtitle = 'Your answer has been locked into the trial record.';
  } else if (status === 'expired') {
    bg = 'var(--color-clue-bg)';
    border = 'var(--color-clue-border)';
    textColor = 'var(--color-clue-text)';
    title = 'Time’s up!';
    subtitle = 'No answer submitted. Advancing to next question.';
  }

  return (
    <div
      role="alert"
      className="animate-fade-in"
      style={{
        width: '100%',
        padding: '14px 16px',
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        borderRadius: 'var(--radius-md)',
        marginTop: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        boxShadow: 'var(--shadow-card)'
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          fontSize: '15px',
          color: textColor,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '13px',
          color: textColor,
          opacity: 0.95
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}
