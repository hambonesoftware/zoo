import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

/**
 * Download a given Object3D hierarchy as an OBJ file.
 *
 * @param {THREE.Object3D} object3D - Root object to export.
 * @param {string} filename - Download filename, e.g. "elephant_highpoly.obj".
 */
export function downloadAsOBJ(object3D, filename) {
  if (!object3D) {
    console.warn('[downloadAsOBJ] No object3D provided; aborting export.');
    return;
  }

  console.info('[downloadAsOBJ] Starting OBJ export.', {
    filename,
    hasObject: !!object3D,
    childCount: Array.isArray(object3D.children) ? object3D.children.length : undefined
  });

  let objText;
  try {
    const exporter = new OBJExporter();
    objText = exporter.parse(object3D);
  } catch (error) {
    console.error('[downloadAsOBJ] Failed to parse OBJ from object3D.', error);
    return;
  }

  const blob = new Blob([objText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('[downloadAsOBJ] Exported OBJ:', filename);
}
