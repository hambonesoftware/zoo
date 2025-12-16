// src/audio/SoundFontEngine.js
// A light wrapper that schedules notes against a shared AudioContext.
// This implementation supports scheduling against a placeholder SoundFont
// asset but uses synthesized oscillators as a fallback voice so the pipeline
// remains testable without the full HoneyHex decoder.

import { audioContextManager } from './AudioContextManager.js';

const DEFAULT_VELOCITY = 0.75;
const DEFAULT_STEP_DURATION = 0.32;

export class SoundFontEngine {
  constructor() {
    this.channelMap = new Map();
    this.instrumentMap = new Map();
    this.activeVoices = new Map(); // animalId -> Map<midiNote, {osc, gain}>
    this.soundFontData = null;
  }

  getAudioContext() {
    return audioContextManager.getAudioContext();
  }

  async resumeContext() {
    return audioContextManager.resume();
  }

  async loadSoundFont(url) {
    // Fetch and hold the raw data for future decoding. The current
    // implementation keeps a placeholder copy; hook your HoneyHex
    // loader here to parse SF2/SFZ data.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch soundfont at ${url}: ${response.status}`);
    }
    this.soundFontData = await response.arrayBuffer();
  }

  assignChannelForAnimal(animalId, midiChannel) {
    this.channelMap.set(animalId, midiChannel);
  }

  setInstrumentForAnimal(animalId, programNumber) {
    this.instrumentMap.set(animalId, programNumber);
  }

  noteOnForAnimal(animalId, midiNote, velocity = DEFAULT_VELOCITY, time) {
    const ctx = this.getAudioContext();
    const startTime = typeof time === 'number' ? time : ctx.currentTime;
    const frequency = this.midiToFrequency(midiNote);
    const waveform = this.getWaveformForProgram(this.instrumentMap.get(animalId));

    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = frequency;

    const gain = ctx.createGain();
    const amplitude = Math.max(0, Math.min(1, velocity));
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(amplitude, startTime + 0.01);

    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);

    if (!this.activeVoices.has(animalId)) {
      this.activeVoices.set(animalId, new Map());
    }
    this.activeVoices.get(animalId).set(midiNote, { osc, gain });
  }

  noteOffForAnimal(animalId, midiNote, time) {
    const ctx = this.getAudioContext();
    const stopTime = typeof time === 'number' ? time : ctx.currentTime + 0.25;
    const voices = this.activeVoices.get(animalId);
    const voice = voices ? voices.get(midiNote) : null;

    if (!voice) return;

    const releaseTime = 0.1;
    voice.gain.gain.cancelScheduledValues(stopTime);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, stopTime);
    voice.gain.gain.linearRampToValueAtTime(0, stopTime + releaseTime);

    voice.osc.stop(stopTime + releaseTime);
    setTimeout(() => {
      voice.osc.disconnect();
      voice.gain.disconnect();
    }, (stopTime + releaseTime - ctx.currentTime) * 1000);

    voices.delete(midiNote);
  }

  midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  getWaveformForProgram(programNumber) {
    if (typeof programNumber !== 'number') return 'sine';
    const waveforms = ['sine', 'triangle', 'sawtooth', 'square'];
    return waveforms[Math.abs(programNumber) % waveforms.length];
  }

  playStepNote(instrument, midiNote, velocity = DEFAULT_VELOCITY, time, duration = DEFAULT_STEP_DURATION) {
    const ctx = this.getAudioContext();
    const startTime = typeof time === 'number' ? time : ctx.currentTime;
    const stopTime = startTime + Math.max(0.05, duration);

    const instrumentId =
      (instrument && typeof instrument === 'object' && instrument.id) ||
      (typeof instrument === 'string' ? instrument : 'step');

    if (typeof instrument === 'number') {
      this.setInstrumentForAnimal(instrumentId, instrument);
    } else if (instrument && typeof instrument === 'object' && typeof instrument.program === 'number') {
      this.setInstrumentForAnimal(instrumentId, instrument.program);
    }

    this.noteOnForAnimal(instrumentId, midiNote, velocity, startTime);
    this.noteOffForAnimal(instrumentId, midiNote, stopTime);
  }
}
