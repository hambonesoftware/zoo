// src/music/TheoryEngine.js
// Pure utilities for mapping scale degrees to MIDI notes.

export const SCALE_OFFSETS_12TET = {
  C_major: [0, 2, 4, 5, 7, 9, 11],
  D_dorian: [0, 2, 3, 5, 7, 9, 10],
  G_mixolydian: [0, 2, 4, 5, 7, 9, 10],
  A_natural_minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

const PENTATONIC_OFFSETS = [0, 2, 4, 7, 9];

export class TheoryEngine {
  constructor(scaleOffsets = SCALE_OFFSETS_12TET) {
    this.scaleOffsets = scaleOffsets;
  }

  getScaleOffsets(scaleName) {
    return this.scaleOffsets[scaleName] || this.scaleOffsets.C_major;
  }

  degreeToMidi(profile, degree) {
    const root = profile.rootMidiNote ?? 60;
    const scaleName = profile.scaleName || 'C_major';
    const scale = this.getScaleOffsets(scaleName);
    if (!Array.isArray(scale) || scale.length === 0) return root;

    const idx = Math.max(0, (degree ?? 1) - 1);
    const octaveOffset = Math.floor(idx / scale.length) * 12;
    const scaleOffset = scale[idx % scale.length];
    const rawNote = root + scaleOffset + octaveOffset;
    return this.snapToPentatonic(root, rawNote);
  }

  scaleDegreesToMidiNotes(profile, degrees = []) {
    return degrees.map((deg) => this.degreeToMidi(profile, deg));
  }

  snapToPentatonic(root, midiNote) {
    const relative = midiNote - root;
    const octave = Math.floor(relative / 12);
    const offset = ((relative % 12) + 12) % 12;

    let closest = PENTATONIC_OFFSETS[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of PENTATONIC_OFFSETS) {
      const distance = Math.abs(candidate - offset);
      if (distance < bestDistance) {
        closest = candidate;
        bestDistance = distance;
      }
    }

    return root + octave * 12 + closest;
  }
}
