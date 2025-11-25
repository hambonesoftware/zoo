// Simplified LimbGenerator.js with consistent ring extrusion and facet control

function generateLimb(start, end, radiusStart, radiusEnd, segments = 8, rings = 5) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];

    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const length = start.distanceTo(end);
    const step = length / (rings - 1);

    for (let i = 0; i < rings; i++) {
        const ringCenter = new THREE.Vector3().addVectors(start, direction.clone().multiplyScalar(i * step));
        const radius = radiusStart + (radiusEnd - radiusStart) * (i / (rings - 1));
        const angleStep = (2 * Math.PI) / segments;

        for (let j = 0; j < segments; j++) {
            const angle = j * angleStep;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            vertices.push(ringCenter.x + x, ringCenter.y + y, ringCenter.z);
        }
    }

    for (let i = 0; i < rings - 1; i++) {
        for (let j = 0; j < segments; j++) {
            const next = (j + 1) % segments;
            const a = i * segments + j;
            const b = i * segments + next;
            const c = (i + 1) * segments + next;
            const d = (i + 1) * segments + j;
            indices.push(a, b, d, b, c, d);
        }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}
