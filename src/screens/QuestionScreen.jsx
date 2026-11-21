import React, { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import EvidenceLabel from '../components/EvidenceLabel';
import ProgressTrack from '../components/ProgressTrack';
import FeedbackBanner from '../components/FeedbackBanner';
import { useAudioEngine } from '../hooks/useAudioEngine';

export default function QuestionScreen({
  question,
  totalRounds = 11,
  score = 0,
  roundRemainingMs = 10000,
  roundElapsedMs = 0,
  onAnswerSubmit
}) {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(null); // 'correct' | 'incorrect' | 'expired' | null
  const [pointsAwarded, setPointsAwarded] = useState(0);

  const { playQuestionTick, playUiClick } = useAudioEngine();

  // Reset state on new question and trigger the ~9-second ticking audio
  useEffect(() => {
    setSelectedOptionIndex(null);
    setIsAnswerSubmitted(false);
    setFeedbackStatus(null);
    setPointsAwarded(0);

    playQuestionTick();
  }, [question.id, playQuestionTick]);

  // Step 1: Option Selection (Only highlights; does NOT reveal feedback or lock)
  const handleSelectOption = (index) => {
    if (isAnswerSubmitted || roundRemainingMs <= 0) return;
    playUiClick();
    setSelectedOptionIndex(index);
  };

  // Step 2: Explicit Submit Action
  const handleSubmitAnswer = () => {
    if (selectedOptionIndex === null || isAnswerSubmitted || roundRemainingMs <= 0) return;

    playUiClick();
    setIsAnswerSubmitted(true);

    const isCorrect = selectedOptionIndex === question.correctIndex;
    const isFinalExhibit = !!question.isFinalExhibit;

    let earned = 0;
    if (isCorrect) {
      const basePoints = isFinalExhibit ? 200 : 100;
      // Speed bonus: up to 30 points scaled by remaining milliseconds of the 10-second window
      const speedBonus = Math.round(30 * (Math.max(0, roundRemainingMs) / 10000));
      earned = basePoints + speedBonus;
      setPointsAwarded(earned);
      setFeedbackStatus('correct');
    } else {
      setFeedbackStatus('incorrect');
    }

    // Step 3: Inform parent to update running score immediately, but stay on screen for the rest of 10s
    onAnswerSubmit({
      questionId: question.id,
      selectedOptionIndex,
      isCorrect,
      pointsEarned: earned
    });
  };

  // Step 4: Time's Up handling at deadline
  useEffect(() => {
    if (roundRemainingMs <= 0 && !isAnswerSubmitted && !feedbackStatus) {
      setIsAnswerSubmitted(true);
      setFeedbackStatus('expired');
      onAnswerSubmit({
        questionId: question.id,
        selectedOptionIndex: null,
        isCorrect: false,
        pointsEarned: 0
      });
    }
  }, [roundRemainingMs, isAnswerSubmitted, feedbackStatus, question.id, onAnswerSubmit]);

  // Clue display rule: reveals at 5s elapsed (5000ms) ONLY IF answer has NOT been submitted
  const isClueVisible = roundElapsedMs >= 5000 && !isAnswerSubmitted && !!question.clue;

  const letterMarkers = ['A', 'B', 'C', 'D'];
  const hasSelection = selectedOptionIndex !== null;

  return (
    <div
      className="paper-texture-bg"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 'clamp(16px, 3.5vw, 40px) clamp(16px, 5vw, 80px)'
      }}
    >
      {/* Top Header with live player score */}
      <Header mode="quiz" score={score} />

      {/* Progress Track and Countdown */}
      <ProgressTrack
        currentRound={question.roundNumber}
        totalRounds={totalRounds}
        remainingMs={roundRemainingMs}
        isFinalExhibit={question.isFinalExhibit}
      />

      {/* Main Investigation Split Layout */}
      <main
        style={{
          width: '100%',
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 520px), 1fr))',
          gap: 'clamp(24px, 4vw, 48px)',
          alignItems: 'start',
          flex: 1
        }}
      >
        {/* Left Column: Evidence Question Paper */}
        <div
          className="paper-card animate-fade-in"
          style={{
            padding: 'clamp(24px, 4vw, 40px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <EvidenceLabel text={question.evidenceLabel} color="dark" />
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-pink)',
                letterSpacing: '0.1em'
              }}
            >
              CATEGORY {question.category}
            </span>
          </div>

          {/* Heading strictly in #890100 */}
          <h2
            style={{
              fontSize: 'clamp(24px, 3.5vw, 36px)',
              lineHeight: 1.25,
              color: 'var(--color-burgundy)'
            }}
          >
            {question.prompt}
          </h2>

          <p style={{ fontSize: '14px', color: 'var(--color-black)' }}>
            Choose one answer to build your case.
          </p>

          {/* Clue Banner (Revealed at 5s only if player has not yet submitted an answer) */}
          {isClueVisible && (
            <div
              className="animate-fade-in"
              style={{
                backgroundColor: 'var(--color-clue-bg)',
                border: '1px solid var(--color-clue-border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-gold)',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase'
                }}
              >
                CLUE UNCOVERED
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-black)',
                  lineHeight: 1.4
                }}
              >
                {question.clue}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: 4 Answer Options + Submit Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '0 4px',
              marginBottom: '4px'
            }}
          >
            <span className="label-uppercase">
              {isAnswerSubmitted ? 'EVIDENCE RECORD LOCKED' : 'CHOOSE ONE ANSWER'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              {isAnswerSubmitted ? 'Awaiting next exhibit' : `${letterMarkers.length} choices available`}
            </span>
          </div>

          {/* Answer Option Buttons */}
          {question.options.map((optionText, idx) => {
            const letter = letterMarkers[idx];
            const isSelected = selectedOptionIndex === idx;

            // Highlight styling rules
            let borderColor = 'var(--border-parchment)';
            let bgColor = 'var(--bg-parchment-card)';
            let statusBadge = null;

            if (isSelected) {
              if (isAnswerSubmitted) {
                if (feedbackStatus === 'correct') {
                  borderColor = 'var(--color-correct-border)';
                  bgColor = 'var(--color-correct-bg)';
                  statusBadge = '✓ Correct';
                } else if (feedbackStatus === 'incorrect') {
                  borderColor = 'var(--color-incorrect-border)';
                  bgColor = 'var(--color-incorrect-bg)';
                  statusBadge = '× Selected';
                }
              } else {
                // Selected but not yet submitted
                borderColor = 'var(--color-burgundy)';
                bgColor = 'rgba(137, 1, 0, 0.05)';
                statusBadge = 'Selected';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={isAnswerSubmitted}
                onClick={() => handleSelectOption(idx)}
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '12px 18px',
                  backgroundColor: bgColor,
                  backgroundImage: "url('/images/paper-texture.png')",
                  backgroundSize: 'cover',
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  textAlign: 'left',
                  cursor: isAnswerSubmitted ? 'default' : 'pointer',
                  boxShadow: isSelected ? '0 2px 8px rgba(107, 88, 68, 0.15)' : 'var(--shadow-card)',
                  transform: isSelected ? 'scale(0.99)' : 'scale(1)',
                  transition: 'border-color 0.15s ease, background-color 0.15s ease, transform 0.1s ease',
                  outline: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* Letter marker badge */}
                  <span
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? 'var(--color-burgundy)' : 'rgba(107, 88, 68, 0.12)',
                      color: isSelected ? '#FFFFFF' : 'var(--color-black)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 700,
                      fontSize: '14px'
                    }}
                  >
                    {letter}
                  </span>

                  {/* Option text */}
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '15px',
                      fontWeight: 500,
                      color: 'var(--color-black)'
                    }}
                  >
                    {optionText}
                  </span>
                </div>

                {/* Selection Radio Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {statusBadge && (
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: feedbackStatus === 'correct' ? 'var(--color-correct-text)' : 'var(--color-burgundy)'
                      }}
                    >
                      {statusBadge}
                    </span>
                  )}
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: `1.5px solid ${isSelected ? 'var(--color-burgundy)' : 'var(--border-parchment-dark)'}`,
                      backgroundColor: isSelected ? 'var(--color-burgundy)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isSelected && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Submit Action or Feedback Notification */}
          {!isAnswerSubmitted ? (
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--color-ink-muted)',
                  textAlign: 'left'
                }}
              >
                {hasSelection
                  ? `Answer ${letterMarkers[selectedOptionIndex]} selected · not submitted`
                  : 'Choose an answer, then submit.'}
              </div>

              <button
                type="button"
                disabled={!hasSelection || roundRemainingMs <= 0}
                onClick={handleSubmitAnswer}
                style={{
                  width: '100%',
                  height: '52px',
                  backgroundColor: hasSelection ? 'var(--color-burgundy)' : 'var(--border-parchment)',
                  color: hasSelection ? '#FFFFFF' : 'var(--color-ink-muted)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: hasSelection ? 'pointer' : 'not-allowed',
                  boxShadow: hasSelection ? '0 4px 12px rgba(137, 1, 0, 0.25)' : 'none',
                  transition: 'background-color 0.2s ease, transform 0.1s ease',
                  outline: 'none'
                }}
                onMouseDown={(e) => hasSelection && (e.currentTarget.style.transform = 'scale(0.99)')}
                onMouseUp={(e) => hasSelection && (e.currentTarget.style.transform = 'scale(1)')}
              >
                Submit answer
              </button>
            </div>
          ) : (
            <FeedbackBanner
              status={feedbackStatus}
              pointsEarned={pointsAwarded}
              explanation={feedbackStatus === 'correct' ? question.explanation : ''}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ width: '100%', textAlign: 'center', paddingTop: '20px' }}>
        <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
          Evidence under examination · Trial in session
        </p>
      </footer>
    </div>
  );
}
