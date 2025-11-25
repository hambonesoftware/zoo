// src/music/MusicProfiles.js
// Data-driven mapping of animals to musical behaviors.

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
  }
};

export function getProfileForAnimal(animalType) {
  const profileKeyMap = {
    cat: 'CatCreature',
    elephant: 'ElephantCreature'
  };

  const lookupKey = profileKeyMap[animalType] || animalType;
  return MUSIC_PROFILES[lookupKey] || null;
}
