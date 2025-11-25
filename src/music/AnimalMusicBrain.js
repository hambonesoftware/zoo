// src/music/AnimalMusicBrain.js
// Maintains guided pattern progress for a single animal.

export class AnimalMusicBrain {
  constructor(profile) {
    this.profile = profile;
    this.theory = {
      scaleName: profile.scaleName,
      rootMidiNote: profile.rootMidiNote
    };

    this.guided = {
      currentStepIndex: -1,
      nextStepTime: 0,
      allowedDegreesNow: []
    };

    this.secondsPerBeat = 60 / (profile.tempoBPM || 120);
    this.initialized = false;
  }

  updateGuidedStep(audioCtxTime) {
    if (!this.initialized) {
      this.guided.nextStepTime = audioCtxTime;
      this.initialized = true;
    }

    let advanced = false;
    const pattern = this.profile.patternDegrees && this.profile.patternDegrees.length > 0
      ? this.profile.patternDegrees
      : [1];

    while (audioCtxTime >= this.guided.nextStepTime) {
      this.guided.currentStepIndex = (this.guided.currentStepIndex + 1) % pattern.length;
      const degree = pattern[this.guided.currentStepIndex];
      this.guided.allowedDegreesNow = [degree];
      this.guided.lastStepTime = this.guided.nextStepTime;
      this.guided.nextStepTime += this.secondsPerBeat;
      advanced = true;
    }

    return {
      advanced,
      currentStepIndex: this.guided.currentStepIndex,
      nextStepTime: this.guided.nextStepTime,
      allowedDegreesNow: this.guided.allowedDegreesNow
    };
  }

  getSecondsPerBeat() {
    return this.secondsPerBeat;
  }
}
