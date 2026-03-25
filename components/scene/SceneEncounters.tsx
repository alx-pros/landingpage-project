"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getSceneDate, sceneParams } from "./sceneParams";
import { getSceneSnapshot, vecFromSpherical } from "./timeUtils";

type FloatingType = "bottle" | "buoy" | "crate";
type CreatureType = "turtle" | "dolphin" | "fishSchool";

interface EncounterSet {
  floating: FloatingType;
  creature: CreatureType;
  floatingAngle: number;
  creaturePhase: number;
  creatureRadius: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function frontArcPosition(radius: number, angleDeg: number, y: number) {
  const theta = THREE.MathUtils.degToRad(angleDeg);
  return new THREE.Vector3(Math.sin(theta) * radius, y, -Math.cos(theta) * radius);
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
  const floating: FloatingType[] = ["bottle", "buoy", "crate"];
  const creature: CreatureType[] = ["turtle", "dolphin", "fishSchool"];
  const values = getRandomValues(4);

  const unit = (value: number) => value / 4_294_967_295;

  return {
    floating: floating[values[0] % floating.length],
    creature: creature[values[1] % creature.length],
    floatingAngle: lerp(-24, 24, unit(values[2])),
    creaturePhase: unit(values[0] ^ values[3]) * Math.PI * 2,
    creatureRadius: lerp(54, 88, unit(values[1] ^ values[2])),
  };
}

function useClonedModel(url: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = scene.clone(true);
    enhanceModelMaterials(clone);
    return clone;
  }, [scene]);
}

function enhanceModelMaterials(model: THREE.Object3D) {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;

      if ("envMapIntensity" in material) {
        material.envMapIntensity = 1.6;
      }

      if ("needsUpdate" in material) {
        material.needsUpdate = true;
      }
    }
  });
}

function animateTurtleParts(
  leftFrontFlipper: THREE.Object3D | null,
  rightFrontFlipper: THREE.Object3D | null,
  leftRearFlipper: THREE.Object3D | null,
  rightRearFlipper: THREE.Object3D | null,
  swim: number
) {
  if (leftFrontFlipper) leftFrontFlipper.rotation.z = 0.35 + swim * 0.45;
  if (rightFrontFlipper) rightFrontFlipper.rotation.z = -0.35 - swim * 0.45;
  if (leftRearFlipper) leftRearFlipper.rotation.z = 0.18 - swim * 0.2;
  if (rightRearFlipper) rightRearFlipper.rotation.z = -0.18 + swim * 0.2;
}

function animateDolphinParts(
  tailTop: THREE.Object3D | null,
  tailBottom: THREE.Object3D | null,
  dorsalFin: THREE.Object3D | null,
  tailBeat: number,
  leap: number
) {
  if (tailTop) tailTop.rotation.y = 0.65 + tailBeat * 0.2;
  if (tailBottom) tailBottom.rotation.y = -0.65 - tailBeat * 0.2;
  if (dorsalFin) dorsalFin.rotation.x = leap * 0.04;
}

function FloatingEncounter({
  url,
  angle,
  radius,
  y,
  scale,
}: {
  url: string;
  angle: number;
  radius: number;
  y: number;
  scale: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const model = useClonedModel(url);
  const anchor = useMemo(() => frontArcPosition(radius, angle, y), [angle, radius, y]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.set(
      anchor.x + Math.sin(t * 0.17 + angle) * 1.8,
      anchor.y + Math.sin(t * 1.05 + angle) * 0.13 + Math.cos(t * 0.38 + angle) * 0.03,
      anchor.z + Math.cos(t * 0.22 + angle * 0.7) * 1.4
    );
    ref.current.rotation.set(
      Math.sin(t * 0.94 + angle) * 0.12,
      Math.sin(t * 0.32 + angle) * 0.2,
      Math.cos(t * 1.08 + angle) * 0.16
    );
  });

  return (
    <group ref={ref} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

function EncounterLightRig() {
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);
  const _sunVector = useRef(new THREE.Vector3());
  const _moonVector = useRef(new THREE.Vector3());

  useFrame(() => {
    if (
      !sunLightRef.current ||
      !moonLightRef.current ||
      !hemiLightRef.current ||
      !targetRef.current
    )
      return;

    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location);

    vecFromSpherical(Math.max(scene.sunElev, 4), scene.sunAz, _sunVector.current);
    sunLightRef.current.position.copy(_sunVector.current).multiplyScalar(360);
    sunLightRef.current.target = targetRef.current;
    sunLightRef.current.color.setHex(scene.lightColorHex);
    sunLightRef.current.intensity = THREE.MathUtils.lerp(0.22, 1.35, 1 - scene.nightFactor);

    vecFromSpherical(Math.max(scene.moonElev, 6), scene.moonAz, _moonVector.current);
    moonLightRef.current.position.copy(_moonVector.current).multiplyScalar(340);
    moonLightRef.current.target = targetRef.current;
    moonLightRef.current.color.setHex(0xbfd6ff);
    moonLightRef.current.intensity = THREE.MathUtils.lerp(0.08, 0.62, scene.nightFactor);

    hemiLightRef.current.intensity = THREE.MathUtils.lerp(0.26, 0.62, 1 - scene.nightFactor * 0.45);
    hemiLightRef.current.color.setHex(0xe1ecff);
    hemiLightRef.current.groundColor.setHex(0x092236);
  });

  return (
    <>
      <object3D ref={targetRef} position={[0, 8, -110]} />
      <directionalLight ref={sunLightRef} intensity={1} color="#f7fbff" />
      <directionalLight ref={moonLightRef} intensity={0.4} color="#bfd6ff" />
      <hemisphereLight ref={hemiLightRef} intensity={0.45} color="#e1ecff" groundColor="#092236" />
    </>
  );
}

function PromontoryEncounter() {
  const model = useClonedModel("/models/promontory.glb");
  const position = useMemo(() => frontArcPosition(2000, 80, -22), []);

  return (
    <group position={position} scale={2} rotation={[0, 0, 0]}>
      <primitive object={model} />
    </group>
  );
}

function CliffEncounter() {
  const model = useClonedModel("/models/cliff_rock.glb");
  const position = useMemo(() => frontArcPosition(200, 200, -2), []);

  return (
    <group position={position} scale={1}>
      <primitive object={model} />
    </group>
  );
}

function CliffGroup1Encounter() {
  const model = useClonedModel("/models/group_of_cliff_1.glb");
  const position = useMemo(() => frontArcPosition(170, 210, 0), []);

  return (
    <group position={position} scale={0.01}>
      <primitive object={model} />
    </group>
  );
}

function CliffGroup2Encounter() {
  const model = useClonedModel("/models/group_of_cliff_2.glb");
  const position = useMemo(() => frontArcPosition(230, 180, 0), []);

  return (
    <group position={position} scale={0.01} rotation={[0, 1, 0]}>
      <primitive object={model} />
    </group>
  );
}

function VolcanoEncounter() {
  const model = useClonedModel("/models/volcano.glb");
  const position = useMemo(() => frontArcPosition(3000, 275, -2), []);

  return (
    <group position={position} scale={4}>
      <primitive object={model} />
    </group>
  );
}

function RockReefEncounter() {
  const model = useClonedModel("/models/rock_reef.glb");
  const position = useMemo(() => frontArcPosition(900, 180, -3), []);

  return (
    <group position={position} scale={1} rotation={[0, 1, 0]}>
      <primitive object={model} />
    </group>
  );
}

function TurtleEncounter({ phase, radius }: { phase: number; radius: number }) {
  const ref = useRef<THREE.Group>(null);
  const model = useClonedModel("/models/creature-turtle.glb");
  const leftFrontFlipper = useMemo(
    () => model.getObjectByName("LeftFrontFlipper") ?? null,
    [model]
  );
  const rightFrontFlipper = useMemo(
    () => model.getObjectByName("RightFrontFlipper") ?? null,
    [model]
  );
  const leftRearFlipper = useMemo(() => model.getObjectByName("LeftRearFlipper") ?? null, [model]);
  const rightRearFlipper = useMemo(
    () => model.getObjectByName("RightRearFlipper") ?? null,
    [model]
  );

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.72 + phase;
    const swim = Math.sin(t * 2.4);
    const dive = Math.sin(t * 0.85) * 0.6;

    ref.current.position.set(
      Math.cos(t * 0.42) * radius * 0.8,
      0.7 + dive * 0.35,
      -24 + Math.sin(t * 0.42) * radius * 0.34
    );
    ref.current.rotation.y = -t * 0.42 + Math.PI * 0.5;
    ref.current.rotation.z = Math.sin(t * 1.6) * 0.05;
    ref.current.rotation.x = dive * 0.08;

    animateTurtleParts(
      leftFrontFlipper,
      rightFrontFlipper,
      leftRearFlipper,
      rightRearFlipper,
      swim
    );
  });

  return (
    <group ref={ref} scale={1.15}>
      <primitive object={model} />
    </group>
  );
}

function DolphinEncounter({ phase, radius }: { phase: number; radius: number }) {
  const ref = useRef<THREE.Group>(null);
  const model = useClonedModel("/models/creature-dolphin.glb");
  const tailTop = useMemo(() => model.getObjectByName("TailTop") ?? null, [model]);
  const tailBottom = useMemo(() => model.getObjectByName("TailBottom") ?? null, [model]);
  const dorsalFin = useMemo(() => model.getObjectByName("DorsalFin") ?? null, [model]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.9 + phase;
    const loop = Math.sin(t * 0.5);
    const leap = Math.max(0, Math.sin(t * 1.8));
    const tailBeat = Math.sin(t * 7.2);

    ref.current.position.set(
      Math.cos(t * 0.5) * radius * 0.72,
      0.45 + leap * 2.4,
      -18 + Math.sin(t * 0.5) * radius * 0.44
    );
    ref.current.rotation.y = -t * 0.5 + Math.PI * 0.5;
    ref.current.rotation.z = loop * 0.08;
    ref.current.rotation.x = -leap * 0.28 + Math.cos(t * 0.9) * 0.08;

    animateDolphinParts(tailTop, tailBottom, dorsalFin, tailBeat, leap);
  });

  return (
    <group ref={ref} scale={0.85}>
      <primitive object={model} />
    </group>
  );
}

function FishSchoolEncounter({ phase, radius }: { phase: number; radius: number }) {
  const ref = useRef<THREE.Group>(null);
  const model = useClonedModel("/models/creature-fish-school.glb");
  const fishNodes = useMemo(
    () => model.children.filter((child) => child.name.startsWith("Fish_")),
    [model]
  );

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.68 + phase;

    ref.current.position.set(
      Math.cos(t * 0.44) * radius * 0.76,
      0.5 + Math.sin(t * 1.4) * 0.22,
      -14 + Math.sin(t * 0.44) * radius * 0.48
    );
    ref.current.rotation.y = -t * 0.44 + Math.PI * 0.5;
    ref.current.rotation.z = Math.sin(t * 0.8) * 0.04;

    for (const [index, fish] of fishNodes.entries()) {
      const wave = Math.sin(t * 5 + index * 0.75);
      fish.position.y = ((index % 3) - 1) * 0.15 + wave * 0.08;
      fish.rotation.y = wave * 0.18;
      fish.rotation.z = wave * 0.06;
    }
  });

  return (
    <group ref={ref} scale={1.05}>
      <primitive object={model} />
    </group>
  );
}

export default function SceneEncounters() {
  const [encounter] = useState<EncounterSet>(() => createEncounterSet());

  return (
    <>
      <EncounterLightRig />

      {encounter.floating === "bottle" && (
        <FloatingEncounter
          url="/models/floating-bottle.glb"
          angle={encounter.floatingAngle}
          radius={24}
          y={0.36}
          scale={1}
        />
      )}
      {encounter.floating === "buoy" && (
        <FloatingEncounter
          url="/models/floating-buoy.glb"
          angle={encounter.floatingAngle}
          radius={26}
          y={0.42}
          scale={1}
        />
      )}
      {encounter.floating === "crate" && (
        <FloatingEncounter
          url="/models/floating-crate.glb"
          angle={encounter.floatingAngle}
          radius={22}
          y={0.4}
          scale={1}
        />
      )}

      <PromontoryEncounter />
      <CliffEncounter />
      <CliffGroup1Encounter />
      <CliffGroup2Encounter />
      <VolcanoEncounter />
      <RockReefEncounter />

      {encounter.creature === "turtle" && (
        <TurtleEncounter phase={encounter.creaturePhase} radius={encounter.creatureRadius} />
      )}
      {encounter.creature === "dolphin" && (
        <DolphinEncounter phase={encounter.creaturePhase} radius={encounter.creatureRadius} />
      )}
      {encounter.creature === "fishSchool" && (
        <FishSchoolEncounter phase={encounter.creaturePhase} radius={encounter.creatureRadius} />
      )}
    </>
  );
}

useGLTF.preload("/models/floating-bottle.glb");
useGLTF.preload("/models/floating-buoy.glb");
useGLTF.preload("/models/floating-crate.glb");
useGLTF.preload("/models/promontory.glb");
useGLTF.preload("/models/cliff_rock.glb");
useGLTF.preload("/models/cliff_group_1.glb");
useGLTF.preload("/models/cliff_group_2.glb");
useGLTF.preload("/models/volcano.glb");
useGLTF.preload("/models/rock_reef.glb");
useGLTF.preload("/models/creature-turtle.glb");
useGLTF.preload("/models/creature-dolphin.glb");
useGLTF.preload("/models/creature-fish-school.glb");
