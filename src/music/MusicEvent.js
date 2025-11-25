// src/music/MusicEvent.js
// Lightweight representation of a scheduled musical note.

export function createMusicEvent({
  animalId,
  midiNote,
  velocity,
  startTime,
  duration,
  source = 'animal'
}) {
  return { animalId, midiNote, velocity, startTime, duration, source };
}
