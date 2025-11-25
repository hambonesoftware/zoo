// Updated CatGenerator.js with correct project import paths

import { generateLimb } from '../bodyParts/LimbGenerator.js';
import { generateTorso } from '../bodyParts/TorsoGenerator.js';

function generateCat(catSkeleton) {
    const catGroup = new THREE.Group();

    // Generate torso
    const torso = generateTorso(catSkeleton.spine, 0.8, 0.6, 6);
    const torsoMesh = new THREE.Mesh(torso, new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true }));
    catGroup.add(torsoMesh);

    // Generate limbs
    for (let limb of catSkeleton.limbs) {
        const limbGeo = generateLimb(limb.start, limb.end, limb.radiusStart, limb.radiusEnd, 6, 4);
        const limbMesh = new THREE.Mesh(limbGeo, new THREE.MeshStandardMaterial({ color: 0x444444, flatShading: true }));
        catGroup.add(limbMesh);
    }

    // Tail
    if (catSkeleton.tail) {
        const tailGeo = generateLimb(catSkeleton.tail.start, catSkeleton.tail.end, 0.1, 0.05, 5, 5);
        const tailMesh = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true }));
        catGroup.add(tailMesh);
    }

    return catGroup;
}
export { generateCat };
