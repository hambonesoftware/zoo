import * as THREE from '../../libs/three.module.js';
import { RENDER_MODES } from './renderMode.js';
import { applyShadowQuality } from './rendererConfig.js';

const LIGHT_PRESETS = {
  [RENDER_MODES.FAST]: {
    hemi: { skyColor: 0xffffff, groundColor: 0x404040, intensity: 0.9 },
    ambient: { color: 0xffffff, intensity: 0.25 },
    key: { color: 0xffffff, intensity: 0.75, position: new THREE.Vector3(4, 5, 4) },
    fill: { color: 0xf0f3ff, intensity: 0.45, position: new THREE.Vector3(-3, 3, 2) },
    rim: { color: 0xd7e3ff, intensity: 0.42, position: new THREE.Vector3(-2, 4.5, -4) },
    environment: null
  },
  [RENDER_MODES.CINEMATIC]: {
    hemi: { skyColor: 0xe8f0ff, groundColor: 0x2a2b31, intensity: 1.05 },
    ambient: { color: 0xfdf8f3, intensity: 0.22 },
    key: { color: 0xfff4e5, intensity: 1.18, position: new THREE.Vector3(5.2, 6.4, 3.8) },
    fill: { color: 0xcad9ff, intensity: 0.52, position: new THREE.Vector3(-3.8, 3.6, 2.6) },
    rim: { color: 0xbfd6ff, intensity: 0.58, position: new THREE.Vector3(-2.4, 5.1, -4.2) },
    environment: {
      topColor: 0xdce8ff,
      horizonColor: 0xb7c6d6,
      bottomColor: 0x2d2f36
    }
  }
};

function createDirectionalLight({ color, intensity, position }, target) {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.copy(position);
  if (target) {
    light.target = target;
  }
  return light;
}

function buildGradientEnvironment(renderer, options = {}) {
  if (!renderer || typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `#${new THREE.Color(options.topColor ?? 0xffffff).getHexString()}`);
  gradient.addColorStop(0.55, `#${new THREE.Color(options.horizonColor ?? 0xdde5f0).getHexString()}`);
  gradient.addColorStop(1, `#${new THREE.Color(options.bottomColor ?? 0x1f2024).getHexString()}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const equirectTexture = new THREE.CanvasTexture(canvas);
  equirectTexture.colorSpace = THREE.SRGBColorSpace;
  equirectTexture.mapping = THREE.EquirectangularReflectionMapping;
  equirectTexture.magFilter = THREE.LinearFilter;

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const pmremTarget = pmremGenerator.fromEquirectangular(equirectTexture);
  const envMap = pmremTarget.texture;

  const dispose = () => {
    pmremTarget?.dispose();
    pmremGenerator?.dispose();
    equirectTexture?.dispose();
  };

  return { map: envMap, dispose };
}

export function createLightingRig({ mode = RENDER_MODES.FAST, target = null, shadowSettings = {}, renderer = null } = {}) {
  const preset = LIGHT_PRESETS[mode] || LIGHT_PRESETS[RENDER_MODES.FAST];
  const group = new THREE.Group();

  const hemiLight = new THREE.HemisphereLight(
    preset.hemi.skyColor,
    preset.hemi.groundColor,
    preset.hemi.intensity
  );
  hemiLight.name = 'StudioHemiLight';
  group.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(preset.ambient.color, preset.ambient.intensity);
  ambientLight.name = 'StudioAmbientLight';
  group.add(ambientLight);

  const keyLight = createDirectionalLight(preset.key, target);
  keyLight.castShadow = true;
  keyLight.name = 'StudioKeyLight';
  applyShadowQuality(keyLight, mode);
  if (shadowSettings.mapSize) {
    keyLight.shadow.mapSize.set(shadowSettings.mapSize, shadowSettings.mapSize);
  }
  if (shadowSettings.bias !== undefined) {
    keyLight.shadow.bias = shadowSettings.bias;
  }
  if (shadowSettings.normalBias !== undefined) {
    keyLight.shadow.normalBias = shadowSettings.normalBias;
  }
  group.add(keyLight);

  const fillLight = createDirectionalLight(preset.fill, target);
  fillLight.name = 'StudioFillLight';
  group.add(fillLight);

  const rimLight = createDirectionalLight(preset.rim, target);
  rimLight.name = 'StudioRimLight';
  group.add(rimLight);

  const environment = preset.environment && renderer
    ? buildGradientEnvironment(renderer, preset.environment)
    : null;

  return {
    group,
    hemiLight,
    ambientLight,
    keyLight,
    fillLight,
    rimLight,
    environment,
    dispose: () => {
      environment?.dispose?.();
    }
  };
}

export function getLightingPreset(mode = RENDER_MODES.FAST) {
  return LIGHT_PRESETS[mode] || LIGHT_PRESETS[RENDER_MODES.FAST];
}
