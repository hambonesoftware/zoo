export const RENDER_MODES = {
  FAST: 'fast',
  CINEMATIC: 'cinematic'
};

const truthyValues = new Set(['1', 'true', 'yes', 'on']);
const searchParamKey = 'cinematic';

function isTruthy(value) {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  return truthyValues.has(String(value).toLowerCase());
}

function readQueryToggle() {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has(searchParamKey)) return null;
  return isTruthy(params.get(searchParamKey));
}

export function resolveRenderMode({ defaultMode = RENDER_MODES.FAST } = {}) {
  const queryPrefersCinematic = readQueryToggle();
  if (queryPrefersCinematic !== null) {
    return queryPrefersCinematic ? RENDER_MODES.CINEMATIC : RENDER_MODES.FAST;
  }

  if (typeof window !== 'undefined' && typeof window.ZOO_CINEMATIC !== 'undefined') {
    return window.ZOO_CINEMATIC ? RENDER_MODES.CINEMATIC : RENDER_MODES.FAST;
  }

  return defaultMode;
}

export function isCinematic(mode) {
  return mode === RENDER_MODES.CINEMATIC;
}
