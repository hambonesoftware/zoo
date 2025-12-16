// src/music/MusicEngine.js
// Coordinates AnimalMusicBrain state with the audio + visual pipeline.

import { createMusicEvent } from './MusicEvent.js';
import { getProfileForAnimal } from './MusicProfiles.js';

const DEFAULT_PROFILE = {
  scaleName: 'C_major',
  rootMidiNote: 60,
  tempoBPM: 120
};

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
    const profile = brain?.profile || this.getFallbackProfile(footfall.animalId);
    const midiNote = this.resolveMidiNote(footfall, profile);
    if (typeof midiNote !== 'number') return null;

    const gaitMeta = footfall.gait || footfall.meta || {};
    const baseStart = this.resolveFootfallTime(footfall, audioTime);
    const startTime = baseStart + this.lookaheadSeconds;
    const duration = this.resolveFootfallDuration({ gaitMeta, profile, footfall });
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

  getFallbackProfile(animalId) {
    return getProfileForAnimal(animalId) || DEFAULT_PROFILE;
  }

  resolveMidiNote(footfall, profile) {
    if (typeof footfall.midiNote === 'number') return footfall.midiNote;
    const degree = footfall.degree ?? footfall.scaleDegree ?? 1;
    const activeProfile = profile || this.getFallbackProfile(footfall.animalId);
    const notes = this.theoryEngine?.scaleDegreesToMidiNotes(activeProfile, [degree]);
    if (Array.isArray(notes) && typeof notes[0] === 'number') return notes[0];

    return activeProfile.rootMidiNote ?? DEFAULT_PROFILE.rootMidiNote;
  }

  resolveFootfallTime(footfall, audioTime) {
    if (typeof footfall.time === 'number') return footfall.time;
    if (typeof footfall.timestamp === 'number') return footfall.timestamp;
    if (typeof footfall.startTime === 'number') return footfall.startTime;
    return audioTime;
  }

  resolveFootfallDuration({ gaitMeta = {}, profile, footfall } = {}) {
    const durationCandidates = [
      gaitMeta.contactDuration,
      gaitMeta.stanceDuration,
      gaitMeta.stepDuration,
      gaitMeta.duration
    ];
    const duration = durationCandidates.find((value) => typeof value === 'number' && value > 0);
    if (typeof duration === 'number') return duration;

    const tempoBPMCandidates = [footfall?.tempoBPM, gaitMeta.tempoBPM, profile?.tempoBPM];
    const tempoBPM = tempoBPMCandidates.find((value) => typeof value === 'number' && value > 0) || DEFAULT_PROFILE.tempoBPM;
    const secondsPerBeat = 60 / tempoBPM;
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
