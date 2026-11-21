import React, { useEffect, useRef } from 'react';
import Header from '../components/Header';
import { useAudioEngine } from '../hooks/useAudioEngine';

export default function LeaderboardScreen({
  leaderboardData = [],
  currentPlayerName = '',
  currentPlayerScore = 0,
  currentPlayerRowIndex = null,
  isProjectorView = false,
  isFinalising = false
}) {
  const { playWinnerReveal } = useAudioEngine();
  const audioTriggeredRef = useRef(false);

  // Play winner-reveal fanfare once on initial appearance
  useEffect(() => {
    if (!audioTriggeredRef.current) {
      audioTriggeredRef.current = true;
      playWinnerReveal();
    }
  }, [playWinnerReveal]);

  // 1. Authoritative leaderboard list directly from backend data (NEVER inject or mutate locally)
  let list = Array.isArray(leaderboardData) && leaderboardData.length > 0 ? [...leaderboardData] : [];

  // Sort descending by score; tiebreaker: earlier registration timestamp wins
  list.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeA - timeB;
  });

  // 2. Identify the player's personal result strictly by their assigned rowIndex
  const isCurrentPlayer = (investigator) => {
    if (isProjectorView || !currentPlayerName || !investigator) return false;
    if (currentPlayerRowIndex && investigator.rowIndex) {
      return investigator.rowIndex === currentPlayerRowIndex;
    }
    return !currentPlayerRowIndex && String(investigator.name).toLowerCase() === currentPlayerName.toLowerCase();
  };

  const myRecord = (!isProjectorView && currentPlayerRowIndex)
    ? list.find((p) => p.rowIndex === currentPlayerRowIndex)
    : null;

  // Calculate actual global rank from the complete authoritative player list
  const myRankIndex = currentPlayerName
    ? list.findIndex((p) => isCurrentPlayer(p))
    : -1;
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : null;

  // Displayed score is authoritative from backend (or currentPlayerScore as local reference)
  const displayScore = myRecord && myRecord.hasScore
    ? myRecord.score
    : currentPlayerScore;

  // Podium positions (1st, 2nd, 3rd)
  const firstPlace = list[0] || { name: '—', score: 0 };
  const secondPlace = list[1] || { name: '—', score: 0 };
  const thirdPlace = list[2] || { name: '—', score: 0 };
  const runnersUp = list.slice(3, 10);

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
      <Header mode="case" label="CASE FILE / 2026" statusTag="05 / RESULTS" />

      {/* Main Content */}
      <main
        style={{
          width: '100%',
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(20px, 3.5vw, 32px)',
          flex: 1
        }}
      >
        {/* Title strictly matches Figma */}
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 56px)',
              color: 'var(--color-burgundy)', // Burgundy #890100
              lineHeight: 1.15
            }}
          >
            The Case Closers
          </h1>
          <p
            style={{
              color: 'var(--color-black)',
              fontSize: '15px',
              marginTop: '6px'
            }}
          >
            Final Results · Top Investigators
          </p>
          {isFinalising && (
            <span
              style={{
                display: 'inline-block',
                marginTop: '6px',
                fontSize: '12px',
                color: 'var(--color-burgundy)',
                fontStyle: 'italic'
              }}
            >
              Tallying final evidence across all participants...
            </span>
          )}
        </div>

        {/* Player Personal Results Card: displayed on player device */}
        {!isProjectorView && currentPlayerName && (
          <div
            className="paper-card animate-fade-in"
            style={{
              width: '100%',
              padding: 'clamp(16px, 3vw, 24px)',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderLeft: '4px solid var(--color-burgundy)',
              backgroundColor: '#FFFBF3',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: '0 2px 8px rgba(64, 43, 20, 0.08)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="label-uppercase" style={{ color: 'var(--color-burgundy)', fontSize: '11px' }}>
                YOUR OFFICIAL CASE REPORT
              </span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--color-black)', margin: 0 }}>
                Investigator {currentPlayerName}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, 4vw, 32px)' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>
                  Final Score
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--color-burgundy)' }}>
                  {displayScore.toLocaleString()}
                </span>
              </div>

              <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-parchment-dark)', paddingLeft: 'clamp(16px, 4vw, 32px)' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>
                  Overall Standing
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--color-black)' }}>
                  {myRank ? `Rank #${myRank}` : '—'}
                  {list.length > 0 && (
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-ink-muted)', marginLeft: '4px' }}>
                      of {list.length}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Top 3 Global Podium (2nd - 1st - 3rd) */}
        <div
          style={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1.15fr 1fr',
            gap: 'clamp(8px, 2.5vw, 24px)',
            alignItems: 'end',
            margin: '8px 0 16px 0'
          }}
        >
          {/* 2nd Place Pedestal */}
          <div
            className="paper-card animate-fade-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 'clamp(14px, 2.5vw, 24px) 12px',
              borderTop: '3px solid var(--color-silver)',
              textAlign: 'center'
            }}
          >
            <img src="/images/crown-silver.svg" alt="Silver Crown" style={{ width: '28px', height: '21px', marginBottom: '6px' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-silver)' }}>2nd</span>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                fontSize: 'clamp(15px, 2vw, 20px)',
                marginTop: '4px',
                color: 'var(--color-black)',
                wordBreak: 'break-word'
              }}
            >
              {secondPlace.name}
              {isCurrentPlayer(secondPlace) && (
                <span style={{ fontSize: '12px', color: 'var(--color-burgundy)', marginLeft: '4px', display: 'block' }}>(You)</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '16px', color: 'var(--color-burgundy)', marginTop: '4px' }}>
              {secondPlace.score.toLocaleString()}
            </div>
          </div>

          {/* 1st Place Pedestal (Center, Elevated) */}
          <div
            className="paper-card animate-fade-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 'clamp(20px, 3.5vw, 32px) 16px',
              borderTop: '4px solid var(--color-gold)',
              textAlign: 'center',
              transform: 'translateY(-8px)',
              position: 'relative'
            }}
          >
            <img src="/images/crown-gold.svg" alt="Gold Crown" style={{ width: '36px', height: '27px', marginBottom: '8px' }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-gold)', letterSpacing: '0.08em' }}>1st</span>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 700,
                fontSize: 'clamp(18px, 2.8vw, 24px)',
                marginTop: '6px',
                color: 'var(--color-black)',
                wordBreak: 'break-word'
              }}
            >
              {firstPlace.name}
              {isCurrentPlayer(firstPlace) && (
                <span style={{ fontSize: '13px', color: 'var(--color-burgundy)', marginLeft: '4px', display: 'block' }}>(You)</span>
              )}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 700,
                fontSize: 'clamp(18px, 2.5vw, 22px)',
                color: 'var(--color-burgundy)',
                marginTop: '4px'
              }}
            >
              {firstPlace.score.toLocaleString()}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--color-gold)',
                textTransform: 'uppercase',
                marginTop: '8px',
                padding: '4px 8px',
                backgroundColor: 'rgba(184, 137, 39, 0.1)',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              Chief Creative Investigator
            </div>
          </div>

          {/* 3rd Place Pedestal */}
          <div
            className="paper-card animate-fade-in"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 'clamp(14px, 2.5vw, 24px) 12px',
              borderTop: '3px solid var(--color-bronze)',
              textAlign: 'center'
            }}
          >
            <img src="/images/crown-bronze.svg" alt="Bronze Crown" style={{ width: '28px', height: '21px', marginBottom: '6px' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-bronze)' }}>3rd</span>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                fontSize: 'clamp(15px, 2vw, 20px)',
                marginTop: '4px',
                color: 'var(--color-black)',
                wordBreak: 'break-word'
              }}
            >
              {thirdPlace.name}
              {isCurrentPlayer(thirdPlace) && (
                <span style={{ fontSize: '12px', color: 'var(--color-burgundy)', marginLeft: '4px', display: 'block' }}>(You)</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '16px', color: 'var(--color-burgundy)', marginTop: '4px' }}>
              {thirdPlace.score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Global Rankings Table (Ranks 4 through 10) */}
        <div
          className="paper-card animate-fade-in"
          style={{
            width: '100%',
            padding: '16px clamp(16px, 3vw, 28px)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr 100px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--border-parchment)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-muted)'
            }}
          >
            <span>#</span>
            <span>Investigator</span>
            <span style={{ textAlign: 'right' }}>Score</span>
          </div>

          {/* Table Rows */}
          {runnersUp.map((investigator, idx) => {
            const rank = idx + 4;
            const isMe = isCurrentPlayer(investigator);

            return (
              <div
                key={investigator.rowIndex ? `row-${investigator.rowIndex}` : investigator.id || rank}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 100px',
                  padding: '12px 0',
                  borderBottom: idx < runnersUp.length - 1 ? '1px solid var(--border-light)' : 'none',
                  fontSize: '14px',
                  fontWeight: isMe ? 700 : 500,
                  color: isMe ? 'var(--color-burgundy)' : 'var(--color-black)',
                  backgroundColor: isMe ? 'rgba(137, 1, 0, 0.05)' : 'transparent',
                  alignItems: 'center'
                }}
              >
                <span style={{ color: 'var(--color-ink-muted)', fontFamily: 'monospace' }}>
                  {String(rank).padStart(2, '0')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {investigator.name}
                  {isMe && <span style={{ fontSize: '11px', color: 'var(--color-burgundy)' }}>(You)</span>}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>
                  {investigator.score.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </main>

      {/* Thank-You Footer matching Figma */}
      <footer style={{ width: '100%', textAlign: 'center', paddingTop: '24px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)' }}>
          Thank you for joining the investigation.
        </p>
      </footer>
    </div>
  );
}
