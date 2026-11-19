/**
 * Realistic 3D Rigged Character System (Mixamo GLB + Deterministic AnimationMixer).
 *
 * Supports two unnamed realistic 3D characters (never show or say a name on screen):
 *   - THE MAN   (assets/characters/man.glb + man_*.glb clips)
 *   - THE WOMAN (assets/characters/woman.glb + woman_*.glb clips)
 *
 * Deterministic Rules:
 *   - Drives THREE.AnimationMixer purely from time t via mixer.setTime(...)
 *   - Smooth 0.3 s crossfade between clips by blending two action weights directly from t
 *   - Automatically detects jaw/mouth morph targets and animates them deterministically while speaking
 *   - Grounds characters strictly on y = 0 via bounding-box alignment; casts/receives soft PCFSoft shadows
 *   - If any .glb file is missing, renders a neutral grey articulated 3D stand-in mannequin
 *     with full procedural pose animation and logs a warning (never crashes).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, lerp } from './prng';

export type Character3DId = 'man' | 'woman';

export type ManClipName =
  | 'idle'
  | 'talking'
  | 'surprised'
  | 'shrugging'
  | 'cheering'
  | 'walking'
  | 'looking';

export type WomanClipName = 'idle' | 'talking' | 'pointing' | 'walking' | 'typing';

export type Clip3DName = ManClipName | WomanClipName;

export interface Character3DAssetSpec {
  key: string;
  character: Character3DId;
  clip: Clip3DName | 'rig';
  fileName: string;
  label: string;
  description: string;
}

export const CHARACTER_3D_SPECS: readonly Character3DAssetSpec[] = [
  {
    key: 'man',
    character: 'man',
    clip: 'rig',
    fileName: 'man.glb',
    label: 'The Man (Base Rig)',
    description: 'Adult man, late 20s, yellow hoodie & red cap (Mixamo FBX With Skin → GLB)',
  },
  {
    key: 'man_idle',
    character: 'man',
    clip: 'idle',
    fileName: 'man_idle.glb',
    label: 'Idle',
    description: 'Relaxed standing idle pose',
  },
  {
    key: 'man_talking',
    character: 'man',
    clip: 'talking',
    fileName: 'man_talking.glb',
    label: 'Talking',
    description: 'Conversational talking gesture with subtle head nod',
  },
  {
    key: 'man_surprised',
    character: 'man',
    clip: 'surprised',
    fileName: 'man_surprised.glb',
    label: 'Surprised',
    description: 'Startled reaction pose',
  },
  {
    key: 'man_shrugging',
    character: 'man',
    clip: 'shrugging',
    fileName: 'man_shrugging.glb',
    label: 'Shrugging',
    description: 'Questioning shrug while holding the $100 bill',
  },
  {
    key: 'man_cheering',
    character: 'man',
    clip: 'cheering',
    fileName: 'man_cheering.glb',
    label: 'Cheering',
    description: 'Laughing & celebrating with the crisp new $100 bill',
  },
  {
    key: 'man_walking',
    character: 'man',
    clip: 'walking',
    fileName: 'man_walking.glb',
    label: 'Walking',
    description: 'Natural stride walking up to the street ATM',
  },
  {
    key: 'man_looking',
    character: 'man',
    clip: 'looking',
    fileName: 'man_looking.glb',
    label: 'Looking',
    description: 'Inspecting the newly dispensed $100 note',
  },
  {
    key: 'woman',
    character: 'woman',
    clip: 'rig',
    fileName: 'woman.glb',
    label: 'The Woman (Base Rig)',
    description: 'Adult woman, late 20s, teal sweater & ponytail (Mixamo FBX With Skin → GLB)',
  },
  {
    key: 'woman_idle',
    character: 'woman',
    clip: 'idle',
    fileName: 'woman_idle.glb',
    label: 'Idle',
    description: 'Poised standing idle pose',
  },
  {
    key: 'woman_talking',
    character: 'woman',
    clip: 'talking',
    fileName: 'woman_talking.glb',
    label: 'Talking',
    description: 'Confident explanation gesture',
  },
  {
    key: 'woman_pointing',
    character: 'woman',
    clip: 'pointing',
    fileName: 'woman_pointing.glb',
    label: 'Pointing',
    description: 'Pointing toward Store, Bank & Government buildings',
  },
  {
    key: 'woman_walking',
    character: 'woman',
    clip: 'walking',
    fileName: 'woman_walking.glb',
    label: 'Walking',
    description: 'Walking into frame beside the man at dusk',
  },
  {
    key: 'woman_typing',
    character: 'woman',
    clip: 'typing',
    fileName: 'woman_typing.glb',
    label: 'Typing',
    description: 'Typing a new $10,000 loan balance at the banker desk (falls back to idle if missing)',
  },
];

export type HeldPropKind = 'none' | 'note' | 'phone' | 'letter';

export interface Character3DPoseRequest {
  clip: Clip3DName;
  clipStart: number;
  prevClip?: Clip3DName;
  prevClipStart?: number;
  crossfadeDuration?: number;
  isSpeaking?: boolean;
  holdingNote?: boolean;
  holdingProp?: HeldPropKind;
}

interface MannequinJoints {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  mouth: THREE.Mesh;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  ponytail?: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  rightHandAnchor: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
}

interface ProceduralPoseAngles {
  hipsY: number;
  hipsRotY: number;
  spineRotX: number;
  spineRotY: number;
  spineRotZ: number;
  headRotX: number;
  headRotY: number;
  headRotZ: number;
  lShoulderX: number;
  lShoulderZ: number;
  lElbowX: number;
  rShoulderX: number;
  rShoulderZ: number;
  rElbowX: number;
  lHipX: number;
  lKneeX: number;
  rHipX: number;
  rKneeX: number;
}

/**
 * Builds sculpted, expressive 3D Jordan (yellow hoodie, red baseball cap, dark jeans, sneakers)
 * or 3D Maya (teal sweater, sleek dark hair with swaying ponytail, dark tailored pants, boots).
 * Strictly grounded on y = 0 with full articulated skeleton, blinking eyes, and talking mouth.
 */
function buildStyled3DCharacter(id: Character3DId, heightM: number): MannequinJoints {
  const isMaya = id === 'woman';
  const scale = heightM / 1.78;
  const wScale = isMaya ? 0.86 : 1.0;
  const root = new THREE.Group();

  // Character-matched PBR materials (Jordan vs Maya)
  const skinMat = new THREE.MeshStandardMaterial({
    color: isMaya ? 0xe6af8a : 0xc9895b,
    roughness: 0.52,
    metalness: 0.03,
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: isMaya ? 0x1ca89a : 0xf2c130, // Maya: teal sweater | Jordan: yellow hoodie
    roughness: 0.68,
    metalness: 0.04,
  });
  const topTrimMat = new THREE.MeshStandardMaterial({
    color: isMaya ? 0x5cf2d0 : 0xd9a116, // Ribbed cuffs / collar trim
    roughness: 0.6,
    metalness: 0.05,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: isMaya ? 0x1c2333 : 0x22304a, // Tailored charcoal pants | Indigo denim jeans
    roughness: 0.78,
    metalness: 0.04,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: isMaya ? 0x171b24 : 0xf2f4f8, // Dark boots | Crisp sneakers
    roughness: 0.42,
    metalness: 0.08,
  });
  const shoeAccentMat = new THREE.MeshStandardMaterial({
    color: isMaya ? 0x3b4454 : 0xd92d44, // Jordan red sneaker trim
    roughness: 0.45,
    metalness: 0.06,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: isMaya ? 0x181d2c : 0x1a1715,
    roughness: 0.54,
    metalness: 0.08,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xd92d44, // Jordan's signature red baseball cap
    roughness: 0.56,
    metalness: 0.05,
  });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfafcff, roughness: 0.2, metalness: 0.02 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.12, metalness: 0.1 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: isMaya ? 0xb5535d : 0x6b2c2a, roughness: 0.45 });

  const makeMesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // Hips / pelvis at anatomical height ~0.94m
  const hips = new THREE.Group();
  hips.position.set(0, 0.94 * scale, 0);
  root.add(hips);

  const pelvis = makeMesh(
    new THREE.CapsuleGeometry(0.135 * wScale * scale, 0.09 * scale, 10, 18),
    pantsMat,
  );
  pelvis.scale.set(1.22, 0.92, 0.84);
  hips.add(pelvis);

  // Waistband / sweater hem
  const hem = makeMesh(
    new THREE.CylinderGeometry(0.168 * wScale * scale, 0.162 * wScale * scale, 0.085 * scale, 20),
    topTrimMat,
  );
  hem.scale.set(1.16, 1, 0.78);
  hem.position.set(0, 0.075 * scale, 0);
  hips.add(hem);

  // Spine + Torso (Yellow Hoodie for Jordan / Teal Sweater for Maya)
  const spine = new THREE.Group();
  spine.position.set(0, 0.1 * scale, 0);
  hips.add(spine);

  const torso = makeMesh(
    new THREE.CapsuleGeometry(0.168 * wScale * scale, 0.28 * scale, 12, 20),
    topMat,
  );
  torso.position.set(0, 0.24 * scale, 0);
  torso.scale.set(1.24, 1.0, 0.8);
  spine.add(torso);

  if (!isMaya) {
    // Jordan's hoodie details: kangaroo pocket, hood resting behind collar, drawstrings
    const pocket = makeMesh(
      new THREE.BoxGeometry(0.24 * scale, 0.13 * scale, 0.04 * scale),
      topTrimMat,
    );
    pocket.position.set(0, 0.09 * scale, 0.132 * scale);
    spine.add(pocket);

    const hoodCollar = makeMesh(
      new THREE.TorusGeometry(0.115 * scale, 0.042 * scale, 12, 20),
      topMat,
    );
    hoodCollar.rotation.x = Math.PI / 2 + 0.22;
    hoodCollar.position.set(0, 0.44 * scale, -0.025 * scale);
    spine.add(hoodCollar);

    const cordMat = new THREE.MeshStandardMaterial({ color: 0x1b202b, roughness: 0.6 });
    for (const sx of [-0.042, 0.042]) {
      const cord = makeMesh(
        new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, 0.17 * scale, 8),
        cordMat,
      );
      cord.position.set(sx * scale, 0.34 * scale, 0.145 * scale);
      spine.add(cord);
    }
  } else {
    // Maya's sweater neckline & soft ribbed collar + subtle inner white crew layer
    const innerCollar = makeMesh(
      new THREE.TorusGeometry(0.088 * scale, 0.024 * scale, 10, 18),
      new THREE.MeshStandardMaterial({ color: 0xeefaf7, roughness: 0.55 }),
    );
    innerCollar.rotation.x = Math.PI / 2 + 0.12;
    innerCollar.position.set(0, 0.45 * scale, 0.01 * scale);
    spine.add(innerCollar);

    const knitNeck = makeMesh(
      new THREE.TorusGeometry(0.102 * scale, 0.03 * scale, 10, 18),
      topTrimMat,
    );
    knitNeck.rotation.x = Math.PI / 2 + 0.15;
    knitNeck.position.set(0, 0.43 * scale, 0.005 * scale);
    spine.add(knitNeck);
  }

  // Neck & Head
  const head = new THREE.Group();
  head.position.set(0, 0.48 * scale, 0);
  spine.add(head);

  const neck = makeMesh(
    new THREE.CylinderGeometry(0.048 * scale, 0.056 * scale, 0.11 * scale, 16),
    skinMat,
  );
  neck.position.set(0, 0.04 * scale, 0);
  head.add(neck);

  const cranium = makeMesh(
    new THREE.SphereGeometry(0.118 * scale, 24, 20),
    skinMat,
  );
  cranium.position.set(0, 0.165 * scale, 0.008 * scale);
  cranium.scale.set(0.88, 1.1, 0.96);
  head.add(cranium);

  // Sculpted ears
  for (const side of [-1, 1]) {
    const ear = makeMesh(new THREE.SphereGeometry(0.024 * scale, 10, 10), skinMat);
    ear.scale.set(0.55, 1.15, 0.78);
    ear.position.set(side * 0.104 * scale, 0.16 * scale, 0.0 * scale);
    head.add(ear);
  }

  // Sculpted nose
  const nose = makeMesh(new THREE.SphereGeometry(0.019 * scale, 12, 10), skinMat);
  nose.scale.set(0.82, 1.15, 1.25);
  nose.position.set(0, 0.152 * scale, 0.118 * scale);
  head.add(nose);

  // Expressive Eyes (with sclera, dark iris, specular catchlight & eyebrows)
  const buildEye = (side: -1 | 1) => {
    const eyeGrp = new THREE.Group();
    eyeGrp.position.set(side * 0.04 * scale, 0.184 * scale, 0.1 * scale);
    head.add(eyeGrp);

    const sclera = makeMesh(new THREE.SphereGeometry(0.02 * scale, 12, 10), eyeWhiteMat);
    sclera.scale.set(1.0, 0.92, 0.65);
    eyeGrp.add(sclera);

    const iris = makeMesh(new THREE.SphereGeometry(0.0115 * scale, 10, 10), irisMat);
    iris.position.set(0, 0, 0.011 * scale);
    eyeGrp.add(iris);

    const catchlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.0038 * scale, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    catchlight.position.set(0.004 * scale, 0.004 * scale, 0.02 * scale);
    eyeGrp.add(catchlight);

    const brow = makeMesh(
      new THREE.BoxGeometry(0.044 * scale, 0.011 * scale, 0.014 * scale),
      hairMat,
    );
    brow.position.set(side * 0.04 * scale, 0.214 * scale, 0.105 * scale);
    brow.rotation.z = side * (isMaya ? -0.08 : -0.05);
    head.add(brow);

    return eyeGrp;
  };

  const leftEye = buildEye(-1);
  const rightEye = buildEye(1);

  // Animated 3D Mouth (scales vertically when speaking!)
  const mouth = makeMesh(
    new THREE.CapsuleGeometry(0.012 * scale, 0.028 * scale, 6, 10),
    mouthMat,
  );
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, 0.112 * scale, 0.106 * scale);
  mouth.scale.set(0.75, 1.0, 0.65);
  head.add(mouth);

  let ponytail: THREE.Group | undefined;

  if (!isMaya) {
    // Jordan: dark fade hair under his signature RED BASEBALL CAP
    const hairBack = makeMesh(new THREE.SphereGeometry(0.118 * scale, 18, 14), hairMat);
    hairBack.scale.set(0.92, 0.92, 0.96);
    hairBack.position.set(0, 0.185 * scale, -0.014 * scale);
    head.add(hairBack);

    const capDome = makeMesh(
      new THREE.SphereGeometry(0.124 * scale, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
      capMat,
    );
    capDome.scale.set(0.94, 1.04, 1.02);
    capDome.position.set(0, 0.2 * scale, 0.002 * scale);
    capDome.rotation.x = -0.14;
    head.add(capDome);

    // Curved front red cap visor brim
    const brim = makeMesh(
      new THREE.CylinderGeometry(0.118 * scale, 0.125 * scale, 0.016 * scale, 20, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
      capMat,
    );
    brim.position.set(0, 0.218 * scale, 0.085 * scale);
    brim.rotation.x = 0.08;
    head.add(brim);

    const capBtn = makeMesh(new THREE.SphereGeometry(0.014 * scale, 10, 8), capMat);
    capBtn.position.set(0, 0.326 * scale, -0.015 * scale);
    head.add(capBtn);
  } else {
    // Maya: sleek dark hair crown, side-swept bangs & animated back PONYTAIL with teal hairband
    const hairCrown = makeMesh(new THREE.SphereGeometry(0.126 * scale, 22, 18), hairMat);
    hairCrown.scale.set(0.93, 1.06, 1.02);
    hairCrown.position.set(0, 0.195 * scale, -0.014 * scale);
    head.add(hairCrown);

    // Side-swept bangs framing forehead
    const bangL = makeMesh(new THREE.CapsuleGeometry(0.036 * scale, 0.085 * scale, 8, 12), hairMat);
    bangL.position.set(-0.068 * scale, 0.228 * scale, 0.072 * scale);
    bangL.rotation.set(0.28, 0.25, 0.65);
    head.add(bangL);

    const bangR = makeMesh(new THREE.CapsuleGeometry(0.034 * scale, 0.075 * scale, 8, 12), hairMat);
    bangR.position.set(0.068 * scale, 0.225 * scale, 0.07 * scale);
    bangR.rotation.set(0.25, -0.25, -0.6);
    head.add(bangR);

    // Animated Ponytail group anchored at back of head
    ponytail = new THREE.Group();
    ponytail.position.set(0, 0.195 * scale, -0.118 * scale);
    head.add(ponytail);

    const hairTie = makeMesh(
      new THREE.TorusGeometry(0.034 * scale, 0.012 * scale, 10, 16),
      topTrimMat,
    );
    hairTie.rotation.x = Math.PI / 2;
    ponytail.add(hairTie);

    const tailUpper = makeMesh(
      new THREE.CapsuleGeometry(0.044 * scale, 0.15 * scale, 10, 14),
      hairMat,
    );
    tailUpper.position.set(0, -0.085 * scale, -0.04 * scale);
    tailUpper.rotation.x = -0.32;
    ponytail.add(tailUpper);

    const tailLower = makeMesh(
      new THREE.ConeGeometry(0.042 * scale, 0.18 * scale, 12),
      hairMat,
    );
    tailLower.rotation.x = Math.PI;
    tailLower.position.set(0, -0.22 * scale, -0.07 * scale);
    ponytail.add(tailLower);
  }

  // Shoulders & Sleeved Arms with Skin Hands
  const shoulderX = 0.228 * wScale * scale;
  const shoulderY = 0.41 * scale;

  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, shoulderY, 0);
    spine.add(shoulder);

    shoulder.add(makeMesh(new THREE.SphereGeometry(0.062 * scale, 14, 12), topMat));

    const upperArm = makeMesh(
      new THREE.CapsuleGeometry(0.05 * wScale * scale, 0.22 * scale, 10, 14),
      topMat,
    );
    upperArm.position.set(0, -0.15 * scale, 0);
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.3 * scale, 0);
    shoulder.add(elbow);

    elbow.add(makeMesh(new THREE.SphereGeometry(0.046 * scale, 12, 10), topMat));

    const forearm = makeMesh(
      new THREE.CapsuleGeometry(0.043 * wScale * scale, 0.19 * scale, 10, 14),
      topMat,
    );
    forearm.position.set(0, -0.13 * scale, 0);
    elbow.add(forearm);

    const cuff = makeMesh(
      new THREE.CylinderGeometry(0.045 * wScale * scale, 0.04 * wScale * scale, 0.042 * scale, 14),
      topTrimMat,
    );
    cuff.position.set(0, -0.245 * scale, 0);
    elbow.add(cuff);

    const handAnchor = new THREE.Group();
    handAnchor.position.set(0, -0.28 * scale, 0);
    elbow.add(handAnchor);

    const hand = makeMesh(
      new THREE.SphereGeometry(0.044 * scale, 12, 10),
      skinMat,
    );
    hand.scale.set(0.75, 1.15, 0.92);
    hand.position.set(0, -0.038 * scale, 0.01 * scale);
    handAnchor.add(hand);

    return { shoulder, elbow, handAnchor };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Legs (Jeans / Tailored Pants + Sneakers / Boots grounded strictly at y = 0)
  const hipX = 0.105 * wScale * scale;
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * hipX, -0.04 * scale, 0);
    hips.add(hip);

    hip.add(makeMesh(new THREE.SphereGeometry(0.068 * scale, 14, 12), pantsMat));

    const thigh = makeMesh(
      new THREE.CapsuleGeometry(0.072 * wScale * scale, 0.34 * scale, 10, 16),
      pantsMat,
    );
    thigh.position.set(0, -0.22 * scale, 0);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44 * scale, 0);
    hip.add(knee);

    knee.add(makeMesh(new THREE.SphereGeometry(0.056 * scale, 12, 10), pantsMat));

    const calf = makeMesh(
      new THREE.CapsuleGeometry(0.056 * wScale * scale, 0.34 * scale, 10, 16),
      pantsMat,
    );
    calf.position.set(0, -0.22 * scale, 0);
    knee.add(calf);

    const shoe = makeMesh(
      new THREE.BoxGeometry(0.1 * scale, 0.074 * scale, 0.23 * scale),
      shoeMat,
    );
    shoe.position.set(0, -0.43 * scale, 0.048 * scale);
    knee.add(shoe);

    const sole = makeMesh(
      new THREE.BoxGeometry(0.104 * scale, 0.024 * scale, 0.236 * scale),
      shoeAccentMat,
    );
    sole.position.set(0, -0.46 * scale, 0.048 * scale);
    knee.add(sole);

    return { hip, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Ensure exact floor alignment (feet bottom strictly at y = 0)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) {
    hips.position.y -= box.min.y;
  }

  return {
    root,
    hips,
    spine,
    head,
    mouth,
    leftEye,
    rightEye,
    ponytail,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    rightHandAnchor: rightArm.handAnchor,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
  };
}

function evalMannequinPose(
  clip: Clip3DName,
  localT: number,
  holdingNote: boolean,
): ProceduralPoseAngles {
  const w = Math.max(0, localT);
  const breath = Math.sin(w * 2.1) * 0.015;

  const base: ProceduralPoseAngles = {
    hipsY: 0,
    hipsRotY: Math.sin(w * 0.9) * 0.04,
    spineRotX: breath,
    spineRotY: 0,
    spineRotZ: Math.sin(w * 1.1) * 0.02,
    headRotX: Math.sin(w * 1.4) * 0.04,
    headRotY: Math.sin(w * 0.85) * 0.06,
    headRotZ: 0,
    lShoulderX: 0.08,
    lShoulderZ: -0.1,
    lElbowX: -0.22,
    rShoulderX: holdingNote ? -0.95 : 0.08,
    rShoulderZ: holdingNote ? 0.14 : 0.1,
    rElbowX: holdingNote ? -0.85 : -0.22,
    lHipX: 0,
    lKneeX: 0.04,
    rHipX: 0,
    rKneeX: 0.04,
  };

  if (clip === 'walking') {
    const stride = w * 5.6;
    const s = Math.sin(stride);
    const c = Math.cos(stride);
    base.hipsY = Math.abs(s) * 0.032;
    base.hipsRotY = s * 0.09;
    base.spineRotX = 0.06;
    base.spineRotY = -s * 0.08;
    base.lHipX = s * 0.48;
    base.lKneeX = Math.max(0, -c * 0.55) + 0.06;
    base.rHipX = -s * 0.48;
    base.rKneeX = Math.max(0, c * 0.55) + 0.06;
    base.lShoulderX = -s * 0.42;
    base.lElbowX = -0.32 - Math.max(0, s) * 0.2;
    base.rShoulderX = holdingNote ? -0.82 : s * 0.42;
    base.rElbowX = holdingNote ? -0.78 : -0.32 - Math.max(0, -s) * 0.2;
    return base;
  }

  if (clip === 'looking') {
    base.spineRotX = 0.05;
    base.headRotX = 0.16 + Math.sin(w * 2.2) * 0.04;
    base.headRotY = 0.18 + Math.sin(w * 1.3) * 0.08;
    base.rShoulderX = -1.05;
    base.rShoulderZ = 0.08;
    base.rElbowX = -1.08 + Math.sin(w * 1.9) * 0.05;
    base.lShoulderX = -0.35;
    base.lElbowX = -0.6;
    return base;
  }

  if (clip === 'shrugging') {
    const shrugPulse = 0.55 + 0.45 * Math.sin(w * 3.1);
    base.spineRotX = -0.04;
    base.headRotZ = 0.12 * Math.sin(w * 2.4);
    base.headRotY = Math.sin(w * 1.8) * 0.14;
    base.lShoulderX = -0.58 - shrugPulse * 0.22;
    base.lShoulderZ = -0.42 - shrugPulse * 0.16;
    base.lElbowX = -1.15;
    base.rShoulderX = holdingNote ? -1.12 : -0.62 - shrugPulse * 0.22;
    base.rShoulderZ = holdingNote ? 0.24 : 0.42 + shrugPulse * 0.16;
    base.rElbowX = holdingNote ? -0.85 : -1.15;
    return base;
  }

  if (clip === 'talking') {
    const g1 = Math.sin(w * 4.2);
    const g2 = Math.cos(w * 3.1);
    base.spineRotY = g2 * 0.07;
    base.headRotX = Math.sin(w * 5.2) * 0.07;
    base.headRotY = g2 * 0.11;
    base.lShoulderX = -0.48 + g1 * 0.22;
    base.lShoulderZ = -0.22;
    base.lElbowX = -0.95 + g2 * 0.2;
    base.rShoulderX = holdingNote ? -1.02 + g1 * 0.08 : -0.54 - g1 * 0.24;
    base.rShoulderZ = holdingNote ? 0.18 : 0.24;
    base.rElbowX = holdingNote ? -0.92 : -1.05 - g2 * 0.18;
    return base;
  }

  if (clip === 'pointing') {
    const sweep = Math.sin(w * 2.1) * 0.18;
    base.spineRotY = -0.22 + sweep * 0.4;
    base.headRotY = 0.14 + sweep * 0.3;
    base.rShoulderX = -1.48;
    base.rShoulderZ = 0.26 + sweep;
    base.rElbowX = -0.14;
    base.lShoulderX = -0.35;
    base.lShoulderZ = -0.18;
    base.lElbowX = -0.82;
    return base;
  }

  if (clip === 'cheering') {
    const bounce = Math.abs(Math.sin(w * 6.4));
    base.hipsY = bounce * 0.06;
    base.spineRotX = -0.08;
    base.headRotX = -0.1 + Math.sin(w * 6.4) * 0.08;
    base.lShoulderX = -2.25 + Math.sin(w * 6.4) * 0.28;
    base.lShoulderZ = -0.38;
    base.lElbowX = -0.45 + bounce * 0.25;
    base.rShoulderX = -2.15 - Math.sin(w * 6.4) * 0.24;
    base.rShoulderZ = 0.38;
    base.rElbowX = -0.48 + bounce * 0.22;
    base.lHipX = -bounce * 0.12;
    base.lKneeX = bounce * 0.22;
    base.rHipX = -bounce * 0.12;
    base.rKneeX = bounce * 0.22;
    return base;
  }

  if (clip === 'surprised') {
    base.spineRotX = -0.12;
    base.headRotX = -0.08;
    base.lShoulderX = -1.15;
    base.lShoulderZ = -0.45;
    base.lElbowX = -1.25;
    base.rShoulderX = -1.15;
    base.rShoulderZ = 0.45;
    base.rElbowX = -1.25;
    return base;
  }

  if (clip === 'typing') {
    const tapL = Math.sin(w * 15.0) * 0.11;
    const tapR = Math.cos(w * 16.5) * 0.11;
    base.spineRotX = 0.08;
    base.headRotX = 0.22 + Math.sin(w * 2.4) * 0.03;
    base.headRotY = Math.sin(w * 1.6) * 0.06;
    base.lShoulderX = -0.78 + tapL * 0.35;
    base.lShoulderZ = -0.14;
    base.lElbowX = -1.28 + tapL;
    base.rShoulderX = -0.78 + tapR * 0.35;
    base.rShoulderZ = 0.14;
    base.rElbowX = -1.28 + tapR;
    return base;
  }

  return base;
}

function lerpPose(a: ProceduralPoseAngles, b: ProceduralPoseAngles, k: number): ProceduralPoseAngles {
  return {
    hipsY: lerp(a.hipsY, b.hipsY, k),
    hipsRotY: lerp(a.hipsRotY, b.hipsRotY, k),
    spineRotX: lerp(a.spineRotX, b.spineRotX, k),
    spineRotY: lerp(a.spineRotY, b.spineRotY, k),
    spineRotZ: lerp(a.spineRotZ, b.spineRotZ, k),
    headRotX: lerp(a.headRotX, b.headRotX, k),
    headRotY: lerp(a.headRotY, b.headRotY, k),
    headRotZ: lerp(a.headRotZ, b.headRotZ, k),
    lShoulderX: lerp(a.lShoulderX, b.lShoulderX, k),
    lShoulderZ: lerp(a.lShoulderZ, b.lShoulderZ, k),
    lElbowX: lerp(a.lElbowX, b.lElbowX, k),
    rShoulderX: lerp(a.rShoulderX, b.rShoulderX, k),
    rShoulderZ: lerp(a.rShoulderZ, b.rShoulderZ, k),
    rElbowX: lerp(a.rElbowX, b.rElbowX, k),
    lHipX: lerp(a.lHipX, b.lHipX, k),
    lKneeX: lerp(a.lKneeX, b.lKneeX, k),
    rHipX: lerp(a.rHipX, b.rHipX, k),
    rKneeX: lerp(a.rKneeX, b.rKneeX, k),
  };
}

interface MorphTargetBinding {
  mesh: THREE.Mesh;
  index: number;
}

export class RealisticCharacter3D {
  public readonly id: Character3DId;
  public readonly targetHeight: number;
  public readonly container: THREE.Group;
  private readonly mannequin: MannequinJoints;
  private readonly baseHipsY: number;
  private glbRoot: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<Clip3DName, THREE.AnimationAction>();
  private jawMorphs: MorphTargetBinding[] = [];
  private headBone: THREE.Object3D | null = null;
  private rightHandBone: THREE.Object3D | null = null;
  private heldNoteMesh: THREE.Mesh | null = null;
  private heldPhoneMesh: THREE.Group | null = null;
  private heldLetterMesh: THREE.Mesh | null = null;
  private loadedClipKeys = new Set<string>();
  public usingGlbRig = false;

  constructor(id: Character3DId, heldNoteTexture?: THREE.Texture) {
    this.id = id;
    this.targetHeight = id === 'man' ? 1.78 : 1.68;
    this.container = new THREE.Group();
    this.container.name = `char3d_${id}`;

    this.mannequin = buildStyled3DCharacter(id, this.targetHeight);
    this.baseHipsY = this.mannequin.hips.position.y;
    this.container.add(this.mannequin.root);

    if (heldNoteTexture) {
      const mat = new THREE.MeshStandardMaterial({
        map: heldNoteTexture,
        roughness: 0.42,
        metalness: 0.08,
        side: THREE.DoubleSide,
      });
      this.heldNoteMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.105), mat);
      this.heldNoteMesh.position.set(0.02, -0.06, 0.07);
      this.heldNoteMesh.rotation.set(0.15, -0.2, 0.12);
      this.heldNoteMesh.castShadow = true;
      this.heldNoteMesh.visible = false;
      this.mannequin.rightHandAnchor.add(this.heldNoteMesh);
    }

    // Handheld smartphone prop (for loan payment / banking scenes)
    const phoneGrp = new THREE.Group();
    const phoneBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.088, 0.175, 0.014),
      new THREE.MeshStandardMaterial({ color: 0x161b26, roughness: 0.25, metalness: 0.78 }),
    );
    const phoneScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.078, 0.16),
      new THREE.MeshStandardMaterial({
        color: 0x0e1d26,
        emissive: 0x22e07a,
        emissiveIntensity: 0.9,
        roughness: 0.18,
      }),
    );
    phoneScreen.position.z = 0.008;
    phoneGrp.add(phoneBody, phoneScreen);
    phoneGrp.position.set(0.015, -0.055, 0.065);
    phoneGrp.rotation.set(-0.45, -0.18, 0.08);
    phoneGrp.visible = false;
    this.heldPhoneMesh = phoneGrp;
    this.mannequin.rightHandAnchor.add(phoneGrp);

    // Handheld "PAID IN FULL" letter prop
    const letterCanvas = document.createElement('canvas');
    letterCanvas.width = 256;
    letterCanvas.height = 320;
    const lctx = letterCanvas.getContext('2d')!;
    lctx.fillStyle = '#F2EFE6';
    lctx.fillRect(0, 0, 256, 320);
    lctx.fillStyle = '#1D273B';
    lctx.fillRect(24, 28, 208, 22);
    lctx.fillStyle = '#9BA4B5';
    for (let y = 76; y <= 148; y += 22) {
      lctx.fillRect(24, y, y === 148 ? 140 : 208, 10);
    }
    lctx.strokeStyle = '#22E07A';
    lctx.lineWidth = 8;
    lctx.strokeRect(24, 186, 208, 74);
    lctx.fillStyle = '#109A50';
    lctx.font = '800 28px "Poppins", sans-serif';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText('PAID IN FULL', 128, 223);
    const letterTex = new THREE.CanvasTexture(letterCanvas);
    letterTex.colorSpace = THREE.SRGBColorSpace;
    this.heldLetterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.28),
      new THREE.MeshStandardMaterial({ map: letterTex, roughness: 0.72, side: THREE.DoubleSide }),
    );
    this.heldLetterMesh.position.set(0.02, -0.05, 0.075);
    this.heldLetterMesh.rotation.set(0.12, -0.22, 0.06);
    this.heldLetterMesh.castShadow = true;
    this.heldLetterMesh.visible = false;
    this.mannequin.rightHandAnchor.add(this.heldLetterMesh);
  }

  public getLoadedKeys(): string[] {
    return Array.from(this.loadedClipKeys);
  }

  public attachGlbRig(sceneRoot: THREE.Object3D, embeddedClips: THREE.AnimationClip[]): void {
    // Remove previous GLB rig if replacing
    if (this.glbRoot) {
      this.container.remove(this.glbRoot);
    }
    this.actions.clear();
    this.jawMorphs = [];
    this.headBone = null;
    this.rightHandBone = null;

    let foundHead: THREE.Object3D | null = null;
    let foundRightHand: THREE.Object3D | null = null;

    // Enable soft shadows and inspect bones / jaw morph targets
    sceneRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          for (const [name, idx] of Object.entries(mesh.morphTargetDictionary)) {
            const lower = name.toLowerCase();
            if (
              lower.includes('jawopen') ||
              lower.includes('mouthopen') ||
              lower.includes('viseme_aa') ||
              lower === 'jaw_open' ||
              lower === 'mouth_open'
            ) {
              this.jawMorphs.push({ mesh, index: idx });
            }
          }
        }
      }
      const n = obj.name.toLowerCase();
      if (!foundHead && (n.includes('mixamorighead') || n === 'head')) {
        foundHead = obj;
      }
      if (!foundRightHand && (n.includes('mixamorigrighthand') || n === 'righthand')) {
        foundRightHand = obj;
      }
    });

    this.headBone = foundHead;
    this.rightHandBone = foundRightHand;

    // Normalize height and ground strictly at y = 0 (never floating)
    sceneRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(sceneRoot);
    const rawH = box.max.y - box.min.y;
    if (rawH > 0.01 && Number.isFinite(rawH)) {
      const s = this.targetHeight / rawH;
      sceneRoot.scale.multiplyScalar(s);
    }
    sceneRoot.updateMatrixWorld(true);
    const normBox = new THREE.Box3().setFromObject(sceneRoot);
    if (Number.isFinite(normBox.min.y)) {
      sceneRoot.position.y -= normBox.min.y;
    }

    this.glbRoot = sceneRoot;
    this.mixer = new THREE.AnimationMixer(sceneRoot);
    this.container.add(sceneRoot);
    this.mannequin.root.visible = false;
    this.usingGlbRig = true;
    this.loadedClipKeys.add(this.id);

    if (foundRightHand) {
      const handObj = foundRightHand as THREE.Object3D;
      if (this.heldNoteMesh) {
        handObj.add(this.heldNoteMesh);
        this.heldNoteMesh.position.set(0, 0.08, 0.04);
        this.heldNoteMesh.rotation.set(0, 0, Math.PI / 2);
      }
      if (this.heldPhoneMesh) {
        handObj.add(this.heldPhoneMesh);
        this.heldPhoneMesh.position.set(0, 0.08, 0.04);
      }
      if (this.heldLetterMesh) {
        handObj.add(this.heldLetterMesh);
        this.heldLetterMesh.position.set(0, 0.09, 0.05);
      }
    }

    if (embeddedClips.length > 0) {
      this.registerClip('idle', embeddedClips[0]);
    }
  }

  public registerClip(clipName: Clip3DName, clip: THREE.AnimationClip): void {
    if (!this.mixer) return;
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    action.enabled = false;
    action.setEffectiveWeight(0);
    this.actions.set(clipName, action);
    this.loadedClipKeys.add(`${this.id}_${clipName}`);
  }

  /** Pure deterministic pose evaluation at global time t (seconds) */
  public evaluateAt(t: number, req: Character3DPoseRequest): void {
    const fadeDur = req.crossfadeDuration ?? 0.3;
    const elapsed = Math.max(0, t - req.clipStart);
    const blend = req.prevClip && fadeDur > 0 ? clamp(elapsed / fadeDur, 0, 1) : 1;
    const smoothBlend = blend * blend * (3 - 2 * blend);

    const activeProp: HeldPropKind = req.holdingProp ?? (req.holdingNote ? 'note' : 'none');
    const isHoldingAnything = activeProp !== 'none';

    if (this.heldNoteMesh) {
      this.heldNoteMesh.visible = activeProp === 'note';
    }
    if (this.heldPhoneMesh) {
      this.heldPhoneMesh.visible = activeProp === 'phone';
    }
    if (this.heldLetterMesh) {
      this.heldLetterMesh.visible = activeProp === 'letter';
    }

    if (this.usingGlbRig && this.mixer && this.glbRoot) {
      // Deterministic mixer evaluation with 0.3s crossfade between two clip actions
      const currAction = this.actions.get(req.clip) ?? this.actions.get('idle') ?? null;
      const prevAction =
        req.prevClip && req.prevClip !== req.clip
          ? this.actions.get(req.prevClip) ?? null
          : null;

      for (const action of this.actions.values()) {
        action.enabled = false;
        action.setEffectiveWeight(0);
      }

      if (currAction) {
        const dur = Math.max(0.01, currAction.getClip().duration);
        currAction.enabled = true;
        currAction.setEffectiveWeight(prevAction && smoothBlend < 1 ? smoothBlend : 1);
        currAction.time = elapsed % dur;
      }
      if (prevAction && smoothBlend < 1) {
        const prevDur = Math.max(0.01, prevAction.getClip().duration);
        const prevElapsed = Math.max(0, t - (req.prevClipStart ?? 0));
        prevAction.enabled = true;
        prevAction.setEffectiveWeight(1 - smoothBlend);
        prevAction.time = prevElapsed % prevDur;
      }

      // Deterministic mixer apply (update(0) applies explicit action.time & weights with zero drift)
      this.mixer.setTime(0);
      if (currAction) {
        const dur = Math.max(0.01, currAction.getClip().duration);
        currAction.time = elapsed % dur;
      }
      if (prevAction && smoothBlend < 1) {
        const prevDur = Math.max(0.01, prevAction.getClip().duration);
        prevAction.time = Math.max(0, t - (req.prevClipStart ?? 0)) % prevDur;
      }
      this.mixer.update(0);

      // Subtle speaking head nod + deterministic jaw morph target rhythm
      const speakWave = req.isSpeaking
        ? clamp(
            0.35 +
              0.35 * Math.sin(t * 17.5) +
              0.25 * Math.sin(t * 27.3 + 1.2) +
              0.15 * Math.cos(t * 11.2),
            0,
            0.85,
          )
        : 0;

      if (this.headBone && req.isSpeaking) {
        this.headBone.rotation.x += Math.sin(t * 6.5) * 0.06;
      }
      for (const binding of this.jawMorphs) {
        if (binding.mesh.morphTargetInfluences) {
          binding.mesh.morphTargetInfluences[binding.index] = speakWave;
        }
      }
      return;
    }

    // Fallback: deterministic articulated sculpted 3D Jordan & Maya rigs
    const currPose = evalMannequinPose(req.clip, elapsed, isHoldingAnything);
    const finalPose =
      req.prevClip && req.prevClip !== req.clip && smoothBlend < 1
        ? lerpPose(
            evalMannequinPose(
              req.prevClip,
              Math.max(0, t - (req.prevClipStart ?? 0)),
              isHoldingAnything,
            ),
            currPose,
            smoothBlend,
          )
        : currPose;

    const nod = req.isSpeaking ? Math.sin(t * 7.8) * 0.075 : 0;
    const m = this.mannequin;
    m.hips.position.y = this.baseHipsY + finalPose.hipsY;
    m.hips.rotation.y = finalPose.hipsRotY;
    m.spine.rotation.set(finalPose.spineRotX, finalPose.spineRotY, finalPose.spineRotZ);
    m.head.rotation.set(finalPose.headRotX + nod, finalPose.headRotY, finalPose.headRotZ);
    m.leftShoulder.rotation.set(finalPose.lShoulderX, 0, finalPose.lShoulderZ);
    m.leftElbow.rotation.set(finalPose.lElbowX, 0, 0);
    m.rightShoulder.rotation.set(finalPose.rShoulderX, 0, finalPose.rShoulderZ);
    m.rightElbow.rotation.set(finalPose.rElbowX, 0, 0);
    m.leftHip.rotation.set(finalPose.lHipX, 0, 0);
    m.leftKnee.rotation.set(finalPose.lKneeX, 0, 0);
    m.rightHip.rotation.set(finalPose.rHipX, 0, 0);
    m.rightKnee.rotation.set(finalPose.rKneeX, 0, 0);

    // Expressive deterministic talking mouth + eye blink + Maya's ponytail sway
    const talkOpen = req.isSpeaking
      ? 0.65 + 1.85 * Math.abs(Math.sin(t * 14.2) * Math.cos(t * 6.3))
      : 0.55;
    m.mouth.scale.set(talkOpen, 1.0, 0.65);

    const blinkPhase = (t * 0.92 + (this.id === 'woman' ? 1.4 : 0.3)) % 3.7;
    const eyeScaleY = blinkPhase > 3.56 ? 0.12 : 1.0;
    m.leftEye.scale.y = eyeScaleY;
    m.rightEye.scale.y = eyeScaleY;

    if (m.ponytail) {
      const swayAmp = req.clip === 'walking' ? 0.24 : 0.08;
      m.ponytail.rotation.z = Math.sin(t * 4.8) * swayAmp;
      m.ponytail.rotation.x = Math.abs(Math.cos(t * 4.8)) * (swayAmp * 0.6);
    }
  }
}

export class Character3DManager {
  public readonly man: RealisticCharacter3D;
  public readonly woman: RealisticCharacter3D;
  private readonly loader = new GLTFLoader();
  private warnedMissing = false;

  constructor(heldNoteTexture?: THREE.Texture) {
    this.man = new RealisticCharacter3D('man', heldNoteTexture);
    this.woman = new RealisticCharacter3D('woman', heldNoteTexture);
  }

  public getLoadedKeys(): string[] {
    return [...this.man.getLoadedKeys(), ...this.woman.getLoadedKeys()];
  }

  /** Probes /assets/characters/manifest.json or expected GLB paths without crashing if missing */
  public async loadDefaultAssets(): Promise<void> {
    let availableFiles: string[] = [];
    try {
      const res = await fetch('/assets/characters/manifest.json', { cache: 'no-store' });
      if (res.ok) {
        const ct = res.headers.get('content-type') ?? '';
        if (ct.includes('json')) {
          const data = (await res.json()) as { files?: string[] };
          if (Array.isArray(data.files)) {
            availableFiles = data.files;
          }
        }
      }
    } catch {
      // Manifest absent — probe directly below
    }

    const targets =
      availableFiles.length > 0
        ? availableFiles
        : ['man.glb', 'woman.glb'];

    const loadedRigIds = new Set<Character3DId>();

    // 1. Load base rigs first
    for (const file of targets) {
      const lower = file.toLowerCase();
      if (lower !== 'man.glb' && lower !== 'woman.glb') continue;
      const url = `/assets/characters/${file}`;
      const ok = await this.tryLoadGlbUrl(url, file);
      if (ok) loadedRigIds.add(lower === 'man.glb' ? 'man' : 'woman');
    }

    // 2. If base rigs loaded, load animation clips
    if (loadedRigIds.size > 0) {
      const clipSpecs = CHARACTER_3D_SPECS.filter(
        (s) => s.clip !== 'rig' && loadedRigIds.has(s.character),
      );
      await Promise.all(
        clipSpecs.map((spec) =>
          this.tryLoadGlbUrl(`/assets/characters/${spec.fileName}`, spec.fileName),
        ),
      );
    }

    if (loadedRigIds.size < 2 && !this.warnedMissing) {
      this.warnedMissing = true;
      console.warn(
        '[Character3DManager] Missing man.glb and/or woman.glb in /assets/characters/ — using neutral grey articulated 3D stand-in mannequins. Drop Mixamo GLB files into public/assets/characters/ or upload them in the Characters modal.',
      );
    }
  }

  private async tryLoadGlbUrl(url: string, fileName: string): Promise<boolean> {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return false;
      const buf = await res.arrayBuffer();
      // Validate binary GLB magic header "glTF" (0x46546C67) so HTML 404 fallbacks are cleanly rejected
      if (buf.byteLength < 12) return false;
      const magic = new DataView(buf).getUint32(0, true);
      if (magic !== 0x46546c67) return false;
      await this.parseGlbBuffer(buf, fileName);
      return true;
    } catch {
      return false;
    }
  }

  /** Allows uploading Mixamo .glb rigs & animation clips directly inside the Studio UI */
  public async loadGlbFiles(files: FileList | File[]): Promise<number> {
    const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.glb'));
    // Load base rigs (man.glb / woman.glb) before animation clip files
    list.sort((a, b) => {
      const aRig = a.name.toLowerCase() === 'man.glb' || a.name.toLowerCase() === 'woman.glb' ? 0 : 1;
      const bRig = b.name.toLowerCase() === 'man.glb' || b.name.toLowerCase() === 'woman.glb' ? 0 : 1;
      return aRig - bRig;
    });

    let loaded = 0;
    for (const file of list) {
      try {
        const buf = await file.arrayBuffer();
        const ok = await this.parseGlbBuffer(buf, file.name);
        if (ok) loaded++;
      } catch (err) {
        console.warn(`[Character3DManager] Failed to load ${file.name}:`, err);
      }
    }
    return loaded;
  }

  private parseGlbBuffer(buf: ArrayBuffer, fileName: string): Promise<boolean> {
    const clean = fileName.replace(/\.glb$/i, '').toLowerCase();
    const spec = CHARACTER_3D_SPECS.find((s) => s.key === clean);
    if (!spec) {
      console.warn(`[Character3DManager] Unrecognized 3D character filename: ${fileName}`);
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.loader.parse(
        buf,
        '',
        (gltf) => {
          const target = spec.character === 'man' ? this.man : this.woman;
          if (spec.clip === 'rig') {
            target.attachGlbRig(gltf.scene, gltf.animations ?? []);
            resolve(true);
          } else {
            const clip = gltf.animations?.[0];
            if (clip) {
              target.registerClip(spec.clip, clip);
              resolve(true);
            } else {
              console.warn(`[Character3DManager] No animation clip found inside ${fileName}`);
              resolve(false);
            }
          }
        },
        (err) => {
          console.warn(`[Character3DManager] GLB parse error for ${fileName}:`, err);
          resolve(false);
        },
      );
    });
  }
}
