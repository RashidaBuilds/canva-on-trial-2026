import { useRef, useCallback } from 'react';

/**
 * Native Web Audio API & HTML5 Audio Engine
 * Provides melodic mystery lobby ambience, question ticking, winner reveal, and tactile UI feedback.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.ambientNodes = null;
    this.ambientInterval = null;
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
          this.ctx.resume();
        }
      }

      this.questionTickAudio = new Audio('/audio/question-tick.mp3');
      this.questionTickAudio.preload = 'auto';

      this.winnerRevealAudio = new Audio('/audio/winner-reveal.mp3');
      this.winnerRevealAudio.preload = 'auto';

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioEngine init error (silent):', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Melodic, quiet detective mystery lobby background music
   * Arpeggiates gentle muted tones in A Minor with subtle warmth and anticipation.
   */
  startLobbyAmbience() {
    this.resume();
    if (!this.ctx || this.ambientInterval) return;

    try {
      // Warm pad master gain
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.04, this.ctx.currentTime + 2);
      masterGain.connect(this.ctx.destination);

      // Low foundation drone
      const droneOsc = this.ctx.createOscillator();
      const droneFilter = this.ctx.createBiquadFilter();
      droneOsc.type = 'sine';
      droneOsc.frequency.setValueAtTime(110, this.ctx.currentTime); // A2 note
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(260, this.ctx.currentTime);

      droneOsc.connect(droneFilter);
      droneFilter.connect(masterGain);
      droneOsc.start();

      // Melodic notes sequence in A Minor (frequencies in Hz: A3, C4, E4, B3, G3, A3, F3, E3)
      const notes = [220.00, 261.63, 329.63, 246.94, 196.00, 220.00, 174.61, 164.81];
      let noteIndex = 0;

      const playNextArpNote = () => {
        if (!this.ctx || !this.ambientNodes) return;
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(notes[noteIndex % notes.length], now);
          noteIndex++;

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(450, now);

          // Gentle plucked envelope
          noteGain.gain.setValueAtTime(0.001, now);
          noteGain.gain.exponentialRampToValueAtTime(0.035, now + 0.05);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now);
          osc.stop(now + 1.3);
        } catch (_) {}
      };

      this.ambientInterval = setInterval(playNextArpNote, 650); // Muted pulse every 650ms
      this.ambientNodes = { masterGain, droneOsc };
    } catch (e) {
      console.warn('Lobby music error:', e);
    }
  }

  /**
   * Stop or fade out lobby music when entering Get Ready state
   */
  stopLobbyAmbience() {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }

    if (this.ambientNodes && this.ctx) {
      try {
        const { masterGain, droneOsc } = this.ambientNodes;
        const now = this.ctx.currentTime;
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        setTimeout(() => {
          try {
            droneOsc.stop();
            droneOsc.disconnect();
            masterGain.disconnect();
          } catch (_) {}
        }, 900);
      } catch (_) {}
      this.ambientNodes = null;
    }
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
   * Subtle typewriter / tactile click on interactive choice
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

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (_) {}
  }

  /**
   * Subtle transition paper sweep
   */
  playTransition() {
    this.resume();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(500, now);
      filter.Q.setValueAtTime(1.2, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
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

  const startLobbyAmbience = useCallback(() => {
    soundEngine.startLobbyAmbience();
  }, []);

  const stopLobbyAmbience = useCallback(() => {
    soundEngine.stopLobbyAmbience();
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

  const playTransition = useCallback(() => {
    soundEngine.playTransition();
  }, []);

  return {
    initAudio,
    startLobbyAmbience,
    stopLobbyAmbience,
    playQuestionTick,
    stopQuestionTick,
    playWinnerReveal,
    playUiClick,
    playTransition
  };
}
