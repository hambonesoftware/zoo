// src/animals/ElephantPen.js

import * as THREE from 'three';
import { AnimalStudioPen } from '../../pens/AnimalStudioPen.js';
import { ElephantCreature } from './ElephantCreature.js';

/**
 * ElephantPen: wraps AnimalStudioPen so the elephant shares the same studio
 * visuals (corner walls, grids, lighting) as the cat while keeping its own
 * creature setup and environment tuning.
 */
export class ElephantPen {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.label = 'Elephant';
    this.instrumentProgram =
      typeof options.instrumentProgram === 'number' ? options.instrumentProgram : null;

    this.pen = new AnimalStudioPen(scene, {
      radius: options.radius || 3.5,
      padHeight: options.padHeight || 0.2,
      markerRadius: options.markerRadius || 0.13,
      markerHeight: options.markerHeight || 0.13,
      markerColor: options.markerColor || 0x227bc4,
      lineColor: options.lineColor || 0x166597,
      position: options.position || new THREE.Vector3(0, 0, 0),
      turntable: options.turntable,
      showBoundingBox: options.showBoundingBox
    });

    this.group = this.pen.group;

    const elephantScale = typeof options.scale === 'number' ? options.scale : 0.75;
    const lowPolyOption =
      options.lowPolyElephant !== undefined
        ? !!options.lowPolyElephant
        : options.lowPoly !== undefined
        ? !!options.lowPoly
        : undefined;

    const creatureOptions = {
      scale: elephantScale,
      debug: !!options.debugElephant,
      showSkeleton: options.showSkeleton,
      bodyColor: options.bodyColor,
      variantSeed: options.variantSeed,
      soundFontEngine: options.soundFontEngine,
      walkInPlace: options.walkInPlace !== undefined ? !!options.walkInPlace : true,
      stepInstrument: options.elephantInstrument || options.stepInstrument,
      baseMidiNote: options.elephantBaseMidiNote || options.baseMidiNote
    };

    if (lowPolyOption !== undefined) {
      creatureOptions.lowPoly = lowPolyOption;
    }

    this.Elephant = new ElephantCreature(creatureOptions);

    if (this.instrumentProgram !== null && this.Elephant.behavior?.setInstrumentProgram) {
      this.Elephant.behavior.setInstrumentProgram(this.instrumentProgram);
    }

    this.Elephant.position.set(0, this.pen.padHeight + 1.2, 0);
    this.Elephant.rotation.y =
      typeof options.rotationY === 'number' ? options.rotationY : Math.PI * 0.1;
    this.Elephant.name = 'ElephantCreature';

    if (this.Elephant.mesh) {
      this.Elephant.mesh.castShadow = true;
      this.Elephant.mesh.receiveShadow = true;
    }

    const environment = {
      enclosureCenter: new THREE.Vector3(0, this.pen.padHeight, 0),
      enclosureRadius: this.pen.radius,
      pondCenter: new THREE.Vector3(0, this.pen.padHeight, 0),
      pondRadius: 0,
      obstacles: [],
      groundHeight: this.pen.padHeight
    };

    if (this.Elephant.behavior && typeof this.Elephant.behavior.configureEnvironment === 'function') {
      this.Elephant.behavior.configureEnvironment(environment);
    }

    this.pen.mountAnimal(this.Elephant);
  }

  fitCameraToElephant(camera, controls) {
    if (this.pen && typeof this.pen.fitCameraToSubject === 'function') {
      this.pen.fitCameraToSubject(camera, controls);
    }
  }

  getExportRoot() {
    return this.pen.getExportRoot();
  }

  update(dt) {
    this.pen.update(dt);
  }

  setInstrumentProgram(programNumber) {
    this.instrumentProgram = typeof programNumber === 'number' ? programNumber : null;
    if (this.Elephant?.behavior?.setInstrumentProgram) {
      this.Elephant.behavior.setInstrumentProgram(this.instrumentProgram);
    }
  }
}
