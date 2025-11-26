// src/animals/Gorilla/GorillaDefinition.js

export const GorillaDefinition = {
  bones: [
    // Spine and head
    { name: 'spine_base', parent: 'root', position: [0, 0.9, 0] },
    { name: 'spine_mid', parent: 'spine_base', position: [0, 0.25, 0.2] },
    { name: 'spine_neck', parent: 'spine_mid', position: [0, 0.18, 0.25] },
    { name: 'head', parent: 'spine_neck', position: [0, 0.2, 0.15] },

    // Shoulders and arms (knuckle-walking stance)
    { name: 'shoulder_left', parent: 'spine_mid', position: [0.35, -0.2, 0.05] },
    { name: 'arm_left_upper', parent: 'shoulder_left', position: [0, -0.45, 0.05] },
    { name: 'arm_left_lower', parent: 'arm_left_upper', position: [0, -0.45, 0] },
    { name: 'hand_left', parent: 'arm_left_lower', position: [0, -0.1, 0.12] },

    { name: 'shoulder_right', parent: 'spine_mid', position: [-0.35, -0.2, 0.05] },
    { name: 'arm_right_upper', parent: 'shoulder_right', position: [0, -0.45, 0.05] },
    { name: 'arm_right_lower', parent: 'arm_right_upper', position: [0, -0.45, 0] },
    { name: 'hand_right', parent: 'arm_right_lower', position: [0, -0.1, 0.12] },

    // Hips and legs
    { name: 'hip_left', parent: 'spine_base', position: [0.22, -0.15, -0.1] },
    { name: 'leg_left_upper', parent: 'hip_left', position: [0, -0.5, 0] },
    { name: 'leg_left_lower', parent: 'leg_left_upper', position: [0, -0.45, 0.08] },
    { name: 'foot_left', parent: 'leg_left_lower', position: [0, -0.1, 0.18] },

    { name: 'hip_right', parent: 'spine_base', position: [-0.22, -0.15, -0.1] },
    { name: 'leg_right_upper', parent: 'hip_right', position: [0, -0.5, 0] },
    { name: 'leg_right_lower', parent: 'leg_right_upper', position: [0, -0.45, 0.08] },
    { name: 'foot_right', parent: 'leg_right_lower', position: [0, -0.1, 0.18] }
  ],

  sizes: {
    spine_base: [0.5, 0.55, 0.45],
    spine_mid: [0.55, 0.6, 0.5],
    spine_neck: [0.3, 0.28, 0.25],
    head: [0.32, 0.35, 0.32],

    shoulder_left: [0.28, 0.28, 0.26],
    arm_left_upper: [0.24, 0.24, 0.23],
    arm_left_lower: [0.22, 0.22, 0.2],
    hand_left: [0.16, 0.18, 0.18],

    shoulder_right: [0.28, 0.28, 0.26],
    arm_right_upper: [0.24, 0.24, 0.23],
    arm_right_lower: [0.22, 0.22, 0.2],
    hand_right: [0.16, 0.18, 0.18],

    hip_left: [0.28, 0.28, 0.26],
    leg_left_upper: [0.27, 0.27, 0.25],
    leg_left_lower: [0.24, 0.24, 0.22],
    foot_left: [0.2, 0.2, 0.22],

    hip_right: [0.28, 0.28, 0.26],
    leg_right_upper: [0.27, 0.27, 0.25],
    leg_right_lower: [0.24, 0.24, 0.22],
    foot_right: [0.2, 0.2, 0.22]
  }
};
