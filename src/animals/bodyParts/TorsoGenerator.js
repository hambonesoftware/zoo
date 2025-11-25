// Simplified TorsoGenerator.js with expanded ring wrapping around shoulder and hips

function generateTorso(spineBones, shoulderRadius = 1.5, hipRadius = 1.5, segments = 8) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];

    const rings = spineBones.length;
    for (let i = 0; i < rings; i++) {
        const bone = spineBones[i];
        const pos = new THREE.Vector3(bone.x, bone.y, bone.z);
        const radius = i < 2 ? hipRadius : (i > rings - 3 ? shoulderRadius : (hipRadius + shoulderRadius) / 2);
        const angleStep = (2 * Math.PI) / segments;

        for (let j = 0; j < segments; j++) {
            const angle = j * angleStep;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            vertices.push(pos.x + x, pos.y + y, pos.z);
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
