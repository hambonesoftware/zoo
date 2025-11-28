// src/animals/ElephantDefinition.js

export const ElephantDefinition = {
  bones: [
    // === Main Body Column (The Barrel) ===
    // spine_base = Hips. High up.
    { name: 'spine_base',  parent: 'root',       position: [0, 2.1, 0] }, 
    // spine_mid = Ribcage. Lower and forward.
    { name: 'spine_mid',   parent: 'spine_base', position: [0, -0.1, 1.1] },
    // spine_neck = Shoulder hump.
    { name: 'spine_neck',  parent: 'spine_mid',  position: [0, 0.3, 0.9] },
    // spine_head stretches forward to give the neck visible length.
    { name: 'spine_head',  parent: 'spine_neck', position: [0, 0.1, 0.6] },
    // Head anchored slightly forward from the neck tip.
    { name: 'head',        parent: 'spine_head', position: [0, -0.15, 0.45] },

    // === Trunk (Chain) ===
    { name: 'trunk_anchor', parent: 'head',        position: [0, -0.12, 1.2] },
    { name: 'trunk_root',   parent: 'trunk_anchor', position: [0, -0.05, 0.4] },
    { name: 'trunk_base',   parent: 'trunk_root',   position: [0, -0.35, 0.25] },
    { name: 'trunk_mid1',  parent: 'trunk_base',  position: [0, -0.5, 0.1] },
    { name: 'trunk_mid2',  parent: 'trunk_mid1',  position: [0, -0.5, 0.0] },
    { name: 'trunk_tip',   parent: 'trunk_mid2',  position: [0, -0.4, 0.0] },

    // === Tusks (Start -> Tip) ===
    { name: 'tusk_left',   parent: 'head',        position: [ 0.3, -0.3, 0.4] },
    { name: 'tusk_left_tip', parent: 'tusk_left', position: [ 0.1, 0.3, 0.5] }, // Curve up

    { name: 'tusk_right',  parent: 'head',        position: [-0.3, -0.3, 0.4] },
    { name: 'tusk_right_tip', parent: 'tusk_right', position: [-0.1, 0.3, 0.5] },

    // === Ears (Start -> Tip) ===
    { name: 'ear_left',    parent: 'head',        position: [ 0.4, 0.1, -0.5] },
    { name: 'ear_left_tip', parent: 'ear_left',   position: [ 0.6, -0.6, -0.4] }, // Flop down

    { name: 'ear_right',   parent: 'head',        position: [-0.4, 0.1, -0.5] },
    { name: 'ear_right_tip', parent: 'ear_right', position: [-0.6, -0.6, -0.4] },

    // === Tail ===
    { name: 'tail_base',   parent: 'spine_base', position: [0, 0.3, -0.3] },
    { name: 'tail_mid',    parent: 'tail_base',  position: [0, -0.6, -0.2] }, 
    { name: 'tail_tip',    parent: 'tail_mid',   position: [0, -0.6, 0.0] },

    // === Shoulders/Collarbones ===
    // Moved X from 0.5 -> 0.4 to bury them inside the body
    { name: 'front_left_collarbone',  parent: 'spine_mid', position: [ 0.4, -0.3, 0.3] },
    { name: 'front_right_collarbone', parent: 'spine_mid', position: [-0.4, -0.3, 0.3] },

    // === Hips/Pelvis ===
    // Moved X from 0.5 -> 0.45
    { name: 'back_left_pelvis',  parent: 'spine_base', position: [ 0.45, -0.2, 0.1] },
    { name: 'back_right_pelvis', parent: 'spine_base', position: [-0.45, -0.2, 0.1] },

    // === Front Legs (Thick Columns) ===
    { name: 'front_left_upper',  parent: 'front_left_collarbone', position: [0, -0.8, 0] },
    { name: 'front_left_lower',  parent: 'front_left_upper',      position: [0, -0.8, 0.05] },
    { name: 'front_left_foot',   parent: 'front_left_lower',      position: [0, -0.4, 0.05] },

    { name: 'front_right_upper', parent: 'front_right_collarbone', position: [0, -0.8, 0] },
    { name: 'front_right_lower', parent: 'front_right_upper',      position: [0, -0.8, 0.05] },
    { name: 'front_right_foot',  parent: 'front_right_lower',      position: [0, -0.4, 0.05] },

    // === Back Legs (Thick Columns) ===
    { name: 'back_left_upper',   parent: 'back_left_pelvis',  position: [0, -0.8, 0.05] },
    { name: 'back_left_lower',   parent: 'back_left_upper',   position: [0, -0.8, -0.1] },
    { name: 'back_left_foot',    parent: 'back_left_lower',   position: [0, -0.4, 0.1] },

    { name: 'back_right_upper',  parent: 'back_right_pelvis',  position: [0, -0.8, 0.05] },
    { name: 'back_right_lower',  parent: 'back_right_upper',   position: [0, -0.8, -0.1] },
    { name: 'back_right_foot',   parent: 'back_right_lower',   position: [0, -0.4, 0.1] }
  ],

  sizes: {
    // === MASSIVE BODY RADII ===
    // We increase these to simulate the width of hips/shoulders
    spine_base:   [1.1, 1.1, 1.2], // Huge rump
    spine_mid:    [1.25, 1.35, 1.3], // Huge barrel chest
    spine_neck:   [1.0, 1.1, 1.0], // Thick neck base
    spine_head:   [0.9, 0.95, 0.95], // Neck tip toward the head
    head:         [0.85, 0.95, 0.9], // Large skull

    trunk_anchor: [0.20, 0.20, 0.20],
    trunk_root:   [0.26, 0.26, 0.26],
    trunk_base:   [0.24, 0.24, 0.24],
    trunk_mid1:   [0.23, 0.23, 0.23],
    trunk_mid2:   [0.22, 0.22, 0.22],
    trunk_tip:    [0.20, 0.20, 0.20],

    tusk_left:      [0.10, 0.10, 0.4],
    tusk_left_tip:  [0.02, 0.02, 0.4],
    tusk_right:     [0.10, 0.10, 0.4],
    tusk_right_tip: [0.02, 0.02, 0.4],

    ear_left:      [0.7, 0.7, 0.1],
    ear_left_tip:  [0.6, 0.6, 0.1],
    ear_right:     [0.7, 0.7, 0.1],
    ear_right_tip: [0.6, 0.6, 0.1],

    tail_base:    [0.15, 0.15, 0.30],
    tail_mid:     [0.08, 0.08, 0.30],
    tail_tip:     [0.06, 0.06, 0.20],

    // Thicker Legs
    front_left_upper:  [0.45, 0.45, 0.45],
    front_left_lower:  [0.35, 0.35, 0.35],
    front_left_foot:   [0.38, 0.25, 0.38],

    back_left_upper:   [0.50, 0.50, 0.50],
    back_left_lower:   [0.38, 0.38, 0.38],
    back_left_foot:    [0.38, 0.25, 0.38],

    front_right_upper: [0.45, 0.45, 0.45],
    front_right_lower: [0.35, 0.35, 0.35],
    front_right_foot:  [0.38, 0.25, 0.38],
    back_right_upper:  [0.50, 0.50, 0.50],
    back_right_lower:  [0.38, 0.38, 0.38],
    back_right_foot:   [0.38, 0.25, 0.38],
  }
};