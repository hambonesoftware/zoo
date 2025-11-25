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
  }

  registerAnimalBrain(animalId, brain) {
    this.animalBrains.set(animalId, brain);
  }

  update(audioTime) {
    if (!this.soundFontEngine || !this.theoryEngine) return;

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
          source: 'animal'
        });

        this.scheduleEvent(event);
      }
    }
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
