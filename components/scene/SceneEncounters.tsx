"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getSceneDate, sceneParams } from "./sceneParams";
import { getSceneSnapshot, vecFromSpherical } from "./timeUtils";

interface EncounterSet {
  dolphinSeedA: number;
  dolphinSeedB: number;
  dolphinSeedC: number;
  whaleSeed: number;
}

interface MaterialTuning {
  envMapIntensity: number;
  roughness?: number;
  metalness?: number;
  colorBoost?: number;
  emissiveBoost?: number;
}

interface ObstacleArea {
  position: THREE.Vector3;
  radius: number;
}

interface MarineMotionConfig {
  behavior: "dolphin" | "whale";
  radiusRange: [number, number];
  angleRange: [number, number];
  depthRange: [number, number];
  speedRange: [number, number];
  targetInterval: [number, number];
  avoidanceRadius: number;
  socialDistance: number;
  turnSpeed: number;
  bankFactor: number;
  pitchFactor: number;
  swayAmount: number;
  swaySpeed: number;
  animationSpeedRange: [number, number];
  actionInterval: [number, number];
  actionDuration: [number, number];
}

interface MarineMotionState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  target: THREE.Vector3;
  speed: number;
  retargetAt: number;
  actionAt: number;
  actionDuration: number;
  actionStyle: number;
}

interface SurfaceAction {
  visible: boolean;
  lift: number;
  pitch: number;
  roll: number;
  yaw: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function frontArcPosition(radius: number, angleDeg: number, y: number) {
  const theta = THREE.MathUtils.degToRad(angleDeg);
  return new THREE.Vector3(Math.sin(theta) * radius, y, -Math.cos(theta) * radius);
}

function createSeededRandom(seed: number) {
  let t = seed >>> 0 || 1;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomRange(random: () => number, min: number, max: number) {
  return lerp(min, max, random());
}

function randomIndex(random: () => number, max: number) {
  return Math.floor(random() * max);
}

function horizontalDistance(a: THREE.Vector3, b: THREE.Vector3) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function lerpAngle(current: number, target: number, alpha: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * alpha;
}

function getRandomValues(count: number) {
  const values = new Uint32Array(count);

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(values);
    return values;
  }

  const now = Date.now() >>> 0;
  for (let i = 0; i < count; i++) {
    values[i] = (now + i * 2_654_435_761) >>> 0;
  }

  return values;
}

function createEncounterSet(): EncounterSet {
  const values = getRandomValues(4);
  return {
    dolphinSeedA: values[0],
    dolphinSeedB: values[1],
    dolphinSeedC: values[2],
    whaleSeed: values[3],
  };
}

function useAnimatedClonedModel(url: string, tuning: MaterialTuning) {
  const { scene, animations } = useGLTF(url);

  const model = useMemo(() => {
    const clone = cloneSkeleton(scene) as THREE.Group;
    enhanceModelMaterials(clone, tuning);
    return clone;
  }, [scene, tuning]);

  return { model, animations };
}

function enhanceModelMaterials(model: THREE.Object3D, tuning: MaterialTuning) {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;

      if ("envMapIntensity" in material) {
        material.envMapIntensity = tuning.envMapIntensity;
      }

      if ("roughness" in material && tuning.roughness !== undefined) {
        material.roughness = tuning.roughness;
      }

      if ("metalness" in material && tuning.metalness !== undefined) {
        material.metalness = tuning.metalness;
      }

      if ("color" in material && tuning.colorBoost !== undefined) {
        const colorMaterial = material as THREE.Material & { color: THREE.Color };
        colorMaterial.color.multiplyScalar(tuning.colorBoost);
      }

      if ("emissive" in material && tuning.emissiveBoost !== undefined) {
        const emissiveMaterial = material as THREE.Material & { emissive: THREE.Color };
        emissiveMaterial.emissive.multiplyScalar(tuning.emissiveBoost);
      }

      if ("needsUpdate" in material) {
        material.needsUpdate = true;
      }
    }
  });
}

const CREATURE_TUNING: MaterialTuning = {
  envMapIntensity: 0.48,
  roughness: 0.92,
  metalness: 0.02,
  colorBoost: 1.02,
  emissiveBoost: 1.01,
};

const PROMONTORY_TUNING: MaterialTuning = {
  envMapIntensity: 3,
  roughness: 0,
  metalness: 0,
  colorBoost: 1.01,
  emissiveBoost: 1.02,
};

const ROCK_REEF_TUNING: MaterialTuning = {
  envMapIntensity: 2.16,
  roughness: 1.92,
  metalness: 0.03,
  colorBoost: 1.05,
  emissiveBoost: 2.04,
};

const CLIFF_TUNING: MaterialTuning = {
  envMapIntensity: 2.16,
  roughness: 1.92,
  metalness: 0.03,
  colorBoost: 1.18,
  emissiveBoost: 2.04,
};

const CLIFF_GROUP_TUNING_1: MaterialTuning = {
  envMapIntensity: 1.08,
  roughness: 0.34,
  metalness: 0,
  colorBoost: 1.28,
  emissiveBoost: 1.04,
};

const CLIFF_GROUP_TUNING_2: MaterialTuning = {
  envMapIntensity: 1.08,
  roughness: 0.34,
  metalness: 0,
  colorBoost: 1.3,
  emissiveBoost: 1.04,
};

const VOLCANO_TUNING: MaterialTuning = {
  envMapIntensity: 1.35,
  roughness: 0.9,
  metalness: 0.03,
  colorBoost: 1.04,
  emissiveBoost: 1.05,
};

const CREATURE_OBSTACLES: ObstacleArea[] = [
  { position: frontArcPosition(2000, 80, -14), radius: 290 },
  { position: frontArcPosition(200, 200, -2), radius: 210 },
  { position: frontArcPosition(170, 210, 0), radius: 190 },
  { position: frontArcPosition(230, 180, 0), radius: 210 },
  { position: frontArcPosition(900, 180, -3), radius: 280 },
];

const DOLPHIN_MOTION: MarineMotionConfig = {
  behavior: "dolphin",
  radiusRange: [220, 1_350],
  angleRange: [20, 340],
  depthRange: [-0.42, -0.08],
  speedRange: [34, 58],
  targetInterval: [4.5, 10],
  avoidanceRadius: 260,
  socialDistance: 170,
  turnSpeed: 3.2,
  bankFactor: 0.013,
  pitchFactor: 0.24,
  swayAmount: 0.08,
  swaySpeed: 1.55,
  animationSpeedRange: [0.96, 1.24],
  actionInterval: [5.5, 12],
  actionDuration: [1.1, 2],
};

const WHALE_MOTION: MarineMotionConfig = {
  behavior: "whale",
  radiusRange: [520, 1_950],
  angleRange: [30, 330],
  depthRange: [-1.95, -0.72],
  speedRange: [18, 34],
  targetInterval: [10, 18],
  avoidanceRadius: 340,
  socialDistance: 250,
  turnSpeed: 1.7,
  bankFactor: 0.008,
  pitchFactor: 0.13,
  swayAmount: 0.06,
  swaySpeed: 0.55,
  animationSpeedRange: [0.62, 0.88],
  actionInterval: [12, 22],
  actionDuration: [2.6, 4.4],
};

function chooseCreatureTarget(random: () => number, config: MarineMotionConfig) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = randomRange(random, config.angleRange[0], config.angleRange[1]);
    const radius = randomRange(random, config.radiusRange[0], config.radiusRange[1]);
    const depth = randomRange(random, config.depthRange[0], config.depthRange[1]);
    const position = frontArcPosition(radius, angle, depth);

    const nearObstacle = CREATURE_OBSTACLES.some((obstacle) => {
      return (
        horizontalDistance(position, obstacle.position) < obstacle.radius + config.avoidanceRadius
      );
    });

    if (!nearObstacle) {
      return position;
    }
  }

  return frontArcPosition(
    (config.radiusRange[0] + config.radiusRange[1]) * 0.5,
    (config.angleRange[0] + config.angleRange[1]) * 0.5,
    (config.depthRange[0] + config.depthRange[1]) * 0.5
  );
}

function nearestObstacleDistance(position: THREE.Vector3) {
  let minDistance = Number.POSITIVE_INFINITY;

  for (const obstacle of CREATURE_OBSTACLES) {
    minDistance = Math.min(minDistance, horizontalDistance(position, obstacle.position));
  }

  return minDistance;
}

function createMarineMotionState(
  random: () => number,
  config: MarineMotionConfig
): MarineMotionState {
  const position = chooseCreatureTarget(random, config);
  const target = chooseCreatureTarget(random, config);
  const speed = randomRange(random, config.speedRange[0], config.speedRange[1]);
  const velocity = target.clone().sub(position).setLength(speed);

  return {
    position,
    velocity,
    target,
    speed,
    retargetAt: randomRange(random, config.targetInterval[0], config.targetInterval[1]),
    actionAt: randomRange(random, config.actionInterval[0], config.actionInterval[1]),
    actionDuration: randomRange(random, config.actionDuration[0], config.actionDuration[1]),
    actionStyle: randomIndex(random, config.behavior === "dolphin" ? 7 : 6),
  };
}

function useClipPlayback(
  model: THREE.Object3D,
  animations: THREE.AnimationClip[],
  seed: number,
  speedRange: [number, number]
) {
  const playbackRandom = useMemo(() => createSeededRandom(seed ^ 0x9e3779b9), [seed]);
  const { actions } = useAnimations(animations, model);

  useEffect(() => {
    const clip = animations[0];
    if (!clip) return;

    const action = actions[clip.name];
    if (!action) return;

    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.time = playbackRandom() * clip.duration;
    action.timeScale = randomRange(playbackRandom, speedRange[0], speedRange[1]);
    action.fadeIn(0.35);
    action.play();

    return () => {
      action.fadeOut(0.2);
      action.stop();
    };
  }, [actions, animations, playbackRandom, speedRange]);
}

function getDolphinAction(style: number, progress: number): SurfaceAction {
  const arc = Math.sin(progress * Math.PI);

  switch (style) {
    case 0:
      return {
        visible: arc > 0.03,
        lift: arc * 3.1,
        pitch: lerp(-0.82, 0.42, progress),
        roll: 0,
        yaw: 0,
      };
    case 1:
      return {
        visible: arc > 0.03,
        lift: arc * 2.35,
        pitch: -0.05,
        roll: progress * Math.PI * 4.6,
        yaw: 0,
      };
    case 2:
      return {
        visible: arc > 0.03,
        lift: arc * 1.7,
        pitch: lerp(-0.32, 0.58, progress),
        roll: 0,
        yaw: 0,
      };
    case 3: {
      const slapArc = progress < 0.52 ? Math.sin((progress / 0.52) * Math.PI) : 0;
      return { visible: slapArc > 0.03, lift: slapArc * 1.15, pitch: 0.62, roll: 0, yaw: 0 };
    }
    case 4: {
      const porpoise = Math.max(0, Math.sin(progress * Math.PI * 3.8)) * 0.75;
      return {
        visible: porpoise > 0.03,
        lift: porpoise,
        pitch: 0.12 + Math.sin(progress * Math.PI * 2) * 0.16,
        roll: 0,
        yaw: 0,
      };
    }
    case 5:
      return {
        visible: arc > 0.03,
        lift: arc * 1.95,
        pitch: lerp(-0.46, 0.12, progress),
        roll: Math.sin(progress * Math.PI) * 1.18,
        yaw: 0,
      };
    default:
      return {
        visible: arc > 0.03,
        lift: arc * 2.2,
        pitch: progress * Math.PI * 2 - 0.9,
        roll: 0,
        yaw: 0,
      };
  }
}

function getWhaleAction(style: number, progress: number): SurfaceAction {
  const arc = Math.sin(progress * Math.PI);

  switch (style) {
    case 0:
      return {
        visible: true,
        lift: arc * 3.25,
        pitch: lerp(-0.7, 0.35, progress),
        roll: 0,
        yaw: 0,
      };
    case 1:
      return {
        visible: true,
        lift: arc * 1.75,
        pitch: lerp(-0.4, 0.14, progress),
        roll: 0,
        yaw: 0,
      };
    case 2:
      return {
        visible: true,
        lift: arc * 2.35,
        pitch: lerp(-0.5, 0.2, progress),
        roll: Math.sin(progress * Math.PI) * 0.86,
        yaw: Math.sin(progress * Math.PI) * 0.18,
      };
    case 3:
      return {
        visible: true,
        lift: arc * 2.05,
        pitch: lerp(-0.44, 0.06, progress),
        roll: lerp(0, 1.1, progress),
        yaw: 0,
      };
    case 4: {
      const headArc =
        progress < 0.58 ? Math.sin((progress / 0.58) * Math.PI) : Math.max(0, 1 - progress) * 0.7;
      return { visible: true, lift: headArc * 2.3, pitch: -0.76, roll: 0, yaw: 0 };
    }
    default:
      return { visible: true, lift: arc * 0.98, pitch: 0.68, roll: 0, yaw: 0 };
  }
}

function EncounterLightRig() {
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const glareLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const _sunVector = useRef(new THREE.Vector3());
  const _moonVector = useRef(new THREE.Vector3());
  const _glareOffset = useRef(new THREE.Vector3());

  useFrame(() => {
    if (
      !sunLightRef.current ||
      !glareLightRef.current ||
      !fillLightRef.current ||
      !moonLightRef.current ||
      !hemiLightRef.current ||
      !ambientLightRef.current ||
      !targetRef.current
    )
      return;

    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location);

    vecFromSpherical(Math.max(scene.sunElev, 4), scene.sunAz, _sunVector.current);
    sunLightRef.current.position.copy(_sunVector.current).multiplyScalar(360);
    sunLightRef.current.target = targetRef.current;
    sunLightRef.current.color.setHex(scene.lightColorHex);
    sunLightRef.current.intensity = THREE.MathUtils.lerp(0.26, 1.95, 1 - scene.nightFactor);

    _glareOffset.current.set(120, 58, 190);
    glareLightRef.current.position
      .copy(_sunVector.current)
      .multiplyScalar(280)
      .add(_glareOffset.current);
    glareLightRef.current.target = targetRef.current;
    glareLightRef.current.color.setHex(scene.sunColorHex);
    glareLightRef.current.intensity = THREE.MathUtils.lerp(0.05, 0.94, 1 - scene.nightFactor);

    fillLightRef.current.position.set(220, 145, 260);
    fillLightRef.current.target = targetRef.current;
    fillLightRef.current.color.setHex(scene.lightColorHex);
    fillLightRef.current.intensity = THREE.MathUtils.lerp(0.18, 0.92, 1 - scene.nightFactor);

    vecFromSpherical(Math.max(scene.moonElev, 6), scene.moonAz, _moonVector.current);
    moonLightRef.current.position.copy(_moonVector.current).multiplyScalar(340);
    moonLightRef.current.target = targetRef.current;
    moonLightRef.current.color.setHex(0xbfd6ff);
    moonLightRef.current.intensity = THREE.MathUtils.lerp(0.06, 0.46, scene.nightFactor);

    hemiLightRef.current.intensity = THREE.MathUtils.lerp(0.24, 0.54, 1 - scene.nightFactor * 0.5);
    hemiLightRef.current.color.setHex(0xe1ecff);
    hemiLightRef.current.groundColor.setHex(0x092236);

    ambientLightRef.current.color.setHex(scene.lightColorHex);
    ambientLightRef.current.intensity = THREE.MathUtils.lerp(
      0.12,
      0.34,
      1 - scene.nightFactor * 0.4
    );
  });

  return (
    <>
      <object3D ref={targetRef} position={[0, 8, -110]} />
      <directionalLight ref={sunLightRef} intensity={1} color="#f7fbff" />
      <directionalLight ref={glareLightRef} intensity={0.7} color="#ffd0a4" />
      <directionalLight ref={fillLightRef} intensity={0.4} color="#e6efff" />
      <directionalLight ref={moonLightRef} intensity={0.4} color="#bfd6ff" />
      <hemisphereLight ref={hemiLightRef} intensity={0.45} color="#e1ecff" groundColor="#092236" />
      <ambientLight ref={ambientLightRef} intensity={0.2} color="#edf4ff" />
    </>
  );
}

function PromontoryEncounter() {
  const { model } = useAnimatedClonedModel("/models/promontory.glb", PROMONTORY_TUNING);
  const position = useMemo(() => frontArcPosition(2000, 80, -14), []);

  return (
    <group position={position} scale={2} rotation={[0, -0.5, 0]}>
      <primitive object={model} />
    </group>
  );
}

function CliffEncounter() {
  const { model } = useAnimatedClonedModel("/models/cliff_rock.glb", CLIFF_TUNING);
  const position = useMemo(() => frontArcPosition(200, 200, -2), []);

  return (
    <group position={position} scale={1}>
      <primitive object={model} />
    </group>
  );
}

function CliffGroup1Encounter() {
  const { model } = useAnimatedClonedModel("/models/group_of_cliff_1.glb", CLIFF_GROUP_TUNING_1);
  const position = useMemo(() => frontArcPosition(170, 210, 0), []);

  return (
    <group position={position} scale={0.01}>
      <primitive object={model} />
    </group>
  );
}

function CliffGroup2Encounter() {
  const { model } = useAnimatedClonedModel("/models/group_of_cliff_2.glb", CLIFF_GROUP_TUNING_2);
  const position = useMemo(() => frontArcPosition(230, 180, 0), []);

  return (
    <group position={position} scale={0.01} rotation={[0, 1, 0]}>
      <primitive object={model} />
    </group>
  );
}

function VolcanoEncounter() {
  const { model } = useAnimatedClonedModel("/models/volcano.glb", VOLCANO_TUNING);
  const position = useMemo(() => frontArcPosition(3000, 275, -2), []);

  return (
    <group position={position} scale={4}>
      <primitive object={model} />
    </group>
  );
}

function RockReefEncounter() {
  const { model } = useAnimatedClonedModel("/models/rock_reef.glb", ROCK_REEF_TUNING);
  const position = useMemo(() => frontArcPosition(900, 180, -3), []);

  return (
    <group position={position} scale={1} rotation={[0, 1, 0]}>
      <primitive object={model} />
    </group>
  );
}

function MarineCreatureEncounter({
  id,
  url,
  seed,
  scale,
  config,
  sharedPositionsRef,
}: {
  id: string;
  url: string;
  seed: number;
  scale: number;
  config: MarineMotionConfig;
  sharedPositionsRef: React.MutableRefObject<Record<string, THREE.Vector3>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { model, animations } = useAnimatedClonedModel(url, CREATURE_TUNING);
  const random = useMemo(() => createSeededRandom(seed), [seed]);
  const motionRef = useRef<MarineMotionState | null>(null);
  const desiredVelocityRef = useRef(new THREE.Vector3());
  const avoidanceRef = useRef(new THREE.Vector3());
  const awayRef = useRef(new THREE.Vector3());
  const sideRef = useRef(new THREE.Vector3());

  useClipPlayback(model, animations, seed, config.animationSpeedRange);

  useEffect(() => {
    return () => {
      delete sharedPositionsRef.current[id];
    };
  }, [id, sharedPositionsRef]);

  if (!motionRef.current) {
    motionRef.current = createMarineMotionState(random, config);
  }

  useFrame((state, delta) => {
    if (!groupRef.current || !motionRef.current) return;

    const motion = motionRef.current;
    const elapsed = state.clock.elapsedTime;
    const closeToTarget = motion.position.distanceToSquared(motion.target) < 90 * 90;

    if (elapsed >= motion.retargetAt || closeToTarget) {
      motion.target.copy(chooseCreatureTarget(random, config));
      motion.speed = randomRange(random, config.speedRange[0], config.speedRange[1]);
      motion.retargetAt =
        elapsed + randomRange(random, config.targetInterval[0], config.targetInterval[1]);
    }

    desiredVelocityRef.current.copy(motion.target).sub(motion.position);

    if (desiredVelocityRef.current.lengthSq() > 0.001) {
      desiredVelocityRef.current.normalize().multiplyScalar(motion.speed);
    } else {
      desiredVelocityRef.current.set(0, 0, -motion.speed);
    }

    const stroke = Math.sin(elapsed * (config.swaySpeed * 2.9) + seed * 0.00031);
    const swimPulse =
      config.behavior === "dolphin" ? 0.8 + Math.max(0, stroke) * 0.34 : 0.9 + stroke * 0.12;
    desiredVelocityRef.current.multiplyScalar(swimPulse);

    avoidanceRef.current.set(0, 0, 0);

    for (const obstacle of CREATURE_OBSTACLES) {
      const distance = horizontalDistance(motion.position, obstacle.position);
      const clearance = obstacle.radius + config.avoidanceRadius;

      if (distance < clearance) {
        awayRef.current.copy(motion.position).sub(obstacle.position).setY(0);

        if (awayRef.current.lengthSq() < 0.001) {
          awayRef.current.set(1, 0, 0);
        }

        awayRef.current
          .normalize()
          .multiplyScalar(((clearance - distance) / clearance) * motion.speed * 1.9);

        avoidanceRef.current.add(awayRef.current);

        if (distance < obstacle.radius + config.avoidanceRadius * 0.4) {
          motion.retargetAt = Math.min(motion.retargetAt, elapsed);
        }
      }
    }

    for (const [otherId, otherPosition] of Object.entries(sharedPositionsRef.current)) {
      if (otherId === id) continue;

      const distance = horizontalDistance(motion.position, otherPosition);
      if (distance >= config.socialDistance) continue;

      awayRef.current.copy(motion.position).sub(otherPosition).setY(0);
      if (awayRef.current.lengthSq() < 0.001) {
        awayRef.current.set(1, 0, 0);
      }

      awayRef.current
        .normalize()
        .multiplyScalar(
          ((config.socialDistance - distance) / config.socialDistance) * motion.speed * 1.4
        );

      avoidanceRef.current.add(awayRef.current);
    }

    desiredVelocityRef.current.add(avoidanceRef.current);
    if (desiredVelocityRef.current.lengthSq() > 0.001) {
      desiredVelocityRef.current.setLength(motion.speed * swimPulse);
    }

    motion.velocity.lerp(desiredVelocityRef.current, Math.min(1, delta * 1.35));
    motion.position.addScaledVector(motion.velocity, delta);
    motion.position.y = THREE.MathUtils.clamp(
      motion.position.y,
      config.depthRange[0],
      config.depthRange[1]
    );

    let surfaceLift = Math.sin(elapsed * config.swaySpeed + seed * 0.00027) * config.swayAmount;
    let pitchOffset = 0;
    let rollOffset = 0;
    let yawOffset = 0;
    let creatureVisible = true;

    const actionProgress = (elapsed - motion.actionAt) / motion.actionDuration;
    const canPerformAction =
      nearestObstacleDistance(motion.position) > config.avoidanceRadius + 140;

    if (canPerformAction && actionProgress >= 0 && actionProgress <= 1) {
      const action =
        config.behavior === "dolphin"
          ? getDolphinAction(motion.actionStyle, actionProgress)
          : getWhaleAction(motion.actionStyle, actionProgress);

      creatureVisible = action.visible;
      surfaceLift += action.lift;
      pitchOffset += action.pitch;
      rollOffset += action.roll;
      yawOffset += action.yaw;
    } else if (actionProgress > 1) {
      motion.actionDuration = randomRange(
        random,
        config.actionDuration[0],
        config.actionDuration[1]
      );
      motion.actionAt =
        elapsed + randomRange(random, config.actionInterval[0], config.actionInterval[1]);
      motion.actionStyle = randomIndex(random, config.behavior === "dolphin" ? 7 : 6);
    } else if (config.behavior === "dolphin") {
      creatureVisible = false;
    }

    groupRef.current.visible = creatureVisible;

    groupRef.current.position.copy(motion.position);

    sideRef.current.set(-motion.velocity.z, 0, -motion.velocity.x);
    if (sideRef.current.lengthSq() > 0.001) {
      sideRef.current.normalize().multiplyScalar(stroke * config.swayAmount * 0.6);
      groupRef.current.position.add(sideRef.current);
    }

    groupRef.current.position.y += surfaceLift;

    const heading = Math.atan2(motion.velocity.x, -motion.velocity.z);
    groupRef.current.rotation.y = lerpAngle(
      groupRef.current.rotation.y,
      heading + yawOffset,
      Math.min(1, delta * config.turnSpeed)
    );

    const bankTarget = THREE.MathUtils.clamp(
      -motion.velocity.x * config.bankFactor + rollOffset,
      -Math.PI,
      Math.PI
    );
    const pitchTarget = THREE.MathUtils.clamp(
      motion.velocity.y * config.pitchFactor + pitchOffset,
      -Math.PI,
      Math.PI
    );

    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      bankTarget,
      Math.min(1, delta * 2.3)
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      pitchTarget,
      Math.min(1, delta * 2.1)
    );

    const registry = sharedPositionsRef.current[id] ?? new THREE.Vector3();
    registry.copy(groupRef.current.position);
    sharedPositionsRef.current[id] = registry;
  });

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

export default function SceneEncounters() {
  const [encounter] = useState<EncounterSet>(() => createEncounterSet());
  const sharedPositionsRef = useRef<Record<string, THREE.Vector3>>({});

  return (
    <>
      <EncounterLightRig />

      <PromontoryEncounter />
      <CliffEncounter />
      <CliffGroup1Encounter />
      <CliffGroup2Encounter />
      <VolcanoEncounter />
      <RockReefEncounter />

      <MarineCreatureEncounter
        id="dolphin-a"
        url="/models/dolphin.glb"
        seed={encounter.dolphinSeedA}
        scale={5.95}
        config={DOLPHIN_MOTION}
        sharedPositionsRef={sharedPositionsRef}
      />
      <MarineCreatureEncounter
        id="dolphin-b"
        url="/models/dolphin.glb"
        seed={encounter.dolphinSeedB}
        scale={5.88}
        config={DOLPHIN_MOTION}
        sharedPositionsRef={sharedPositionsRef}
      />
      <MarineCreatureEncounter
        id="dolphin-c"
        url="/models/dolphin.glb"
        seed={encounter.dolphinSeedC}
        scale={5.82}
        config={DOLPHIN_MOTION}
        sharedPositionsRef={sharedPositionsRef}
      />
      <MarineCreatureEncounter
        id="whale"
        url="/models/blue_whale.glb"
        seed={encounter.whaleSeed}
        scale={5.82}
        config={WHALE_MOTION}
        sharedPositionsRef={sharedPositionsRef}
      />
    </>
  );
}

useGLTF.preload("/models/promontory.glb");
useGLTF.preload("/models/cliff_rock.glb");
useGLTF.preload("/models/group_of_cliff_1.glb");
useGLTF.preload("/models/group_of_cliff_2.glb");
useGLTF.preload("/models/volcano.glb");
useGLTF.preload("/models/rock_reef.glb");
useGLTF.preload("/models/dolphin.glb");
useGLTF.preload("/models/blue_whale.glb");
