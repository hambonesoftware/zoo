// src/audio/AudioContextManager.js
// Provides a lazily created, shared AudioContext for the application.

class AudioContextManager {
  constructor() {
    this.audioContext = null;
  }

  /**
   * Lazily create (or return) the shared AudioContext.
   * @returns {AudioContext}
   */
  getAudioContext() {
    if (this.audioContext) return this.audioContext;

    if (typeof window === 'undefined') {
      throw new Error('AudioContext is only available in a browser environment.');
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      throw new Error('Web Audio API is not supported in this environment.');
    }

    this.audioContext = new Ctx();
    return this.audioContext;
  }

  /**
   * Ensures the audio context is resumed after a user gesture.
   * @returns {Promise<AudioContext>}
   */
  async resume() {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    return ctx;
  }
}

export const audioContextManager = new AudioContextManager();
