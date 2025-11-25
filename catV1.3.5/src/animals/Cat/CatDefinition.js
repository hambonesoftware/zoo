// src/animals/CatDefinition.js

export const CatDefinition = {
  bones: [
    // === Spine ===
    { name: 'spine_base',  parent: 'root',       position: [0, 0.8, 0] },
    { name: 'spine_mid',   parent: 'spine_base', position: [0, 0.05, 0.55] },
    { name: 'spine_neck',  parent: 'spine_mid',  position: [0, 0.1, 0.45] },
    { name: 'head',        parent: 'spine_neck', position: [0, 0.12, 0.32] },

    // === Ears (Start -> Tip) ===
    { name: 'ear_left',    parent: 'head',        position: [ 0.18, 0.2, -0.05] },
    { name: 'ear_left_tip', parent: 'ear_left',   position: [ 0.05, 0.12, 0.0] },

    { name: 'ear_right',   parent: 'head',        position: [-0.18, 0.2, -0.05] },
    { name: 'ear_right_tip', parent: 'ear_right', position: [-0.05, 0.12, 0.0] },

    // === Tail ===
    { name: 'tail_base',   parent: 'spine_base', position: [0, -0.1, -0.4] },
    { name: 'tail_mid',    parent: 'tail_base',  position: [0, -0.22, -0.35] },
    { name: 'tail_tip',    parent: 'tail_mid',   position: [0, -0.22, -0.25] },

    // === Shoulders ===
    { name: 'front_left_shoulder',  parent: 'spine_mid', position: [ 0.22, -0.35, 0.25] },
    { name: 'front_right_shoulder', parent: 'spine_mid', position: [-0.22, -0.35, 0.25] },

    // === Hips ===
    { name: 'rear_left_hip',  parent: 'spine_base', position: [ 0.24, -0.3, -0.15] },
    { name: 'rear_right_hip', parent: 'spine_base', position: [-0.24, -0.3, -0.15] },

    // === Front Legs ===
    { name: 'front_left_upper',  parent: 'front_left_shoulder', position: [0, -0.45, 0.05] },
    { name: 'front_left_lower',  parent: 'front_left_upper',    position: [0, -0.45, 0.0] },
    { name: 'front_left_paw',    parent: 'front_left_lower',    position: [0, -0.12, 0.02] },

    { name: 'front_right_upper', parent: 'front_right_shoulder', position: [0, -0.45, 0.05] },
    { name: 'front_right_lower', parent: 'front_right_upper',    position: [0, -0.45, 0.0] },
    { name: 'front_right_paw',   parent: 'front_right_lower',    position: [0, -0.12, 0.02] },

    // === Rear Legs ===
    { name: 'rear_left_upper',   parent: 'rear_left_hip',  position: [0, -0.5, 0.0] },
    { name: 'rear_left_lower',   parent: 'rear_left_upper', position: [0, -0.45, 0.05] },
    { name: 'rear_left_paw',     parent: 'rear_left_lower', position: [0, -0.12, 0.0] },

    { name: 'rear_right_upper',  parent: 'rear_right_hip',  position: [0, -0.5, 0.0] },
    { name: 'rear_right_lower',  parent: 'rear_right_upper', position: [0, -0.45, 0.05] },
    { name: 'rear_right_paw',    parent: 'rear_right_lower', position: [0, -0.12, 0.0] }
  ],

  sizes: {
    // === Body Radii (slim, feline) ===
    spine_base:   [0.35, 0.4, 0.42],
    spine_mid:    [0.4, 0.45, 0.42],
    spine_neck:   [0.28, 0.26, 0.24],
    head:         [0.2, 0.23, 0.21],

    ear_left:      [0.12, 0.1, 0.05],
    ear_left_tip:  [0.08, 0.06, 0.03],
    ear_right:     [0.12, 0.1, 0.05],
    ear_right_tip: [0.08, 0.06, 0.03],

    tail_base:    [0.12, 0.12, 0.18],
    tail_mid:     [0.09, 0.09, 0.14],
    tail_tip:     [0.07, 0.07, 0.1],

    // Legs and paws
    front_left_upper:  [0.18, 0.18, 0.18],
    front_left_lower:  [0.15, 0.15, 0.15],
    front_left_paw:    [0.14, 0.16, 0.14],

    rear_left_upper:   [0.2, 0.2, 0.2],
    rear_left_lower:   [0.17, 0.17, 0.17],
    rear_left_paw:     [0.15, 0.17, 0.15],

    front_right_upper: [0.18, 0.18, 0.18],
    front_right_lower: [0.15, 0.15, 0.15],
    front_right_paw:   [0.14, 0.16, 0.14],
    rear_right_upper:  [0.2, 0.2, 0.2],
    rear_right_lower:  [0.17, 0.17, 0.17],
    rear_right_paw:    [0.15, 0.17, 0.15],
  }
};