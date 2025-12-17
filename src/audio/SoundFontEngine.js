// src/audio/SoundFontEngine.js
// A light wrapper that schedules notes against a shared AudioContext.
// This implementation decodes SF2 SoundFonts and plays back sample buffers
// instead of synthesized oscillators so the pipeline matches the real asset
// layout shipped with the app.

import { SoundFont2, GeneratorType } from 'soundfont2';
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
    this.activeVoices = new Map(); // animalId -> Map<midiNote, {source, gain}>
    this.soundFontData = null;
    this.soundFont = null;
    this.sampleBufferMap = new Map();
    this.keyCache = new Map();
    this.programs = GENERAL_MIDI_PROGRAMS;
    this.soundFontLoading = false;
    this.soundFontError = null;
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
    this.soundFontLoading = true;
    this.soundFontError = null;
    this.soundFontData = null;
    this.soundFont = null;
    this.sampleBufferMap.clear();
    this.keyCache.clear();

    const response = await fetch(url);
    if (!response.ok) {
      this.soundFontLoading = false;
      this.soundFontError = new Error(`Failed to fetch soundfont at ${url}: ${response.status}`);
      throw this.soundFontError;
    }

    try {
      this.soundFontData = await response.arrayBuffer();
      const sf2 = new SoundFont2(new Uint8Array(this.soundFontData));
      this.soundFont = sf2;
      this.buildSampleBuffers();
      this.programs = this.buildProgramListFromPresets(sf2.presets);
      this.soundFontLoading = false;
    } catch (error) {
      this.soundFontLoading = false;
      this.soundFontError = error;
      this.programs = GENERAL_MIDI_PROGRAMS;
      throw error;
    }
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

  isSoundFontLoading() {
    return this.soundFontLoading;
  }

  getSoundFontError() {
    return this.soundFontError;
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
    const clampedVelocity = Math.max(0, Math.min(1, velocity));
    const amplitude = this.getEffectiveGain(animalId, clampedVelocity);
    if (amplitude <= 0) return;

    const programNumber = this.instrumentMap.get(animalId) ?? 0;
    const keyData = this.getKeyDataForProgram(programNumber, midiNote);

    if (!keyData || !keyData.sampleBuffer) {
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = keyData.sampleBuffer;
    source.playbackRate.setValueAtTime(this.getPlaybackRateForKey(keyData, midiNote), startTime);

    if (typeof keyData.loopStart === 'number' && typeof keyData.loopEnd === 'number') {
      if (keyData.loopEnd > keyData.loopStart) {
        source.loop = true;
        source.loopStart = keyData.loopStart;
        source.loopEnd = keyData.loopEnd;
      }
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(amplitude, startTime + 0.01);

    source.connect(gain).connect(ctx.destination);
    source.start(startTime);

    if (!this.activeVoices.has(animalId)) {
      this.activeVoices.set(animalId, new Map());
    }
    this.activeVoices.get(animalId).set(midiNote, {
      source,
      gain,
      velocity: clampedVelocity
    });
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

    if (voice.source) {
      voice.source.stop(stopTime + releaseTime);
    }
    setTimeout(() => {
      voice.source?.disconnect();
      voice.gain.disconnect();
    }, (stopTime + releaseTime - ctx.currentTime) * 1000);

    voices.delete(midiNote);
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

  getRootKeyForKeyData(keyData) {
    const overridingRoot = keyData.generators?.[GeneratorType.OverridingRootKey]?.value;
    if (typeof overridingRoot === 'number' && overridingRoot >= 0) {
      return overridingRoot;
    }
    const originalPitch = keyData.sample?.header?.originalPitch;
    if (typeof originalPitch === 'number' && originalPitch >= 0) {
      return originalPitch;
    }
    return 60;
  }

  getPlaybackRateForKey(keyData, midiNote) {
    const rootKey = this.getRootKeyForKeyData(keyData);
    const scaleTuning = keyData.generators?.[GeneratorType.ScaleTuning]?.value ?? 100;
    const centsFromNote = (midiNote - rootKey) * scaleTuning;
    const pitchCorrection = keyData.sample?.header?.pitchCorrection ?? 0;
    return Math.pow(2, (centsFromNote + pitchCorrection) / 1200);
  }

  getKeyDataForProgram(programNumber, midiNote, bankNumber = 0) {
    if (!this.soundFont) return null;
    const cacheKey = `${bankNumber}:${programNumber}:${midiNote}`;
    if (this.keyCache.has(cacheKey)) return this.keyCache.get(cacheKey);

    const keyData = this.soundFont.getKeyData(midiNote, bankNumber, programNumber);
    if (!keyData) {
      this.keyCache.set(cacheKey, null);
      return null;
    }

    const sampleBuffer = this.sampleBufferMap.get(keyData.sample) || null;
    const sampleRate = keyData.sample?.header?.sampleRate || this.getAudioContext().sampleRate;
    const loopStart = keyData.sample?.header?.startLoop / sampleRate;
    const loopEnd = keyData.sample?.header?.endLoop / sampleRate;

    const hydrated = { ...keyData, sampleBuffer, loopStart, loopEnd };
    this.keyCache.set(cacheKey, hydrated);
    return hydrated;
  }

  buildSampleBuffers() {
    if (!this.soundFont) return;
    const ctx = this.getAudioContext();
    this.sampleBufferMap.clear();

    for (const sample of this.soundFont.samples) {
      const header = sample.header || {};
      const buffer = ctx.createBuffer(1, sample.data.length, header.sampleRate || ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < sample.data.length; i += 1) {
        channel[i] = sample.data[i] / 32768;
      }
      this.sampleBufferMap.set(sample, buffer);
    }
  }

  buildProgramListFromPresets(presets = []) {
    const mapped = presets.map((preset) => {
      const number = preset?.header?.preset ?? 0;
      const bank = preset?.header?.bank ?? 0;
      const baseName = preset?.header?.name || `Program ${number}`;
      const name = bank ? `${baseName} (Bank ${bank})` : baseName;
      return { number, bank, name };
    });

    const deduped = new Map();
    for (const program of mapped) {
      const key = `${program.bank}:${program.number}`;
      if (!deduped.has(key)) {
        deduped.set(key, program);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => {
      if (a.bank !== b.bank) return a.bank - b.bank;
      return a.number - b.number;
    });
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
