// src/animals/Anteater/AnteaterLocomotion.js
// Encapsulates simple anteater movement parameters for reuse by behaviors.

export class AnteaterLocomotion {
  constructor(config = {}) {
    this.walkSpeed = config.walkSpeed ?? 0.6;
    this.browseSpeed = config.browseSpeed ?? 0.35;
    this.turnRate = config.turnRate ?? 0.8; // radians per second
    this.currentSpeed = 0;
  }

  setMode(mode) {
    if (mode === 'forage') {
      this.currentSpeed = this.browseSpeed;
    } else if (mode === 'move') {
      this.currentSpeed = this.walkSpeed;
    } else {
      this.currentSpeed = 0;
    }
  }

  update(deltaSeconds = 0) {
    // Placeholder for future locomotion integration. Keeping stateful speed
    // makes it easy to plug into a future physics controller.
    this.elapsed = (this.elapsed || 0) + deltaSeconds;
    return this.currentSpeed;
  }
}
