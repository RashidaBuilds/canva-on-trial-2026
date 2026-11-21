import React, { useEffect, useRef } from 'react';
import Header from '../components/Header';
import CircularCountdown from '../components/CircularCountdown';
import { useAudioEngine } from '../hooks/useAudioEngine';

export default function LobbyScreen({
  isGetReady = false,
  remainingMs = 90000,
  investigators = [],
  nickname = ''
}) {
  const { startLobbyAmbience, stopLobbyAmbience, playQuestionTick } = useAudioEngine();
  const getReadyAudioFiredRef = useRef(false);

  // Manage lobby audio based on state
  useEffect(() => {
    if (!isGetReady) {
      startLobbyAmbience();
    } else {
      stopLobbyAmbience();
      if (!getReadyAudioFiredRef.current) {
        getReadyAudioFiredRef.current = true;
        playQuestionTick();
      }
    }

    return () => {
      stopLobbyAmbience();
    };
  }, [isGetReady, startLobbyAmbience, stopLobbyAmbience, playQuestionTick]);

  // Compute countdown minutes and seconds
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Roster display: printed directly on parchment paper, no pills or chips
  const displayLimit = 10;
  const visibleNames = investigators.slice(0, displayLimit);
  const overflowCount = Math.max(0, investigators.length - displayLimit);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'clamp(20px, 4vw, 48px) clamp(16px, 6vw, 80px)',
        backgroundColor: isGetReady ? 'var(--bg-cream)' : '#1A0E0E',
        backgroundImage: isGetReady
          ? "linear-gradient(rgba(248, 242, 231, 0.94), rgba(248, 242, 231, 0.94)), url('/images/paper-texture.png')"
          : "radial-gradient(ellipse at 50% 25%, #2D1414 0%, #150909 100%)",
        backgroundSize: 'cover',
        color: isGetReady ? 'var(--color-black)' : '#FAF6ED',
        transition: 'background-color 0.5s ease, color 0.5s ease'
      }}
    >
      {/* Header */}
      <Header
        mode="case"
        label="CASE FILE / 2026"
        statusTag="02 / LOBBY"
        isDarkTheme={!isGetReady}
      />

      {/* Main Content */}
      <main
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1
        }}
      >
        {isGetReady ? (
          /* Final 10-Second Get Ready State */
          <div
            className="animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '600px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <span
              className="label-uppercase"
              style={{ color: 'var(--color-burgundy)', letterSpacing: '0.18em' }}
            >
              FINAL 10 SECONDS · GET READY
            </span>

            <h1
              style={{
                fontSize: 'clamp(32px, 5vw, 54px)',
                color: 'var(--color-burgundy)',
                lineHeight: 1.1
              }}
            >
              The Investigation Begins
            </h1>

            <p style={{ color: 'var(--color-black)', fontSize: '16px' }}>
              The case files are opening soon.
            </p>

            <CircularCountdown remainingMs={remainingMs} totalMs={10000} />
          </div>
        ) : (
          /* Normal Lobby State (First 80 Seconds) */
          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
              gap: 'clamp(32px, 6vw, 64px)',
              alignItems: 'center'
            }}
          >
            {/* Left Countdown & Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src="/images/detective-accent.svg"
                  alt="Badge"
                  style={{ width: '48px', height: '48px' }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    color: '#DECDB1',
                    textTransform: 'uppercase'
                  }}
                >
                  THE INVESTIGATION ASSEMBLES
                </span>
              </div>

              <h1
                style={{
                  fontSize: 'clamp(36px, 5vw, 64px)',
                  lineHeight: 1.1,
                  color: '#FAF6ED'
                }}
              >
                The Investigation<br />Begins
              </h1>

              <p style={{ fontSize: '16px', color: '#DECDB1', lineHeight: 1.5 }}>
                The case files are opening soon.
              </p>

              {/* Large Digital Countdown */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '24px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(222, 205, 177, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px'
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    color: '#DECDB1',
                    textTransform: 'uppercase'
                  }}
                >
                  GAME STARTS IN
                </span>

                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 700,
                    fontSize: 'clamp(52px, 7vw, 76px)',
                    color: '#FFFFFF',
                    lineHeight: 1.05,
                    letterSpacing: '-0.02em'
                  }}
                >
                  {formattedTime}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '40px',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    color: '#DECDB1',
                    textTransform: 'uppercase',
                    marginTop: '2px'
                  }}
                >
                  <span>MINUTES</span>
                  <span style={{ marginLeft: '12px' }}>SECONDS</span>
                </div>
              </div>
            </div>

            {/* Right Roster Card (Printed directly on parchment, no pills/chips) */}
            <div
              className="paper-card animate-fade-in"
              style={{
                padding: 'clamp(24px, 4vw, 36px)',
                width: '100%',
                maxWidth: '540px',
                margin: '0 auto',
                backgroundColor: 'var(--bg-parchment-card)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  borderBottom: '1px solid var(--border-parchment)',
                  paddingBottom: '12px',
                  marginBottom: '16px'
                }}
              >
                <span className="label-uppercase">OFFICIAL ROSTER</span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--color-burgundy)'
                  }}
                >
                  {investigators.length} Investigators Joined
                </span>
              </div>

              {/* Names printed directly on parchment paper without pills/chips */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px 16px',
                  marginBottom: '16px'
                }}
              >
                {visibleNames.map((name, idx) => {
                  const isCurrentPlayer = name.toLowerCase() === nickname.toLowerCase();
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '14px',
                        fontWeight: isCurrentPlayer ? 700 : 500,
                        color: isCurrentPlayer ? 'var(--color-burgundy)' : 'var(--color-black)'
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--color-ink-muted)',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}
                      >
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span>{name}</span>
                      {isCurrentPlayer && (
                        <span style={{ fontSize: '11px', color: 'var(--color-burgundy)', fontWeight: 700 }}>
                          (You)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Overflow Count */}
              {overflowCount > 0 && (
                <div
                  style={{
                    borderTop: '1px dashed var(--border-parchment)',
                    paddingTop: '12px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-ink-muted)'
                  }}
                >
                  +{overflowCount} more
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ width: '100%', textAlign: 'center', paddingTop: '24px' }}>
        <p
          style={{
            fontSize: '13px',
            color: isGetReady ? 'var(--color-ink-muted)' : '#DECDB1'
          }}
        >
          Waiting for the investigation to begin.
        </p>
      </footer>
    </div>
  );
}
