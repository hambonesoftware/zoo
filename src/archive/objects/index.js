// src/objects/index.js
import * as THREE from 'three';

// Re-export all core objects for unified import in pens and elsewhere

export { Ball } from './ball.js';
export { Box }  from './box.js';
export { Food } from './food.js';
export { Log }  from './log.js';
export { PenWall } from './penWall.js';
// Optionally, add more object types here in the future:
// export { Rock } from './rock.js';
// export { WaterBowl } from './waterBowl.js';
// etc.
