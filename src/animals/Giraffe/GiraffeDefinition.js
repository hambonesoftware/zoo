// src/animals/Giraffe/GiraffeDefinition.js

export const GiraffeDefinition = {
  bones: [
    // Spine and neck (elongated)
    { name: 'spine_base', parent: 'root', position: [0, 1.6, 0] },
    { name: 'spine_mid', parent: 'spine_base', position: [0, 0.55, 0.25] },
    { name: 'spine_neck_base', parent: 'spine_mid', position: [0, 0.65, 0.2] },
    { name: 'spine_neck_mid', parent: 'spine_neck_base', position: [0, 0.65, 0.18] },
    { name: 'spine_neck_top', parent: 'spine_neck_mid', position: [0, 0.55, 0.15] },
    { name: 'head', parent: 'spine_neck_top', position: [0, 0.35, 0.12] },

    // Ossicones
    { name: 'ossicone_left', parent: 'head', position: [0.08, 0.18, 0.05] },
    { name: 'ossicone_left_tip', parent: 'ossicone_left', position: [0.02, 0.12, 0.02] },
    { name: 'ossicone_right', parent: 'head', position: [-0.08, 0.18, 0.05] },
    { name: 'ossicone_right_tip', parent: 'ossicone_right', position: [-0.02, 0.12, 0.02] },

    // Tail
    { name: 'tail_base', parent: 'spine_base', position: [0, -0.25, -0.45] },
    { name: 'tail_mid', parent: 'tail_base', position: [0, -0.25, -0.35] },
    { name: 'tail_tip', parent: 'tail_mid', position: [0, -0.25, -0.25] },

    // Shoulders and front legs
    { name: 'front_left_shoulder', parent: 'spine_mid', position: [0.35, -0.55, 0.12] },
    { name: 'front_left_upper', parent: 'front_left_shoulder', position: [0, -0.75, 0.05] },
    { name: 'front_left_lower', parent: 'front_left_upper', position: [0, -0.75, 0.05] },
    { name: 'front_left_hoof', parent: 'front_left_lower', position: [0, -0.15, 0.02] },

    { name: 'front_right_shoulder', parent: 'spine_mid', position: [-0.35, -0.55, 0.12] },
    { name: 'front_right_upper', parent: 'front_right_shoulder', position: [0, -0.75, 0.05] },
    { name: 'front_right_lower', parent: 'front_right_upper', position: [0, -0.75, 0.05] },
    { name: 'front_right_hoof', parent: 'front_right_lower', position: [0, -0.15, 0.02] },

    // Hips and rear legs
    { name: 'rear_left_hip', parent: 'spine_base', position: [0.32, -0.35, -0.12] },
    { name: 'rear_left_upper', parent: 'rear_left_hip', position: [0, -0.78, 0.04] },
    { name: 'rear_left_lower', parent: 'rear_left_upper', position: [0, -0.75, 0.08] },
    { name: 'rear_left_hoof', parent: 'rear_left_lower', position: [0, -0.16, 0.05] },

    { name: 'rear_right_hip', parent: 'spine_base', position: [-0.32, -0.35, -0.12] },
    { name: 'rear_right_upper', parent: 'rear_right_hip', position: [0, -0.78, 0.04] },
    { name: 'rear_right_lower', parent: 'rear_right_upper', position: [0, -0.75, 0.08] },
    { name: 'rear_right_hoof', parent: 'rear_right_lower', position: [0, -0.16, 0.05] }
  ],

  sizes: {
    spine_base: [0.45, 0.5, 0.42],
    spine_mid: [0.5, 0.55, 0.46],
    spine_neck_base: [0.35, 0.38, 0.32],
    spine_neck_mid: [0.3, 0.32, 0.28],
    spine_neck_top: [0.24, 0.26, 0.22],
    head: [0.32, 0.32, 0.32],

    ossicone_left: [0.06, 0.12, 0.06],
    ossicone_left_tip: [0.04, 0.08, 0.04],
    ossicone_right: [0.06, 0.12, 0.06],
    ossicone_right_tip: [0.04, 0.08, 0.04],

    tail_base: [0.12, 0.12, 0.14],
    tail_mid: [0.1, 0.1, 0.12],
    tail_tip: [0.08, 0.08, 0.1],

    front_left_shoulder: [0.26, 0.26, 0.22],
    front_left_upper: [0.22, 0.22, 0.2],
    front_left_lower: [0.2, 0.2, 0.18],
    front_left_hoof: [0.16, 0.16, 0.16],

    front_right_shoulder: [0.26, 0.26, 0.22],
    front_right_upper: [0.22, 0.22, 0.2],
    front_right_lower: [0.2, 0.2, 0.18],
    front_right_hoof: [0.16, 0.16, 0.16],

    rear_left_hip: [0.28, 0.28, 0.24],
    rear_left_upper: [0.22, 0.22, 0.2],
    rear_left_lower: [0.2, 0.2, 0.18],
    rear_left_hoof: [0.16, 0.16, 0.16],

    rear_right_hip: [0.28, 0.28, 0.24],
    rear_right_upper: [0.22, 0.22, 0.2],
    rear_right_lower: [0.2, 0.2, 0.18],
    rear_right_hoof: [0.16, 0.16, 0.16]
  }
};
