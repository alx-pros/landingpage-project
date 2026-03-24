'use client'

import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

type FloatingType = 'bottle' | 'buoy' | 'crate'
type HorizonType = 'island' | 'cliff' | 'seaStack'
type CreatureType = 'turtle' | 'dolphin' | 'fishSchool'

interface EncounterSet {
  floating: FloatingType
  horizon: HorizonType
  creature: CreatureType
  floatingAngle: number
  horizonAngle: number
  creaturePhase: number
  creatureRadius: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function frontArcPosition(radius: number, angleDeg: number, y: number) {
  const theta = THREE.MathUtils.degToRad(angleDeg)
  return new THREE.Vector3(
    Math.sin(theta) * radius,
    y,
    -Math.cos(theta) * radius,
  )
}

function getRandomValues(count: number) {
  const values = new Uint32Array(count)

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(values)
    return values
  }

  const now = Date.now() >>> 0
  for (let i = 0; i < count; i++) {
    values[i] = (now + i * 2_654_435_761) >>> 0
  }

  return values
}

function createEncounterSet(): EncounterSet {
  const floating: FloatingType[] = ['bottle', 'buoy', 'crate']
  const horizon: HorizonType[] = ['island', 'cliff', 'seaStack']
  const creature: CreatureType[] = ['turtle', 'dolphin', 'fishSchool']
  const values = getRandomValues(5)

  const unit = (value: number) => value / 4_294_967_295

  return {
    floating: floating[values[0] % floating.length],
    horizon: horizon[values[1] % horizon.length],
    creature: creature[values[2] % creature.length],
    floatingAngle: lerp(-24, 24, unit(values[3])),
    horizonAngle: lerp(-42, 42, unit(values[4])),
    creaturePhase: unit(values[0] ^ values[4]) * Math.PI * 2,
    creatureRadius: lerp(54, 88, unit(values[2] ^ values[3])),
  }
}

function useClonedModel(url: string) {
  const { scene } = useGLTF(url)
  return useMemo(() => scene.clone(true), [scene])
}

function animateTurtleParts(
  leftFrontFlipper: THREE.Object3D | null,
  rightFrontFlipper: THREE.Object3D | null,
  leftRearFlipper: THREE.Object3D | null,
  rightRearFlipper: THREE.Object3D | null,
  swim: number,
) {
  if (leftFrontFlipper) leftFrontFlipper.rotation.z = 0.35 + swim * 0.45
  if (rightFrontFlipper) rightFrontFlipper.rotation.z = -0.35 - swim * 0.45
  if (leftRearFlipper) leftRearFlipper.rotation.z = 0.18 - swim * 0.2
  if (rightRearFlipper) rightRearFlipper.rotation.z = -0.18 + swim * 0.2
}

function animateDolphinParts(
  tailTop: THREE.Object3D | null,
  tailBottom: THREE.Object3D | null,
  dorsalFin: THREE.Object3D | null,
  tailBeat: number,
  leap: number,
) {
  if (tailTop) tailTop.rotation.y = 0.65 + tailBeat * 0.2
  if (tailBottom) tailBottom.rotation.y = -0.65 - tailBeat * 0.2
  if (dorsalFin) dorsalFin.rotation.x = leap * 0.04
}

function FloatingEncounter({
  url,
  angle,
  radius,
  y,
  scale,
}: {
  url: string
  angle: number
  radius: number
  y: number
  scale: number
}) {
  const ref = useRef<THREE.Group>(null)
  const model = useClonedModel(url)
  const anchor = useMemo(() => frontArcPosition(radius, angle, y), [angle, radius, y])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.position.set(
      anchor.x + Math.sin(t * 0.17 + angle) * 1.8,
      anchor.y + Math.sin(t * 1.05 + angle) * 0.13 + Math.cos(t * 0.38 + angle) * 0.03,
      anchor.z + Math.cos(t * 0.22 + angle * 0.7) * 1.4,
    )
    ref.current.rotation.set(
      Math.sin(t * 0.94 + angle) * 0.12,
      Math.sin(t * 0.32 + angle) * 0.2,
      Math.cos(t * 1.08 + angle) * 0.16,
    )
  })

  return (
    <group ref={ref} scale={scale}>
      <primitive object={model} />
    </group>
  )
}

function HorizonEncounter({
  url,
  angle,
  radius,
  y,
  scale,
}: {
  url: string
  angle: number
  radius: number
  y: number
  scale: number
}) {
  const model = useClonedModel(url)
  const position = useMemo(() => frontArcPosition(radius, angle, y), [angle, radius, y])

  return (
    <group position={position} scale={scale}>
      <primitive object={model} />
    </group>
  )
}

function TurtleEncounter({ phase, radius }: { phase: number; radius: number }) {
  const ref = useRef<THREE.Group>(null)
  const model = useClonedModel('/models/creature-turtle.glb')
  const leftFrontFlipper = useMemo(() => model.getObjectByName('LeftFrontFlipper') ?? null, [model])
  const rightFrontFlipper = useMemo(() => model.getObjectByName('RightFrontFlipper') ?? null, [model])
  const leftRearFlipper = useMemo(() => model.getObjectByName('LeftRearFlipper') ?? null, [model])
  const rightRearFlipper = useMemo(() => model.getObjectByName('RightRearFlipper') ?? null, [model])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime * 0.72 + phase
    const swim = Math.sin(t * 2.4)
    const dive = Math.sin(t * 0.85) * 0.6

    ref.current.position.set(
      Math.cos(t * 0.42) * radius * 0.8,
      0.7 + dive * 0.35,
      -24 + Math.sin(t * 0.42) * radius * 0.34,
    )
    ref.current.rotation.y = -t * 0.42 + Math.PI * 0.5
    ref.current.rotation.z = Math.sin(t * 1.6) * 0.05
    ref.current.rotation.x = dive * 0.08

    animateTurtleParts(
      leftFrontFlipper,
      rightFrontFlipper,
      leftRearFlipper,
      rightRearFlipper,
      swim,
    )
  })

  return (
    <group ref={ref} scale={1.15}>
      <primitive object={model} />
    </group>
  )
}

function DolphinEncounter({ phase, radius }: { phase: number; radius: number }) {
  const ref = useRef<THREE.Group>(null)
  const model = useClonedModel('/models/creature-dolphin.glb')
  const tailTop = useMemo(() => model.getObjectByName('TailTop') ?? null, [model])
  const tailBottom = useMemo(() => model.getObjectByName('TailBottom') ?? null, [model])
  const dorsalFin = useMemo(() => model.getObjectByName('DorsalFin') ?? null, [model])

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime * 0.9 + phase
    const loop = Math.sin(t * 0.5)
    const leap = Math.max(0, Math.sin(t * 1.8))
    const tailBeat = Math.sin(t * 7.2)

    ref.current.position.set(
      Math.cos(t * 0.5) * radius * 0.72,
      0.45 + leap * 2.4,
      -18 + Math.sin(t * 0.5) * radius * 0.44,
    )
    ref.current.rotation.y = -t * 0.5 + Math.PI * 0.5
    ref.current.rotation.z = loop * 0.08
    ref.current.rotation.x = -leap * 0.28 + Math.cos(t * 0.9) * 0.08

    animateDolphinParts(tailTop, tailBottom, dorsalFin, tailBeat, leap)
  })

  return (
    <group ref={ref} scale={0.85}>
      <primitive object={model} />
    </group>
  )
}

function FishSchoolEncounter({ phase, radius }: { phase: number; radius: number }) {
  const ref = useRef<THREE.Group>(null)
  const model = useClonedModel('/models/creature-fish-school.glb')
  const fishNodes = useMemo(
    () => model.children.filter((child) => child.name.startsWith('Fish_')),
    [model],
  )

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime * 0.68 + phase

    ref.current.position.set(
      Math.cos(t * 0.44) * radius * 0.76,
      0.5 + Math.sin(t * 1.4) * 0.22,
      -14 + Math.sin(t * 0.44) * radius * 0.48,
    )
    ref.current.rotation.y = -t * 0.44 + Math.PI * 0.5
    ref.current.rotation.z = Math.sin(t * 0.8) * 0.04

    for (const [index, fish] of fishNodes.entries()) {
      const wave = Math.sin(t * 5 + index * 0.75)
      fish.position.y = ((index % 3) - 1) * 0.15 + wave * 0.08
      fish.rotation.y = wave * 0.18
      fish.rotation.z = wave * 0.06
    }
  })

  return (
    <group ref={ref} scale={1.05}>
      <primitive object={model} />
    </group>
  )
}

export default function SceneEncounters() {
  const [encounter] = useState<EncounterSet>(() => createEncounterSet())

  return (
    <>
      {encounter.floating === 'bottle' && (
        <FloatingEncounter
          url="/models/floating-bottle.glb"
          angle={encounter.floatingAngle}
          radius={24}
          y={0.36}
          scale={1}
        />
      )}
      {encounter.floating === 'buoy' && (
        <FloatingEncounter
          url="/models/floating-buoy.glb"
          angle={encounter.floatingAngle}
          radius={26}
          y={0.42}
          scale={1}
        />
      )}
      {encounter.floating === 'crate' && (
        <FloatingEncounter
          url="/models/floating-crate.glb"
          angle={encounter.floatingAngle}
          radius={22}
          y={0.4}
          scale={1}
        />
      )}

      {encounter.horizon === 'island' && (
        <HorizonEncounter
          url="/models/horizon-island.glb"
          angle={encounter.horizonAngle}
          radius={980}
          y={-6}
          scale={1}
        />
      )}
      {encounter.horizon === 'cliff' && (
        <HorizonEncounter
          url="/models/horizon-cliff.glb"
          angle={encounter.horizonAngle}
          radius={1_060}
          y={-4}
          scale={1}
        />
      )}
      {encounter.horizon === 'seaStack' && (
        <HorizonEncounter
          url="/models/horizon-sea-stack.glb"
          angle={encounter.horizonAngle}
          radius={1_120}
          y={-6}
          scale={1}
        />
      )}

      {encounter.creature === 'turtle' && (
        <TurtleEncounter phase={encounter.creaturePhase} radius={encounter.creatureRadius} />
      )}
      {encounter.creature === 'dolphin' && (
        <DolphinEncounter phase={encounter.creaturePhase} radius={encounter.creatureRadius} />
      )}
      {encounter.creature === 'fishSchool' && (
        <FishSchoolEncounter phase={encounter.creaturePhase} radius={encounter.creatureRadius} />
      )}
    </>
  )
}

useGLTF.preload('/models/floating-bottle.glb')
useGLTF.preload('/models/floating-buoy.glb')
useGLTF.preload('/models/floating-crate.glb')
useGLTF.preload('/models/horizon-island.glb')
useGLTF.preload('/models/horizon-cliff.glb')
useGLTF.preload('/models/horizon-sea-stack.glb')
useGLTF.preload('/models/creature-turtle.glb')
useGLTF.preload('/models/creature-dolphin.glb')
useGLTF.preload('/models/creature-fish-school.glb')
