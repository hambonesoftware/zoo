// src/systems/AnimationSystem.js

import * as THREE from 'three';

/**
 * AnimationSystem
 * ---------------
 * Centralizes Three.js AnimationMixers and supports procedural animation hooks.
 * Designed for creatures and objects needing both keyframed and custom animation.
 */
export class AnimationSystem {
  constructor() {
    this._mixers = [];           // Array of { mixer, mesh, clips }
    this._procedural = [];       // Array of { update(dt), context }
    this._debug = false;         // Set true for verbose logs
  }

  /**
   * Add a mesh with optional Three.js animation clips.
   * @param {THREE.Object3D} mesh
   * @param {THREE.AnimationClip[]} clips
   */
  add(mesh, clips = []) {
    if (!mesh) return;
    if (clips && clips.length > 0) {
      const mixer = new THREE.AnimationMixer(mesh);
      clips.forEach(clip => mixer.clipAction(clip).play());
      this._mixers.push({ mixer, mesh, clips });
      if (this._debug) console.log('[AnimationSystem] Mixer added for', mesh.name || mesh);
    }
  }

  /**
   * Add a procedural animation update.
   * @param {function(dt:number, context:object):void} updateFunc
   * @param {object} context - optional reference for update
   */
  addProcedural(updateFunc, context = null) {
    this._procedural.push({ update: updateFunc, context });
    if (this._debug) console.log('[AnimationSystem] Procedural anim added:', updateFunc.name);
  }

  /**
   * Remove a mesh (and its mixer, if any).
   * @param {THREE.Object3D} mesh
   */
  remove(mesh) {
    // Remove mixer for this mesh
    this._mixers = this._mixers.filter(m => {
      if (m.mesh === mesh) {
        m.mixer.stopAllAction();
        m.mixer.uncacheRoot(mesh);
        if (this._debug) console.log('[AnimationSystem] Mixer removed for', mesh.name || mesh);
        return false;
      }
      return true;
    });
    // Optionally: Remove procedural anims tied to mesh context
    this._procedural = this._procedural.filter(p => p.context !== mesh);
  }

  /**
   * Per-frame update (called from app loop).
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Update all mixers (Three.js keyframed anims)
    for (const { mixer } of this._mixers) {
      mixer.update(dt);
    }
    // Run all procedural animation hooks
    for (const { update, context } of this._procedural) {
      update(dt, context);
    }
  }

  /**
   * Clear all mixers and procedural hooks.
   */
  clear() {
    this._mixers.forEach(m => {
      m.mixer.stopAllAction();
      m.mixer.uncacheRoot(m.mesh);
    });
    this._mixers = [];
    this._procedural = [];
    if (this._debug) console.log('[AnimationSystem] All animations cleared.');
  }

  /**
   * Enable verbose debug logging.
   * @param {boolean} enable
   */
  setDebug(enable) {
    this._debug = !!enable;
  }

  /**
   * Returns number of active mixers (for diagnostics).
   */
  get mixerCount() {
    return this._mixers.length;
  }

  /**
   * Returns number of procedural anim hooks (for diagnostics).
   */
  get proceduralCount() {
    return this._procedural.length;
  }
}

export default AnimationSystem;
