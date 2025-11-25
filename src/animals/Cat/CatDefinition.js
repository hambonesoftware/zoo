// src/animals/CatDefinition.js

import * as THREE from 'three';

/**
 * CatDefinition:
 * - Updated for Feline proportions:
 * - Legs are longer and positioned under the body (narrower stance).
 * - Spine is arched and shorter.
 * - Tail is longer.
 * - Head is higher.
 */

export const CatDefinition = {
  bones: [
    // === Main Body Chain ===
    // Lift spine_base (hips) off the floor (Y=0.35) so the cat stands
    { name: 'spine_base',  parent: 'root',       position: [0, 0.35, 0] }, 
    // Spine mid (ribcage) - slightly arched up
    { name: 'spine_mid',   parent: 'spine_base', position: [0, 0.05, 0.45] },
    // Spine neck (shoulder/neck base) - angled up
    { name: 'spine_neck',  parent: 'spine_mid',  position: [0, 0.15, 0.35] },
    // Head - positioned forward and up from neck
    { name: 'head',        parent: 'spine_neck', position: [0, 0.10, 0.20] },

    // === Tail ===
    // Cats have tails starting higher on the rump
    { name: 'tail_base',   parent: 'spine_base', position: [0, 0.10, -0.15] },
    { name: 'tail_mid',    parent: 'tail_base',  position: [0, 0.05, -0.35] }, // Longer segment
    { name: 'tail_tip',    parent: 'tail_mid',   position: [0, 0.02, -0.35] }, // Longer segment

    // === Collarbones (Shoulders) ===
    // Narrower X offsets compared to lizard (legs under body)
    { name: 'front_left_collarbone',  parent: 'spine_mid', position: [ 0.09, -0.05, 0.10] },
    { name: 'front_right_collarbone', parent: 'spine_mid', position: [-0.09, -0.05, 0.10] },

    // === Hips/Pelvis ===
    // Narrower X offsets
    { name: 'back_left_pelvis',  parent: 'spine_base', position: [ 0.09, -0.02, 0.05] },
    { name: 'back_right_pelvis', parent: 'spine_base', position: [-0.09, -0.02, 0.05] },

    // === Front Left Leg ===
    // Longer upper/lower legs to reach ground from new height
    { name: 'front_left_upper_leg',  parent: 'front_left_collarbone', position: [0, -0.18, 0] },
    { name: 'front_left_lower_leg',  parent: 'front_left_upper_leg',  position: [0, -0.16, 0.02] },
    { name: 'front_left_paw',        parent: 'front_left_lower_leg',  position: [0, -0.12, 0.03] },

    // === Front Right Leg ===
    { name: 'front_right_upper_leg',  parent: 'front_right_collarbone', position: [0, -0.18, 0] },
    { name: 'front_right_lower_leg',  parent: 'front_right_upper_leg',  position: [0, -0.16, 0.02] },
    { name: 'front_right_paw',        parent: 'front_right_lower_leg',  position: [0, -0.12, 0.03] },

    // === Back Left Leg ===
    // Back legs often have a sharp angle at the hock (upper leg angles back, lower angles forward)
    { name: 'back_left_upper_leg',  parent: 'back_left_pelvis',  position: [0, -0.20, -0.05] },
    { name: 'back_left_lower_leg',  parent: 'back_left_upper_leg', position: [0, -0.22, 0.05] },
    { name: 'back_left_paw',        parent: 'back_left_lower_leg', position: [0, -0.10, 0.03] },

    // === Back Right Leg ===
    { name: 'back_right_upper_leg',  parent: 'back_right_pelvis',  position: [0, -0.20, -0.05] },
    { name: 'back_right_lower_leg',  parent: 'back_right_upper_leg', position: [0, -0.22, 0.05] },
    { name: 'back_right_paw',        parent: 'back_right_lower_leg', position: [0, -0.10, 0.03] }
  ],

  sizes: {
    // Main body - Deep chest, thinner waist
    spine_base:   [0.25, 0.25, 0.30], // Hips
    spine_mid:    [0.26, 0.32, 0.35], // Ribcage (Deep vertical)
    spine_neck:   [0.18, 0.20, 0.20], // Neck base
    head:         [0.22, 0.20, 0.22], // Rounder head

    // Tail - thicker at base
    tail_base:    [0.10, 0.10, 0.25],
    tail_mid:     [0.08, 0.08, 0.25],
    tail_tip:     [0.06, 0.06, 0.15],

    // Shoulders/Hips
    front_left_collarbone: [0.10, 0.10, 0.10],
    front_right_collarbone: [0.10, 0.10, 0.10],
    back_left_pelvis:      [0.11, 0.11, 0.11],
    back_right_pelvis:     [0.11, 0.11, 0.11],

    // Limbs - More muscular upper, thinner lower
    front_left_upper_leg:  [0.09, 0.14, 0.09],
    front_left_lower_leg:  [0.07, 0.12, 0.07],
    front_left_paw:        [0.08, 0.04, 0.09],

    front_right_upper_leg: [0.09, 0.14, 0.09],
    front_right_lower_leg: [0.07, 0.12, 0.07],
    front_right_paw:       [0.08, 0.04, 0.09],

    back_left_upper_leg:   [0.12, 0.16, 0.12], // Thighs are thicker
    back_left_lower_leg:   [0.07, 0.13, 0.07],
    back_left_paw:         [0.08, 0.04, 0.09],

    back_right_upper_leg:  [0.12, 0.16, 0.12],
    back_right_lower_leg:  [0.07, 0.13, 0.07],
    back_right_paw:        [0.08, 0.04, 0.09]
  }
};