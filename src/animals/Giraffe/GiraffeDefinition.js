// src/animals/Giraffe/GiraffeDefinition.js

export const GiraffeDefinition = {
  bones: [
    // === Torso ===
    { name: 'spine_base',  parent: 'root',       position: [0, 2.0, 0] },
    { name: 'spine_mid',   parent: 'spine_base', position: [0, 0.15, 1.0] },
    { name: 'spine_upper', parent: 'spine_mid',  position: [0, 0.2, 0.9] },

    // === Neck Chain ===
    { name: 'neck_0', parent: 'spine_upper', position: [0, 0.35, 0.4] },
    { name: 'neck_1', parent: 'neck_0',      position: [0, 0.35, 0.35] },
    { name: 'neck_2', parent: 'neck_1',      position: [0, 0.35, 0.3] },
    { name: 'neck_3', parent: 'neck_2',      position: [0, 0.3, 0.25] },
    { name: 'neck_4', parent: 'neck_3',      position: [0, 0.28, 0.2] },
    { name: 'neck_5', parent: 'neck_4',      position: [0, 0.25, 0.18] },

    // === Head ===
    { name: 'head', parent: 'neck_5', position: [0, 0.18, 0.3] },
    { name: 'jaw',  parent: 'head',   position: [0, -0.08, 0.3] },

    // === Ossicones & Ears ===
    { name: 'horn_left',  parent: 'head', position: [ 0.12, 0.35, 0.1] },
    { name: 'horn_right', parent: 'head', position: [-0.12, 0.35, 0.1] },
    { name: 'ear_left',   parent: 'head', position: [ 0.22, 0.18, -0.1] },
    { name: 'ear_right',  parent: 'head', position: [-0.22, 0.18, -0.1] },

    // === Tail ===
    { name: 'tail_0',   parent: 'spine_base', position: [0, -0.25, -0.6] },
    { name: 'tail_1',   parent: 'tail_0',     position: [0, -0.35, -0.35] },
    { name: 'tail_tip', parent: 'tail_1',     position: [0, -0.3, -0.25] },

    // === Shoulders ===
    { name: 'front_left_shoulder',  parent: 'spine_upper', position: [ 0.35, -0.55, 0.25] },
    { name: 'front_right_shoulder', parent: 'spine_upper', position: [-0.35, -0.55, 0.25] },

    // === Hips ===
    { name: 'back_left_hip',  parent: 'spine_base', position: [ 0.3, -0.6, -0.1] },
    { name: 'back_right_hip', parent: 'spine_base', position: [-0.3, -0.6, -0.1] },

    // === Front Legs ===
    { name: 'front_left_upper',  parent: 'front_left_shoulder', position: [0, -0.85, 0.05] },
    { name: 'front_left_lower',  parent: 'front_left_upper',    position: [0, -0.85, 0.05] },
    { name: 'front_left_foot',   parent: 'front_left_lower',    position: [0, -0.35, 0.0] },

    { name: 'front_right_upper', parent: 'front_right_shoulder', position: [0, -0.85, 0.05] },
    { name: 'front_right_lower', parent: 'front_right_upper',    position: [0, -0.85, 0.05] },
    { name: 'front_right_foot',  parent: 'front_right_lower',    position: [0, -0.35, 0.0] },

    // === Back Legs ===
    { name: 'back_left_upper',  parent: 'back_left_hip', position: [0, -0.85, 0.0] },
    { name: 'back_left_lower',  parent: 'back_left_upper', position: [0, -0.85, 0.05] },
    { name: 'back_left_foot',   parent: 'back_left_lower', position: [0, -0.35, 0.0] },

    { name: 'back_right_upper', parent: 'back_right_hip', position: [0, -0.85, 0.0] },
    { name: 'back_right_lower', parent: 'back_right_upper', position: [0, -0.85, 0.05] },
    { name: 'back_right_foot',  parent: 'back_right_lower', position: [0, -0.35, 0.0] }
  ],

  sizes: {
    // === Body ===
    spine_base:   [0.55, 0.6, 0.65],
    spine_mid:    [0.6, 0.65, 0.7],
    spine_upper:  [0.5, 0.55, 0.6],

    // === Neck Taper ===
    neck_0: [0.4, 0.4, 0.38],
    neck_1: [0.36, 0.36, 0.34],
    neck_2: [0.32, 0.32, 0.3],
    neck_3: [0.28, 0.28, 0.26],
    neck_4: [0.24, 0.24, 0.22],
    neck_5: [0.2, 0.2, 0.18],

    head: [0.35, 0.38, 0.4],
    jaw:  [0.25, 0.2, 0.25],

    horn_left:  [0.08, 0.08, 0.12],
    horn_right: [0.08, 0.08, 0.12],
    ear_left:   [0.25, 0.18, 0.08],
    ear_right:  [0.25, 0.18, 0.08],

    // === Tail ===
    tail_0:   [0.16, 0.16, 0.22],
    tail_1:   [0.12, 0.12, 0.18],
    tail_tip: [0.08, 0.08, 0.14],

    // === Legs ===
    front_left_upper:  [0.24, 0.24, 0.24],
    front_left_lower:  [0.2, 0.2, 0.2],
    front_left_foot:   [0.2, 0.16, 0.2],

    front_right_upper: [0.24, 0.24, 0.24],
    front_right_lower: [0.2, 0.2, 0.2],
    front_right_foot:  [0.2, 0.16, 0.2],

    back_left_upper:   [0.25, 0.25, 0.25],
    back_left_lower:   [0.21, 0.21, 0.21],
    back_left_foot:    [0.2, 0.16, 0.2],

    back_right_upper:  [0.25, 0.25, 0.25],
    back_right_lower:  [0.21, 0.21, 0.21],
    back_right_foot:   [0.2, 0.16, 0.2],
  }
};
