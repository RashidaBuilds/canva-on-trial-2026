import { useRef, useCallback } from 'react';

/**
 * Native Web Audio API & HTML5 Audio Engine
 * Lightweight, zero-dependency audio engine:
 * 1. One subtle confirmation chime upon successful player join.
 * 2. Silent normal lobby waiting (no looping music, no drone).
 * 3. question-tick.mp3 played once during final 10s Get Ready.
 * 4. question-tick.mp3 played once at start of every 10s question.
 * 5. winner-reveal.mp3 played once when final leaderboard appears.
 * 6. Native audio autoplay unlocked via initial Join button click.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.questionTickAudio = null;
    this.winnerRevealAudio = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      }

      this.questionTickAudio = new Audio('/audio/question-tick.mp3');
      this.questionTickAudio.preload = 'auto';

      this.winnerRevealAudio = new Audio('/audio/winner-reveal.mp3');
      this.winnerRevealAudio.preload = 'auto';

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioEngine init error (silent fallback):', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * One-time subtle, pleasant confirmation chime upon successful join
   */
  playJoinConfirmation() {
    this.resume();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const master = this.ctx.createGain();
      master.gain.setValueAtTime(0.001, now);
      master.gain.linearRampToValueAtTime(0.06, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      master.connect(this.ctx.destination);

      // Two warm harmonious tones (F#5: 739.99Hz, C#6: 1108.73Hz) for subtle editorial polish
      [739.99, 1108.73].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        osc.connect(master);
        osc.start(now + idx * 0.05);
        osc.stop(now + 0.45);
      });
    } catch (_) {}
  }

  /**
   * Play supplied question-tick.mp3 (lasts ~9s, final second silent)
   */
  playQuestionTick() {
    this.resume();
    if (!this.questionTickAudio) return;
    try {
      this.questionTickAudio.currentTime = 0;
      this.questionTickAudio.play().catch(() => {});
    } catch (_) {}
  }

  stopQuestionTick() {
    if (!this.questionTickAudio) return;
    try {
      this.questionTickAudio.pause();
      this.questionTickAudio.currentTime = 0;
    } catch (_) {}
  }

  /**
   * Play supplied winner-reveal.mp3 once for the Leaderboard
   */
  playWinnerReveal() {
    this.resume();
    if (!this.winnerRevealAudio) return;
    try {
      this.winnerRevealAudio.currentTime = 0;
      this.winnerRevealAudio.play().catch(() => {});
    } catch (_) {}
  }

  /**
   * Subtle tactile feedback on option choice
   */
  playUiClick() {
    this.resume();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (_) {}
  }
}

export const soundEngine = new SoundEngine();

export function useAudioEngine() {
  const isWinnerPlayedRef = useRef(false);

  const initAudio = useCallback(() => {
    soundEngine.init();
    soundEngine.resume();
  }, []);

  const playJoinConfirmation = useCallback(() => {
    soundEngine.playJoinConfirmation();
  }, []);

  const playQuestionTick = useCallback(() => {
    soundEngine.playQuestionTick();
  }, []);

  const stopQuestionTick = useCallback(() => {
    soundEngine.stopQuestionTick();
  }, []);

  const playWinnerReveal = useCallback(() => {
    if (!isWinnerPlayedRef.current) {
      isWinnerPlayedRef.current = true;
      soundEngine.playWinnerReveal();
    }
  }, []);

  const playUiClick = useCallback(() => {
    soundEngine.playUiClick();
  }, []);

  return {
    initAudio,
    playJoinConfirmation,
    playQuestionTick,
    stopQuestionTick,
    playWinnerReveal,
    playUiClick
  };
}
