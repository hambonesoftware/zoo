// src/libs/BufferGeometryUtils.js
// Thin re-export shim so existing imports like
//   import { mergeGeometries } from '../../libs/BufferGeometryUtils.js';
// resolve correctly regardless of where the original BufferGeometryUtils
// file lives. The original file is a direct copy of the Three.js
// examples helper, stored under src/animals/.

export * from '../animals/three_examples_jsm_utils_BufferGeometryUtils__js.js';
