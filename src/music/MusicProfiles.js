// src/music/MusicProfiles.js
// Data-driven mapping of animals to musical behaviors.

// MIDI channel reservations keep melodic/bass/percussion voices from stepping on
// each other as we add animals. If an animal needs a split (e.g. lead + drums),
// dedicate a unique channel per role here for quick discoverability.
export const MIDI_CHANNEL_ASSIGNMENTS = {
  cat: 0,
  elephant: 1,
  giraffe: 2,
  snake: 3
};

export const MUSIC_PROFILES = {
  CatCreature: {
    id: 'cat_dorian',
    displayName: 'D Dorian Walking Line',
    scaleName: 'D_dorian',
    rootMidiNote: 62,
    patternDegrees: [1, 2, 3, 5, 3, 2],
    tempoBPM: 90,
    programNumber: 11
  },
  ElephantCreature: {
    id: 'elephant_mixolydian',
    displayName: 'G Mixolydian Bass',
    scaleName: 'G_mixolydian',
    rootMidiNote: 43,
    patternDegrees: [1, 5, 1, 4, 1, 5],
    tempoBPM: 70,
    programNumber: 58
  },
  GiraffeCreature: {
    id: 'giraffe_lydian',
    displayName: 'C Lydian Stride',
    scaleName: 'C_lydian',
    rootMidiNote: 60,
    patternDegrees: [1, 3, 5, 7, 5, 3],
    tempoBPM: 96,
    programNumber: 74
  },
  SnakeCreature: {
    id: 'snake_phrygian',
    displayName: 'E Phrygian Glide',
    scaleName: 'E_phrygian',
    rootMidiNote: 52,
    patternDegrees: [1, 2, 1, 5, 4, 1],
    tempoBPM: 88,
    programNumber: 82
  }
};

export function getProfileForAnimal(animalType) {
  const profileKeyMap = {
    cat: 'CatCreature',
    elephant: 'ElephantCreature',
    giraffe: 'GiraffeCreature',
    snake: 'SnakeCreature'
  };

  const lookupKey = profileKeyMap[animalType] || animalType;
  return MUSIC_PROFILES[lookupKey] || null;
}
