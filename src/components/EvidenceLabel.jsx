import React from 'react';

export default function EvidenceLabel({ text = "CASE FILE / 2026", color = "dark" }) {
  const isLight = color === "light";

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.12)' : 'rgba(107, 88, 68, 0.12)',
        border: `1px solid ${isLight ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-parchment)'}`,
        borderRadius: '3px',
        fontFamily: 'var(--font-sans)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: isLight ? '#FAF6ED' : 'var(--color-black)',
        whiteSpace: 'nowrap'
      }}
    >
      {text}
    </div>
  );
}
