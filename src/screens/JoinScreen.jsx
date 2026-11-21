import React, { useState } from 'react';
import Header from '../components/Header';
import { useAudioEngine } from '../hooks/useAudioEngine';

export default function JoinScreen({ onJoin, isLateJoin = false }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { initAudio, playUiClick } = useAudioEngine();

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('Please enter a nickname to proceed.');
      return;
    }
    if (trimmed.length > 20) {
      setError('Nickname must be 20 characters or fewer.');
      return;
    }

    initAudio();
    playUiClick();
    setIsSubmitting(true);
    onJoin(trimmed);
  };

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
      <Header mode="case" label="CASE FILE / 2026" statusTag="01 / JOIN" />

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
        {isLateJoin ? (
          /* Late Join Locked Message */
          <div
            className="paper-card animate-fade-in"
            style={{
              padding: 'clamp(32px, 5vw, 56px)',
              maxWidth: '560px',
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <img
              src="/images/detective-accent.svg"
              alt="Magnifying glass"
              style={{ width: '56px', height: '56px', marginBottom: '8px' }}
            />
            <span className="label-uppercase" style={{ color: 'var(--color-burgundy)' }}>
              INVESTIGATION IN PROGRESS
            </span>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 34px)', color: 'var(--color-burgundy)' }}>
              The investigation has begun.
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--color-black)',
                lineHeight: 1.5,
                marginTop: '4px'
              }}
            >
              Watch the screen.
            </p>
          </div>
        ) : (
          /* Normal Join Split Layout (Desktop side-by-side, Mobile stacked) */
          <div
            style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
              gap: 'clamp(32px, 6vw, 80px)',
              alignItems: 'center'
            }}
          >
            {/* Left Identity Column */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img
                  src="/images/detective-accent.svg"
                  alt="Canva detective magnifying glass"
                  style={{ width: '56px', height: '56px' }}
                />
                <span className="label-uppercase">THE CASE IS OPEN</span>
              </div>

              {/* Major Heading strictly #890100 */}
              <h1
                style={{
                  fontSize: 'clamp(40px, 6vw, 76px)',
                  lineHeight: 1.05,
                  color: 'var(--color-burgundy)'
                }}
              >
                Canva on<br />Trial 2026
              </h1>

              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'clamp(16px, 2.2vw, 22px)',
                  color: 'var(--color-black)',
                  lineHeight: 1.4,
                  fontWeight: 400
                }}
              >
                The Case of the Creative Revolution
              </p>
            </div>

            {/* Right Registration Card */}
            <div
              className="paper-card animate-fade-in"
              style={{
                padding: 'clamp(24px, 4vw, 40px)',
                width: '100%',
                maxWidth: '540px',
                margin: '0 auto'
              }}
            >
              <span className="label-uppercase" style={{ marginBottom: '8px', display: 'block' }}>
                INVESTIGATOR REGISTRATION
              </span>

              {/* Major Heading strictly #890100 */}
              <h2
                style={{
                  fontSize: 'clamp(26px, 3.5vw, 34px)',
                  color: 'var(--color-burgundy)',
                  marginBottom: '8px'
                }}
              >
                Join the<br />Investigation!
              </h2>

              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--color-black)',
                  marginBottom: '24px'
                }}
              >
                Enter a nickname to become an official investigator.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label
                    htmlFor="nickname-input"
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--color-black)',
                      marginBottom: '8px'
                    }}
                  >
                    Nickname
                  </label>
                  <input
                    id="nickname-input"
                    type="text"
                    placeholder="Your nickname"
                    value={nickname}
                    onChange={(e) => {
                      setNickname(e.target.value);
                      if (error) setError('');
                    }}
                    maxLength={20}
                    autoComplete="off"
                    autoFocus
                    style={{
                      width: '100%',
                      height: '56px',
                      padding: '0 16px',
                      backgroundColor: '#FFFFFF',
                      border: error ? '1px solid var(--color-burgundy)' : '1px solid var(--border-parchment-dark)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '16px',
                      color: 'var(--color-black)'
                    }}
                  />
                  {error && (
                    <span style={{ fontSize: '12px', color: 'var(--color-burgundy)', marginTop: '4px', display: 'block' }}>
                      {error}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    height: '56px',
                    backgroundColor: 'var(--color-burgundy)',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '16px',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    boxShadow: '0 4px 12px rgba(137, 1, 0, 0.28)',
                    transition: 'background-color var(--transition-fast), transform var(--transition-fast)',
                    opacity: isSubmitting ? 0.8 : 1
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-burgundy-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-burgundy)')}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {isSubmitting ? 'Registering...' : 'Join the Investigation'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer Tagline */}
      <footer style={{ width: '100%', textAlign: 'center', paddingTop: '24px' }}>
        <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)' }}>
          The investigation starts with you.
        </p>
      </footer>
    </div>
  );
}
