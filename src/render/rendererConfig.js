import * as THREE from '../../libs/three.module.js';
import { RENDER_MODES } from './renderMode.js';

const MODE_CONFIG = {
  [RENDER_MODES.FAST]: {
    antialias: true,
    sampleCount: 1,
    pixelRatioCap: 1.5,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    outputColorSpace: THREE.SRGBColorSpace,
    outputBufferType: THREE.HalfFloatType,
    shadows: {
      enabled: true,
      type: THREE.PCFSoftShadowMap,
      mapSize: 1024,
      bias: -0.0004,
      normalBias: 0.01
    }
  },
  [RENDER_MODES.CINEMATIC]: {
    antialias: true,
    sampleCount: 4,
    pixelRatioCap: 2.0,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.1,
    outputColorSpace: THREE.SRGBColorSpace,
    outputBufferType: THREE.HalfFloatType,
    shadows: {
      enabled: true,
      type: THREE.PCFSoftShadowMap,
      mapSize: 2048,
      bias: -0.00035,
      normalBias: 0.008
    }
  }
};

function computePixelRatio(cap) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  return cap ? Math.min(devicePixelRatio, cap) : devicePixelRatio;
}

export function getRendererConfig(mode = RENDER_MODES.FAST) {
  return MODE_CONFIG[mode] || MODE_CONFIG[RENDER_MODES.FAST];
}

export function getRendererOptionsForMode(mode = RENDER_MODES.FAST) {
  const config = getRendererConfig(mode);
  return {
    antialias: config.antialias,
    sampleCount: config.sampleCount
  };
}

function applyColorAndToneMapping(renderer, config) {
  if (renderer.outputColorSpace !== undefined && config.outputColorSpace) {
    renderer.outputColorSpace = config.outputColorSpace;
  }

  if (renderer.toneMapping !== undefined && config.toneMapping !== undefined) {
    renderer.toneMapping = config.toneMapping;
  }

  if (
    renderer.toneMappingExposure !== undefined &&
    config.toneMappingExposure !== undefined
  ) {
    renderer.toneMappingExposure = config.toneMappingExposure;
  }

  if (config.outputBufferType) {
    if ('outputBuffer' in renderer) {
      renderer.outputBuffer = renderer.outputBuffer || {};
      renderer.outputBuffer.type = config.outputBufferType;
    } else if ('outputBufferType' in renderer) {
      renderer.outputBufferType = config.outputBufferType;
    }
  }
}

function applyShadowSettings(renderer, config) {
  if (!renderer.shadowMap || !config.shadows) return;

  renderer.shadowMap.enabled = !!config.shadows.enabled;
  renderer.shadowMap.type = config.shadows.type ?? THREE.PCFSoftShadowMap;
}

export function applyRendererSize(renderer, mode = RENDER_MODES.FAST) {
  const config = getRendererConfig(mode);
  const pixelRatio = computePixelRatio(config.pixelRatioCap);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  return pixelRatio;
}

export function applyRendererConfig(renderer, mode = RENDER_MODES.FAST) {
  const config = getRendererConfig(mode);
  if (!renderer) return { mode };

  const pixelRatio = applyRendererSize(renderer, mode);

  applyColorAndToneMapping(renderer, config);
  applyShadowSettings(renderer, config);

  return {
    mode,
    pixelRatio,
    sampleCount: config.sampleCount,
    toneMappingExposure: config.toneMappingExposure,
    outputBufferType: config.outputBufferType,
    shadowMapSize: config.shadows?.mapSize,
    shadowBias: config.shadows?.bias,
    shadowNormalBias: config.shadows?.normalBias
  };
}

export function applyShadowQuality(light, mode = RENDER_MODES.FAST) {
  const config = getRendererConfig(mode);
  const shadows = config.shadows;
  if (!light || !light.shadow || !shadows) return;

  light.castShadow = true;
  if (light.shadow.mapSize && shadows.mapSize) {
    light.shadow.mapSize.set(shadows.mapSize, shadows.mapSize);
  }
  if (shadows.bias !== undefined) {
    light.shadow.bias = shadows.bias;
  }
  if (shadows.normalBias !== undefined) {
    light.shadow.normalBias = shadows.normalBias;
  }
}

export function logRendererDiagnostics(renderer, mode, details = {}) {
  if (!renderer) return;
  const info = {
    mode,
    rendererType: renderer.isWebGPURenderer
      ? 'WebGPURenderer'
      : renderer.isWebGLRenderer
      ? 'WebGLRenderer'
      : renderer.constructor?.name,
    sampleCount: details.sampleCount ?? details.samples,
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    outputColorSpace: renderer.outputColorSpace,
    outputBufferType: details.outputBufferType,
    pixelRatio: renderer.getPixelRatio?.() ?? details.pixelRatio,
    shadowMapType: renderer.shadowMap?.type,
    shadowMapSize: details.shadowMapSize
  };
  console.info('[Zoo] Render diagnostics', info);
}

export function getModeConfigs() {
  return { ...MODE_CONFIG };
}
