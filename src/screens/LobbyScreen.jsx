import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import CircularCountdown from '../components/CircularCountdown';
import { useAudioEngine } from '../hooks/useAudioEngine';

export default function LobbyScreen({
  isGetReady = false,
  remainingMs = 90000,
  investigators = [],
  nickname = ''
}) {
  const { playQuestionTick } = useAudioEngine();
  const getReadyAudioFiredRef = useRef(false);

  // Responsive breakpoint tracking: Desktop (>= 900px) vs Mobile (< 900px)
  const [isDesktop, setIsDesktop] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 900 : true;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Audio sequence:
  // Normal lobby waiting (0s-80s) is completely silent.
  // Final 10 seconds of lobby (Get Ready: 80s-90s) plays question-tick.mp3 once.
  useEffect(() => {
    if (isGetReady && !getReadyAudioFiredRef.current) {
      getReadyAudioFiredRef.current = true;
      playQuestionTick();
    }
  }, [isGetReady, playQuestionTick]);

  // Compute countdown minutes and seconds for the normal lobby
  // Note: During the normal lobby (first 80s of 90s), the timer counts down from 01:30 to 00:10
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Dynamic Investigator Roster calculation per Figma specs:
  // - Desktop (19:821): 18 visible names, 3 columns x 6 rows
  // - Mobile (19:785): 6 visible names, 2 columns x 3 rows
  const capacity = isDesktop ? 18 : 6;
  const totalCount = investigators.length;
  const visibleNames = investigators.slice(0, capacity);
  const overflowCount = Math.max(0, totalCount - visibleNames.length);

  // Format heading strictly per specification: "72 Investigators Joined"
  const rosterHeading = `${totalCount} Investigator${totalCount === 1 ? '' : 's'} Joined`;

  // Render the Investigator Roster Card (used in both normal lobby and Get Ready)
  const renderRosterCard = () => (
    <div
      className="roster-card animate-fade-in"
      style={{
        width: '100%',
        maxWidth: isDesktop ? '608px' : '390px',
        padding: isDesktop ? '24px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: isDesktop ? '12px' : '8px'
      }}
    >
      {/* Roster Title */}
      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 600,
          fontSize: isDesktop ? '28px' : '22px',
          lineHeight: isDesktop ? '36px' : '28px',
          color: 'var(--color-burgundy)',
          textAlign: 'left'
        }}
      >
        {rosterHeading}
      </h2>

      {/* Grid of Small Paper Name Strips */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
          gap: isDesktop ? '8px 6px' : '4px 8px',
          alignItems: 'center',
          width: '100%'
        }}
      >
        {visibleNames.map((name, idx) => {
          // Alternates between authentic Figma paper strip fills
          const bgImage = idx % 2 === 0
            ? "url('/images/name-strip-1.png')"
            : "url('/images/name-strip-2.png')";
          const isMe = nickname && name.toLowerCase() === nickname.toLowerCase();

          return (
            <div
              key={`${name}-${idx}`}
              style={{
                height: isDesktop ? '34px' : '30px',
                padding: '0 10px',
                backgroundImage: bgImage,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                boxShadow: '0px 1px 1px 0px rgba(64, 43, 20, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-sans)',
                fontSize: isDesktop ? '14px' : '13px',
                fontWeight: isMe ? 700 : 400,
                color: isMe ? 'var(--color-burgundy)' : 'var(--color-black)'
              }}
              title={name}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
                {isMe && <span style={{ fontSize: '11px', marginLeft: '4px', color: 'var(--color-burgundy)' }}>(You)</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Dynamic Overflow Indicator: only shown when totalCount > capacity */}
      {overflowCount > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
          <div
            style={{
              width: isDesktop ? '126px' : '110px',
              height: isDesktop ? '30px' : '28px',
              backgroundImage: "url('/images/name-strip-2.png')",
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              boxShadow: '0px 1px 1px 0px rgba(64, 43, 20, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: isDesktop ? '14px' : '12px',
              fontWeight: 500,
              color: 'var(--color-black)'
            }}
          >
            +{overflowCount} more
          </div>
        </div>
      ) : (
        /* Empty placeholder spacing if no overflow to keep alignment stable */
        <div style={{ height: isDesktop ? '30px' : '28px' }} />
      )}
    </div>
  );

  return (
    <div
      className="paper-texture-bg"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: isDesktop ? '48px 80px 40px' : '24px 16px'
      }}
    >
      {/* Top Header */}
      <Header mode="case" label="CASE FILE / 2026" statusTag="02 / LOBBY" />

      {/* Main Content Area */}
      <main
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1
        }}
      >
        {isGetReady ? (
          /* ============================================================
           * STATE 2: GET READY (Final 10 seconds: 80s to 90s)
           * Keeps the identical light cream #F8F2E7 textured background.
           * Preserves the roster and main lobby composition.
           * ============================================================ */
          isDesktop ? (
            /* Desktop Get Ready Composition (Figma 19:1011) */
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '96px'
              }}
            >
              {/* Left Column: Heading + Circular Countdown */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '32px',
                  flex: 1
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h1
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '64px',
                      lineHeight: '72px',
                      color: 'var(--color-burgundy)',
                      textAlign: 'left'
                    }}
                  >
                    The Investigation<br />Begins
                  </h1>
                  <p
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '16px',
                      lineHeight: '24px',
                      color: '#1F1A14',
                      textAlign: 'left'
                    }}
                  >
                    The case files are opening soon.
                  </p>
                </div>

                {/* Circular Countdown Unit */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '16px',
                      fontWeight: 500,
                      color: '#1F1A14'
                    }}
                  >
                    Game starts in
                  </span>
                  <CircularCountdown remainingMs={remainingMs} totalMs={10000} size={208} />
                </div>
              </div>

              {/* Right Column: Investigator Roster (Desktop capacity: 18) */}
              {renderRosterCard()}
            </div>
          ) : (
            /* Mobile Get Ready Composition (Figma 19:945) */
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
                textAlign: 'center'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h1
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '36px',
                    lineHeight: '42px',
                    color: 'var(--color-burgundy)'
                  }}
                >
                  The Investigation<br />Begins
                </h1>
                <p
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '16px',
                    lineHeight: '24px',
                    color: '#1F1A14'
                  }}
                >
                  The case files are opening soon.
                </p>
              </div>

              {/* Circular Countdown Unit */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '16px',
                    fontWeight: 500,
                    color: '#1F1A14'
                  }}
                >
                  Game starts in
                </span>
                <CircularCountdown remainingMs={remainingMs} totalMs={10000} size={164} />
              </div>

              {/* Investigator Roster (Mobile capacity: 6) */}
              {renderRosterCard()}
            </div>
          )
        ) : (
          /* ============================================================
           * STATE 1: NORMAL LOBBY (First 80 seconds: 0s to 80s)
           * Light cream #F8F2E7 background + 29% paper texture.
           * ============================================================ */
          isDesktop ? (
            /* Desktop Normal Lobby Composition (Figma 19:1010) */
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '96px'
              }}
            >
              {/* Left Column: Heading + Countdown Card */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '32px',
                  flex: 1
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h1
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '64px',
                      lineHeight: '72px',
                      color: 'var(--color-burgundy)',
                      textAlign: 'left'
                    }}
                  >
                    The Investigation<br />Begins
                  </h1>
                  <p
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '16px',
                      lineHeight: '24px',
                      color: '#1F1A14',
                      textAlign: 'left'
                    }}
                  >
                    The case files are opening soon.
                  </p>
                </div>

                {/* Countdown Card (Figma 19:761) */}
                <div
                  className="countdown-card"
                  style={{
                    width: '400px',
                    height: '212px',
                    padding: '24px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.1273em',
                      color: 'var(--color-burgundy)',
                      textAlign: 'center',
                      textTransform: 'uppercase'
                    }}
                  >
                    GAME STARTS IN
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '132px',
                      gap: '2px'
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 600,
                        fontSize: '80px',
                        lineHeight: '92px',
                        color: 'var(--color-burgundy)',
                        textAlign: 'center'
                      }}
                    >
                      {formattedTime}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '256px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        fontWeight: 500,
                        letterSpacing: '0.1em',
                        color: '#615240',
                        textTransform: 'uppercase'
                      }}
                    >
                      <span style={{ textAlign: 'center', flex: 1 }}>MINUTES</span>
                      <span style={{ textAlign: 'center', flex: 1 }}>SECONDS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Investigator Roster (Desktop capacity: 18) */}
              {renderRosterCard()}
            </div>
          ) : (
            /* Mobile Normal Lobby Composition (Figma 19:944) */
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px'
              }}
            >
              {/* Heading */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
                <h1
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '36px',
                    lineHeight: '42px',
                    color: 'var(--color-burgundy)'
                  }}
                >
                  The Investigation<br />Begins
                </h1>
                <p
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '16px',
                    lineHeight: '24px',
                    color: '#1F1A14'
                  }}
                >
                  The case files are opening soon.
                </p>
              </div>

              {/* Countdown Card (Figma 19:753) */}
              <div
                className="countdown-card"
                style={{
                  width: '100%',
                  maxWidth: '390px',
                  height: '180px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.1273em',
                    color: 'var(--color-burgundy)',
                    textAlign: 'center',
                    textTransform: 'uppercase'
                  }}
                >
                  GAME STARTS IN
                </span>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '108px',
                    gap: '2px'
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 600,
                      fontSize: '64px',
                      lineHeight: '76px',
                      color: 'var(--color-burgundy)',
                      textAlign: 'center'
                    }}
                  >
                    {formattedTime}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      width: '208px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      fontWeight: 500,
                      letterSpacing: '0.11em',
                      color: '#615240',
                      textTransform: 'uppercase'
                    }}
                  >
                    <span style={{ textAlign: 'center', flex: 1 }}>MINUTES</span>
                    <span style={{ textAlign: 'center', flex: 1 }}>SECONDS</span>
                  </div>
                </div>
              </div>

              {/* Investigator Roster (Mobile capacity: 6) */}
              {renderRosterCard()}
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer style={{ width: '100%', textAlign: 'center', paddingTop: '24px' }}>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            lineHeight: '20px',
            color: '#1F1A14'
          }}
        >
          Waiting for the investigation to begin.
        </p>
      </footer>
    </div>
  );
}
