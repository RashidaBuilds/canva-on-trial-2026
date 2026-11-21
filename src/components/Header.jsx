import React from 'react';
import EvidenceLabel from './EvidenceLabel';

export default function Header({
  mode = 'case', // 'case' | 'quiz'
  label = 'CASE FILE / 2026',
  statusTag = '01 / JOIN',
  score = 0,
  isDarkTheme = false
}) {
  return (
    <header
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 16px 0',
        borderBottom: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid var(--border-parchment)',
        marginBottom: '20px'
      }}
    >
      {mode === 'case' ? (
        <>
          <EvidenceLabel text={label} color={isDarkTheme ? 'light' : 'dark'} />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              color: isDarkTheme ? '#DECDB1' : 'var(--color-ink-muted)',
              textTransform: 'uppercase'
            }}
          >
            {statusTag}
          </span>
        </>
      ) : (
        <>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 600,
              fontSize: '16px',
              color: 'var(--color-burgundy)' // Burgundy
            }}
          >
            Canva on Trial 2026
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 12px',
              backgroundColor: 'var(--color-burgundy)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '0.04em',
              boxShadow: '0 2px 6px rgba(137, 1, 0, 0.25)'
            }}
          >
            {score} pts
          </div>
        </>
      )}
    </header>
  );
}
