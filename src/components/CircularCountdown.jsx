import React from 'react';

export default function CircularCountdown({ remainingMs = 10000, totalMs = 10000 }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs));

  const size = 150;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        margin: '20px 0'
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(107, 88, 68, 0.15)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Animated active countdown ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-burgundy)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.1s linear'
            }}
          />
        </svg>

        {/* Center Countdown Number */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '54px',
              lineHeight: 1,
              color: 'var(--color-burgundy)'
            }}
          >
            {seconds}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-muted)',
              marginTop: '4px'
            }}
          >
            SECONDS
          </span>
        </div>
      </div>

      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--color-burgundy)',
          textAlign: 'center'
        }}
      >
        Prepare your case. Question 1 begins shortly.
      </p>
    </div>
  );
}
