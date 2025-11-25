// src/ui/NoteHighway.js
// Minimal logic container for falling-note style feedback.

export class NoteHighway {
  constructor(audioContext, { hitWindow = 0.2 } = {}) {
    this.audioContext = audioContext;
    this.hitWindow = hitWindow;
    this.activeNotes = [];
  }

  spawnNote({ animalId, midiNote, startTime, duration }) {
    this.activeNotes.push({ animalId, midiNote, startTime, duration });
  }

  getRenderableNotes(currentTime = this.audioContext?.currentTime || 0) {
    this.activeNotes = this.activeNotes.filter((note) => currentTime <= note.startTime + note.duration + 1);
    return this.activeNotes;
  }

  tryHit(midiNote, currentTime = this.audioContext?.currentTime || 0) {
    const windowStart = currentTime - this.hitWindow;
    const windowEnd = currentTime + this.hitWindow;
    const hitIndex = this.activeNotes.findIndex((note) => {
      const inTime = note.startTime >= windowStart && note.startTime <= windowEnd;
      return inTime && note.midiNote === midiNote;
    });

    if (hitIndex === -1) return { hit: false };

    const [hitNote] = this.activeNotes.splice(hitIndex, 1);
    return { hit: true, note: hitNote };
  }
}
