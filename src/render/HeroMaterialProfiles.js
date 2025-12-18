import * as THREE from '../libs/three.module.js';
import { RENDER_MODES } from './renderMode.js';

const DEFAULT_BODY_OVERRIDES = {
  roughness: 0.65,
  metalness: 0.08,
  envMapIntensity: 1.0
};

const DEFAULT_EYE_OVERRIDES = {
  roughness: 0.18,
  metalness: 0.15,
  envMapIntensity: 1.35
};

function applyOverrides(material, overrides = {}) {
  if (!material) return;
  const keys = ['roughness', 'metalness', 'envMapIntensity'];
  for (const key of keys) {
    if (material[key] !== undefined && overrides[key] !== undefined) {
      material[key] = overrides[key];
    }
  }
}

function normalizeMaterials(material) {
  if (!material) return [];
  return Array.isArray(material) ? material.filter(Boolean) : [material];
}

function looksLikeEye(name = '') {
  const lowered = name.toLowerCase();
  return lowered.includes('eye') || lowered.includes('pupil') || lowered.includes('iris');
}

function isFacetedMaterial(material, facetedHint = false) {
  if (!material) return facetedHint;
  if (material.flatShading === true) return true;
  return facetedHint;
}

export function applyHeroMaterialProfile(root, options = {}) {
  const { mode = RENDER_MODES.FAST, envMap = null } = options;
  const facetedHint = options.faceted === true;
  if (!root || mode !== RENDER_MODES.CINEMATIC) return;

  root.traverse((child) => {
    if (!child.isMesh) return;
    const materials = normalizeMaterials(child.material);
    const name = child.name || '';
    const treatAsEye = looksLikeEye(name);

    for (const material of materials) {
      if (!material || !(material instanceof THREE.Material)) continue;

      if (envMap && 'envMap' in material && !material.envMap) {
        material.envMap = envMap;
        if (material.needsUpdate !== undefined) material.needsUpdate = true;
      }

      if (isFacetedMaterial(material, facetedHint) && material.flatShading !== undefined) {
        material.flatShading = true;
        material.needsUpdate = true;
      }

      if (treatAsEye) {
        applyOverrides(material, DEFAULT_EYE_OVERRIDES);
      } else {
        applyOverrides(material, DEFAULT_BODY_OVERRIDES);
      }
    }
  });
}
