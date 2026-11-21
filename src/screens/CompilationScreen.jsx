import React from 'react';
import Header from '../components/Header';

/**
 * CompilationScreen:
 * The bridge between the final question (Round 11 - Final Exhibit) and the authoritative Leaderboard.
 * 
 * Scheduled Duration: 8 seconds (from T=200s to T=208s)
 * Responsibilities:
 * 1. Gives background score submissions (staggered 0-1.5s + network time) the required window to land.
 * 2. Allows clients to poll and aggregate the complete set of scores from all participants.
 * 3. Provides dramatic narrative closure matching the Canva on Trial 2026 investigative theme.
 * 4. Displays personal evidence confirmation for players and case sealing progress for the projector.
 */
export default function CompilationScreen({
  remainingMs = 8000,
  totalDurationMs = 8000,
  playerName = '',
  playerScore = 0,
  isProjectorView = false,
  isSubmitted = true,
  totalPlayers = 0,
  scoresSubmitted = 0,
  scoresPending = 0,
  allScoresSubmitted = false
}) {
  const secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));
  const progressRatio = totalPlayers > 0
    ? Math.min(1, Math.max(0, scoresSubmitted / totalPlayers))
    : Math.min(1, Math.max(0, 1 - remainingMs / totalDurationMs));

  return (
    <div
      className="paper-texture-bg"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'clamp(20px, 4vw, 48px) clamp(16px, 6vw, 80px)'
      }}
    >
      {/* Top Header */}
      <Header
        mode="case"
        label="CASE FILE / 2026"
        statusTag={isProjectorView ? '04 / OFFICIAL TALLY' : '04 / COMPILATION'}
      />

      {/* Main Content Area */}
      <main
        style={{
          width: '100%',
          maxWidth: '780px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: 'clamp(20px, 4vw, 36px)',
          textAlign: 'center'
        }}
      >
        {/* Title Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <span
            className="label-uppercase"
            style={{
              color: 'var(--color-burgundy)',
              fontSize: '12px',
              letterSpacing: '0.12em'
            }}
          >
            {isProjectorView ? 'EXHIBITS CONCLUDED · OFFICIAL DELIBERATION' : 'ALL 11 EXHIBITS RECORDED'}
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(32px, 5.5vw, 52px)',
              fontWeight: 600,
              color: 'var(--color-burgundy)',
              lineHeight: 1.15,
              margin: 0
            }}
          >
            {isProjectorView ? 'Sealing Case Evidence' : 'Compiling the Evidence'}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(14px, 2vw, 16px)',
              color: 'var(--color-ink-muted)',
              maxWidth: '560px',
              margin: '4px 0 0 0',
              lineHeight: 1.5
            }}
          >
            {isProjectorView
              ? 'Collecting and tallying submitted scores from all active field investigators across the room...'
              : 'Cross-referencing witness testimony, timestamps, and answer submissions against the official case record...'}
          </p>
        </div>

        {/* Central Parchment Compilation Card */}
        <div
          className="paper-card animate-fade-in"
          style={{
            width: '100%',
            backgroundColor: '#FFFBF3',
            border: '1px solid var(--border-parchment-dark)',
            borderRadius: 'var(--radius-lg)',
            padding: 'clamp(24px, 4vw, 40px)',
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px'
          }}
        >
          {/* Animated Detective Icon */}
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-cream)',
              border: '1px solid var(--border-parchment-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(137, 1, 0, 0.08)'
            }}
          >
            <img
              src="/images/detective-accent.svg"
              alt="Detective icon"
              style={{
                width: '38px',
                height: '38px',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))'
              }}
            />
            {/* Subtle rotating radar border */}
            <div
              style={{
                position: 'absolute',
                inset: '-4px',
                borderRadius: '50%',
                border: '2px dashed var(--color-burgundy)',
                opacity: 0.4,
                animation: 'spin 12s linear infinite'
              }}
            />
          </div>

          {/* Personal Submission Badge (Player View Only) */}
          {!isProjectorView && playerName && (
            <div
              style={{
                width: '100%',
                backgroundColor: 'rgba(239, 227, 208, 0.45)',
                border: '1px solid var(--border-parchment)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--color-ink-subtle)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 600
                  }}
                >
                  FIELD INVESTIGATOR
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--color-black)'
                  }}
                >
                  {playerName}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--color-ink-subtle)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 600
                  }}
                >
                  POINTS SUBMITTED
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--color-burgundy)'
                  }}
                >
                  {playerScore.toLocaleString()} pts
                </span>
              </div>
            </div>
          )}

          {/* Submission Status Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: isSubmitted ? 'var(--color-correct-bg)' : '#FFF0CD',
              border: `1px solid ${isSubmitted ? 'var(--color-correct-border)' : '#D8A600'}`,
              color: isSubmitted ? 'var(--color-correct-text)' : '#6B5844',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.02em'
            }}
          >
            <span>{isSubmitted ? '✓' : '●'}</span>
            <span>
              {isSubmitted
                ? totalPlayers > 0
                  ? `Evidence Recorded (${scoresSubmitted} of ${totalPlayers} filed)`
                  : 'Scores Dispatched · Awaiting Final Courtroom Standings'
                : 'Securing connection to official registry...'}
            </span>
          </div>

          {/* Progress Bar & Synchronized Reveal Countdown */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--bg-cream)',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid var(--border-parchment)'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressRatio * 100}%`,
                  backgroundColor: 'var(--color-burgundy)',
                  borderRadius: '4px',
                  transition: 'width 0.2s linear'
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                color: 'var(--color-ink-muted)',
                fontFamily: 'var(--font-sans)'
              }}
            >
              <span>
                {totalPlayers > 0 && scoresPending > 0
                  ? `Awaiting ${scoresPending} pending report${scoresPending > 1 ? 's' : ''}...`
                  : totalPlayers > 0 && allScoresSubmitted
                    ? 'All reports confirmed · Finalising verdict...'
                    : 'Authenticating case files'}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--color-black)' }}>
                {allScoresSubmitted
                  ? 'All scores submitted'
                  : `Tallying: ${scoresSubmitted}/${totalPlayers || 1}`}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--color-ink-subtle)',
          fontFamily: 'var(--font-sans)'
        }}
      >
        Canva on Trial 2026: The Case of the Creative Revolution
      </footer>

      {/* Embedded CSS for keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
