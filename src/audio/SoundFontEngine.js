// src/audio/SoundFontEngine.js
// A light wrapper that schedules notes against a shared AudioContext.
// This implementation supports scheduling against a placeholder SoundFont
// asset but uses synthesized oscillators as a fallback voice so the pipeline
// remains testable without the full HoneyHex decoder.

import { audioContextManager } from './AudioContextManager.js';

const GENERAL_MIDI_PROGRAMS = [
  { number: 0, name: 'Acoustic Grand Piano' },
  { number: 11, name: 'Vibraphone' },
  { number: 24, name: 'Nylon Guitar' },
  { number: 32, name: 'Acoustic Bass' },
  { number: 40, name: 'Violin' },
  { number: 46, name: 'Harp' },
  { number: 52, name: 'Choir Aahs' },
  { number: 56, name: 'Trumpet' },
  { number: 58, name: 'Tuba' },
  { number: 63, name: 'Synth Brass 1' },
  { number: 73, name: 'Flute' },
  { number: 74, name: 'Recorder' },
  { number: 82, name: 'Lead 3 (Calliope)' }
];

const DEFAULT_VELOCITY = 0.75;
const DEFAULT_STEP_DURATION = 0.32;

export class SoundFontEngine {
  constructor() {
    this.channelMap = new Map();
    this.instrumentMap = new Map();
    this.activeVoices = new Map(); // animalId -> Map<midiNote, {osc, gain}>
    this.soundFontData = null;
    this.programs = GENERAL_MIDI_PROGRAMS;
    this.masterVolume = 1;
    this.masterMuted = false;
    this.animalVolumes = new Map();
    this.animalMutes = new Map();
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

  getProgramList() {
    return this.programs;
  }

  getProgramName(programNumber) {
    if (typeof programNumber !== 'number') return null;
    const hit = this.programs.find((program) => program.number === programNumber);
    return hit ? hit.name : null;
  }
  setMasterVolume(volume) {
    this.masterVolume = this.clampVolume(volume);
    this.updateAllVoiceGains();
  }

  setMasterMute(muted) {
    this.masterMuted = Boolean(muted);
    this.updateAllVoiceGains();
  }

  setAnimalVolume(animalId, volume) {
    this.animalVolumes.set(animalId, this.clampVolume(volume));
    this.updateVoiceGains(animalId);
  }

  setAnimalMute(animalId, muted) {
    this.animalMutes.set(animalId, Boolean(muted));
    this.updateVoiceGains(animalId);
  }

  getAnimalVolume(animalId) {
    return this.animalVolumes.get(animalId) ?? 1;
  }

  isAnimalMuted(animalId) {
    return this.animalMutes.get(animalId) ?? false;
  }

  noteOnForAnimal(animalId, midiNote, velocity = DEFAULT_VELOCITY, time) {
    const ctx = this.getAudioContext();
    const startTime = typeof time === 'number' ? time : ctx.currentTime;
    const frequency = this.midiToFrequency(midiNote);
    const waveform = this.getWaveformForProgram(this.instrumentMap.get(animalId));

    const clampedVelocity = Math.max(0, Math.min(1, velocity));
    const amplitude = this.getEffectiveGain(animalId, clampedVelocity);
    if (amplitude <= 0) return;

    const osc = ctx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(amplitude, startTime + 0.01);

    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);

    if (!this.activeVoices.has(animalId)) {
      this.activeVoices.set(animalId, new Map());
    }
    this.activeVoices.get(animalId).set(midiNote, { osc, gain, velocity: clampedVelocity });
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

  clampVolume(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 1;
    return Math.min(Math.max(value, 0), 1);
  }

  getEffectiveGain(animalId, velocity) {
    if (this.masterMuted || this.isAnimalMuted(animalId)) return 0;
    return velocity * this.masterVolume * this.getAnimalVolume(animalId);
  }

  updateAllVoiceGains() {
    for (const animalId of this.activeVoices.keys()) {
      this.updateVoiceGains(animalId);
    }
  }

  updateVoiceGains(animalId) {
    const voices = this.activeVoices.get(animalId);
    if (!voices) return;

    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    for (const [midiNote, voice] of voices.entries()) {
      const amplitude = this.getEffectiveGain(animalId, voice.velocity ?? DEFAULT_VELOCITY);
      if (amplitude <= 0) {
        this.noteOffForAnimal(animalId, midiNote, now);
        continue;
      }
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(amplitude, now);
    }
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
