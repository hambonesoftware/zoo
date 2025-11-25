// src/pens/quadrupedPen.js

import { CatCreature } from '../../animals/Cat/CatCreature.js';

export class QuadrupedPen {
  constructor(world, scene, animationSystem, offset) {
    this.objects = [];
    this.cat = new CatCreature({
      position: { x: offset.x, y: offset.y, z: offset.z },
      scale: 1.1
    });
    scene.add(this.cat);
    this.objects.push(this.cat);
  }

  update(dt) {
    // No animation yet, but you can call behavior here if desired
  }

  remove() {
    for (const obj of this.objects) {
      if (obj && obj.parent) obj.parent.remove(obj);
    }
  }
}
