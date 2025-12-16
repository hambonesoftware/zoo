// src/music/MusicEngine.js
// Coordinates AnimalMusicBrain state with the audio + visual pipeline.

import { createMusicEvent } from './MusicEvent.js';

export class MusicEngine {
  constructor({ soundFontEngine, theoryEngine, noteHighway = null, lookaheadSeconds = 0.12 } = {}) {
    this.soundFontEngine = soundFontEngine;
    this.theoryEngine = theoryEngine;
    this.noteHighway = noteHighway;
    this.lookaheadSeconds = lookaheadSeconds;
    this.animalBrains = new Map();
    this.footfallQueue = [];
    this.footfallCallback = null;
  }

  registerAnimalBrain(animalId, brain) {
    this.animalBrains.set(animalId, brain);
  }

  registerFootfallCallback(callback) {
    this.footfallCallback = callback;
  }

  enqueueFootfallEvent(event) {
    if (!event) return;
    if (Array.isArray(event)) {
      this.footfallQueue.push(...event);
    } else {
      this.footfallQueue.push(event);
    }
  }

  update(audioTime) {
    if (!this.soundFontEngine || !this.theoryEngine) return;

    this.consumeFootfallQueue(audioTime);

    for (const [animalId, brain] of this.animalBrains.entries()) {
      const result = brain.updateGuidedStep(audioTime);
      if (!result.advanced) continue;

      const degrees = brain.guided.allowedDegreesNow;
      const midiNotes = this.theoryEngine.scaleDegreesToMidiNotes(brain.profile, degrees);

      for (const midiNote of midiNotes) {
        const startTime = audioTime + this.lookaheadSeconds;
        const duration = brain.getSecondsPerBeat() * 0.9;
        const velocity = 0.85;

        const event = createMusicEvent({
          animalId,
          midiNote,
          velocity,
          startTime,
          duration,
          source: 'guided'
        });

        this.scheduleEvent(event);
      }
    }
  }

  handleFootfallEvent(event = {}) {
    if (!event || !this.soundFontEngine) return;

    const audioCtx = this.soundFontEngine.getAudioContext?.();
    const startTime =
      typeof event.audioTime === 'number'
        ? event.audioTime
        : audioCtx?.currentTime ?? 0;
    const duration = typeof event.duration === 'number' ? event.duration : 0.2;
    const velocity = typeof event.velocity === 'number' ? event.velocity : 0.85;

    if (typeof event.midiNote !== 'number') return;

    const musicEvent = createMusicEvent({
      animalId: event.animalId,
      midiNote: event.midiNote,
      velocity,
      startTime,
      duration,
      source: event.source || 'footfall'
    });

    this.scheduleEvent(musicEvent);
  consumeFootfallQueue(audioTime) {
    if (typeof this.footfallCallback === 'function') {
      const incoming = this.footfallCallback(audioTime);
      this.enqueueFootfallEvent(incoming);
    }

    while (this.footfallQueue.length > 0) {
      const footfall = this.footfallQueue.shift();
      const event = this.transformFootfallToEvent(footfall, audioTime);
      if (event) {
        this.scheduleEvent(event);
      }
    }
  }

  transformFootfallToEvent(footfall, audioTime) {
    if (!footfall || !footfall.animalId) return null;

    const brain = this.animalBrains.get(footfall.animalId);
    const profile = brain?.profile;
    const midiNote = this.resolveMidiNote(footfall, profile);
    if (typeof midiNote !== 'number') return null;

    const gaitMeta = footfall.gait || footfall.meta || {};
    const baseStart = this.resolveFootfallTime(footfall, audioTime);
    const startTime = baseStart + this.lookaheadSeconds;
    const duration = this.resolveFootfallDuration(gaitMeta, brain);
    const velocity = this.resolveFootfallVelocity(gaitMeta);

    return createMusicEvent({
      animalId: footfall.animalId,
      midiNote,
      velocity,
      startTime,
      duration,
      source: 'footfall'
    });
  }

  resolveMidiNote(footfall, profile) {
    if (typeof footfall.midiNote === 'number') return footfall.midiNote;
    const degree = footfall.degree ?? footfall.scaleDegree ?? 1;
    const notes = this.theoryEngine?.scaleDegreesToMidiNotes(profile, [degree]);
    return Array.isArray(notes) && typeof notes[0] === 'number' ? notes[0] : null;
  }

  resolveFootfallTime(footfall, audioTime) {
    if (typeof footfall.time === 'number') return footfall.time;
    if (typeof footfall.timestamp === 'number') return footfall.timestamp;
    if (typeof footfall.startTime === 'number') return footfall.startTime;
    return audioTime;
  }

  resolveFootfallDuration(gaitMeta = {}, brain) {
    const durationCandidates = [
      gaitMeta.contactDuration,
      gaitMeta.stanceDuration,
      gaitMeta.stepDuration,
      gaitMeta.duration
    ];
    const duration = durationCandidates.find((value) => typeof value === 'number' && value > 0);
    if (typeof duration === 'number') return duration;

    const secondsPerBeat = brain?.getSecondsPerBeat ? brain.getSecondsPerBeat() : 0.5;
    return secondsPerBeat * 0.5;
  }

  resolveFootfallVelocity(gaitMeta = {}) {
    const velocityCandidates = [gaitMeta.intensity, gaitMeta.force, gaitMeta.weight, gaitMeta.speed, gaitMeta.velocity];
    const velocity = velocityCandidates.find((value) => typeof value === 'number');
    const clamped = Math.max(0, Math.min(1, typeof velocity === 'number' ? velocity : 0.85));
    return clamped;
  }

  scheduleEvent(event) {
    this.soundFontEngine.noteOnForAnimal(
      event.animalId,
      event.midiNote,
      event.velocity,
      event.startTime
    );
    this.soundFontEngine.noteOffForAnimal(
      event.animalId,
      event.midiNote,
      event.startTime + event.duration
    );

    if (this.noteHighway) {
      this.noteHighway.spawnNote(event);
    }
  }
}
