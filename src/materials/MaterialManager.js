// src/materials/MaterialManager.js

import * as THREE from 'three';

// Optional: Import textures if you want textured surfaces
// import furTexture     from '../../public/assets/fur_texture.jpg';
// import skinTexture    from '../../public/assets/skin_texture.jpg';
// import metalTexture   from '../../public/assets/metal_texture.jpg';
// import woodTexture    from '../../public/assets/wood_texture.jpg';
// import stoneTexture   from '../../public/assets/stone_texture.jpg';
// import rubberTexture  from '../../public/assets/rubber_texture.jpg';
// import plasticTexture from '../../public/assets/plastic_texture.jpg';

/**
 * Central registry for all mesh materials.
 * Add new materials as needed for your zoo assets!
 */
const materials = {
  lionFur: new THREE.MeshStandardMaterial({
    color: 0xc19a6b, // sandy tan
    roughness: 0.7,
    metalness: 0.1
    // map: new THREE.TextureLoader().load(furTexture)
  }),
  skin: new THREE.MeshStandardMaterial({
    color: 0xffe0bd, // light skin tone
    roughness: 0.8
    // map: new THREE.TextureLoader().load(skinTexture)
  }),
  spiderCarapace: new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.6
  }),
  spiderLeg: new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.7
  }),
  snakeScales: new THREE.MeshStandardMaterial({
    color: 0x228b22, // forest green
    roughness: 0.8
  }),
  octopusSkin: new THREE.MeshStandardMaterial({
    color: 0x9933cc, // purple
    roughness: 0.7
  }),
  log: new THREE.MeshStandardMaterial({
    color: 0x8b5a2b, // deep brown
    roughness: 0.6
    // map: new THREE.TextureLoader().load(woodTexture)
  }),
  wood: new THREE.MeshStandardMaterial({
    color: 0xc2b280, // light brown
    roughness: 0.8
    // map: new THREE.TextureLoader().load(woodTexture)
  }),
  metal: new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    metalness: 1,
    roughness: 0.3
    // map: new THREE.TextureLoader().load(metalTexture)
  }),
  rubber: new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.9
    // map: new THREE.TextureLoader().load(rubberTexture)
  }),
  plastic: new THREE.MeshStandardMaterial({
    color: 0xf2f2f2,
    roughness: 0.5
    // map: new THREE.TextureLoader().load(plasticTexture)
  }),
  stone: new THREE.MeshStandardMaterial({
    color: 0xaaa999,
    roughness: 0.75
    // map: new THREE.TextureLoader().load(stoneTexture)
  }),
  food: new THREE.MeshStandardMaterial({
    color: 0xffe066,
    roughness: 0.7
  }),

  // --- Fence/Pen Wall Specific Materials ---
  fenceBar: new THREE.MeshStandardMaterial({
    color: 0x101010, // nearly black for steel bar
    roughness: 0.55,
    metalness: 0.75
    // map: new THREE.TextureLoader().load(metalTexture)
  }),
  cementBlock: new THREE.MeshStandardMaterial({
    color: 0xb8b7b3, // light gray for cement
    roughness: 0.84,
    metalness: 0.19
    // map: new THREE.TextureLoader().load(stoneTexture)
  })
};

/**
 * MaterialManager API.
 * Call MaterialManager.get('materialName') to get a cloned, reusable material.
 */
const MaterialManager = {
  /**
   * Returns a clone of the requested material, or a default material if missing.
   * @param {string} name
   * @returns {THREE.MeshStandardMaterial}
   */
  get(name) {
    if (!materials[name]) {
      console.warn(`[MaterialManager] Missing material: '${name}', using default gray.`);
      return new THREE.MeshStandardMaterial({ color: 0x888888 });
    }
    // Always return a clone so different meshes can be customized (e.g., color, transparency)
    return materials[name].clone();
  },

  /**
   * Returns a list of all registered material names.
   * @returns {string[]}
   */
  all() {
    return Object.keys(materials);
  },

  /**
   * Registers (or overwrites) a new material.
   * @param {string} name
   * @param {THREE.Material} material
   */
  register(name, material) {
    materials[name] = material;
  }
};

export default MaterialManager;
