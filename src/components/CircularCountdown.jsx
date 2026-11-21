import React from 'react';

export default function CircularCountdown({ remainingMs = 10000, totalMs = 10000, size = 164 }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs));

  const strokeWidth = size >= 200 ? 10 : 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress * circumference);

  const numberFontSize = size >= 200 ? '80px' : '64px';
  const labelFontSize = size >= 200 ? '12px' : '10px';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '10px 0'
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background track circle matching Figma #DECDB1 / #CFC2A8 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#DECDB1"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Active progress ring in #890100 Burgundy */}
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
              fontWeight: 600,
              fontSize: numberFontSize,
              lineHeight: 1,
              color: 'var(--color-burgundy)'
            }}
          >
            {seconds}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: labelFontSize,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-burgundy)',
              marginTop: '4px'
            }}
          >
            SECONDS
          </span>
        </div>
      </div>
    </div>
  );
}
