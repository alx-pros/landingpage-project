'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Sky as SkyImpl } from 'three/examples/jsm/objects/Sky.js'
import * as THREE from 'three'
import Ocean from './Ocean'
import SceneEncounters from './SceneEncounters'
import { getSceneDate, sceneParams } from './sceneParams'
import {
  getSceneSnapshot,
  type SceneSnapshot,
  vecFromSpherical,
} from './timeUtils'

interface SphericalPoint {
  elevation: number
  azimuth: number
}

const CONSTELLATION_SETS = [
  {
    stars: [
      { elevation: 34, azimuth: 338 },
      { elevation: 31, azimuth: 346 },
      { elevation: 29, azimuth: 356 },
      { elevation: 26, azimuth: 6 },
      { elevation: 22, azimuth: 16 },
      { elevation: 18, azimuth: 24 },
      { elevation: 14, azimuth: 31 },
    ],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  {
    stars: [
      { elevation: 32, azimuth: 330 },
      { elevation: 35, azimuth: 342 },
      { elevation: 38, azimuth: 356 },
      { elevation: 40, azimuth: 9 },
      { elevation: 43, azimuth: 18 },
      { elevation: 46, azimuth: 24 },
      { elevation: 49, azimuth: 33 },
    ],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  {
    stars: [
      { elevation: 23, azimuth: 32 },
      { elevation: 27, azimuth: 24 },
      { elevation: 30, azimuth: 17 },
      { elevation: 26, azimuth: 9 },
      { elevation: 22, azimuth: 2 },
    ],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    stars: [
      { elevation: 14, azimuth: 210 },
      { elevation: 18, azimuth: 220 },
      { elevation: 16, azimuth: 232 },
      { elevation: 10, azimuth: 222 },
      { elevation: 7, azimuth: 229 },
      { elevation: 11, azimuth: 240 },
      { elevation: 15, azimuth: 247 },
    ],
    segments: [[0, 1], [1, 2], [1, 3], [3, 4], [2, 5], [5, 6]],
  },
  {
    stars: [
      { elevation: 21, azimuth: 154 },
      { elevation: 24, azimuth: 163 },
      { elevation: 27, azimuth: 175 },
      { elevation: 23, azimuth: 184 },
      { elevation: 18, azimuth: 195 },
      { elevation: 16, azimuth: 205 },
    ],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  {
    stars: [
      { elevation: 16, azimuth: 126 },
      { elevation: 19, azimuth: 136 },
      { elevation: 22, azimuth: 146 },
      { elevation: 18, azimuth: 157 },
      { elevation: 13, azimuth: 166 },
      { elevation: 11, azimuth: 176 },
    ],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  {
    stars: [
      { elevation: 12, azimuth: 88 },
      { elevation: 15, azimuth: 97 },
      { elevation: 17, azimuth: 107 },
      { elevation: 15, azimuth: 118 },
      { elevation: 11, azimuth: 128 },
    ],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
] as const

const COMET_PATHS = [
  {
    start: { elevation: 56, azimuth: 292 },
    end: { elevation: 33, azimuth: 248 },
    duration: 6.2,
    delay: 2.6,
    offset: 0.8,
  },
  {
    start: { elevation: 61, azimuth: 28 },
    end: { elevation: 36, azimuth: 74 },
    duration: 5.4,
    delay: 3.2,
    offset: 3.6,
  },
  {
    start: { elevation: 48, azimuth: 334 },
    end: { elevation: 27, azimuth: 18 },
    duration: 4.8,
    delay: 3.8,
    offset: 6.2,
  },
  {
    start: { elevation: 44, azimuth: 84 },
    end: { elevation: 21, azimuth: 128 },
    duration: 5.6,
    delay: 4.2,
    offset: 8.4,
  },
] as const

function createStarPositions(count: number, seedBase: number, phiMax = 0.46) {
  const arr = new Float32Array(count * 3)
  let seed = seedBase

  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
    return seed / 4_294_967_296
  }

  for (let i = 0; i < count; i++) {
    const theta = random() * Math.PI * 2
    const phi = random() * Math.PI * phiMax
    const r = 7_500 + random() * 1_200
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    arr[i * 3 + 1] = r * Math.cos(phi)
    arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }

  return arr
}

function createConstellationData(radius = 7_420) {
  const lineCoords: number[] = []
  const pointCoords: number[] = []
  const tempA = new THREE.Vector3()
  const tempB = new THREE.Vector3()
  const tempMid = new THREE.Vector3()

  for (const constellation of CONSTELLATION_SETS) {
    const points = constellation.stars.map((star) => {
      return vecFromSpherical(star.elevation, star.azimuth, new THREE.Vector3())
        .multiplyScalar(radius)
        .clone()
    })

    for (const point of points) {
      pointCoords.push(point.x, point.y, point.z)
    }

    for (const [from, to] of constellation.segments) {
      tempA.copy(points[from])
      tempB.copy(points[to])
      tempMid.copy(tempA).add(tempB).multiplyScalar(0.5)
      tempA.lerp(tempMid, 0.34)
      tempB.lerp(tempMid, 0.34)
      lineCoords.push(tempA.x, tempA.y, tempA.z, tempB.x, tempB.y, tempB.z)
    }
  }

  return {
    lines: new Float32Array(lineCoords),
    stars: new Float32Array(pointCoords),
  }
}

function applySkyUniforms(
  material: THREE.ShaderMaterial,
  scene: SceneSnapshot,
  sunPosition: THREE.Vector3,
  elapsedTime: number,
) {
  const uniforms = material.uniforms

  uniforms['time'].value = elapsedTime
  uniforms['sunPosition'].value.copy(sunPosition)
  uniforms['rayleigh'].value = scene.rayleigh
  uniforms['turbidity'].value = scene.turbidity
  uniforms['mieCoefficient'].value = scene.mieCoefficient
  uniforms['mieDirectionalG'].value = scene.mieG

  if (uniforms['cloudCoverage'] !== undefined) {
    uniforms['cloudScale'].value = scene.cloudScale
    uniforms['cloudSpeed'].value = scene.cloudSpeed
    uniforms['cloudCoverage'].value = scene.cloudCoverage
    uniforms['cloudDensity'].value = scene.cloudDensity
    uniforms['cloudElevation'].value = scene.cloudElevation
  }
}

function roundToStep(value: number, step: number) {
  return Math.round(value / step) * step
}

function buildEnvironmentKey(scene: SceneSnapshot) {
  return [
    roundToStep(scene.sunElev, 0.25).toFixed(2),
    roundToStep(scene.sunAz, 0.25).toFixed(2),
    roundToStep(scene.rayleigh, 0.05).toFixed(2),
    roundToStep(scene.turbidity, 0.05).toFixed(2),
    roundToStep(scene.mieCoefficient, 0.0001).toFixed(4),
    roundToStep(scene.mieG, 0.01).toFixed(2),
    roundToStep(scene.cloudCoverage, 0.01).toFixed(2),
    roundToStep(scene.cloudDensity, 0.01).toFixed(2),
  ].join('|')
}

function setSceneEnvironment(scene: THREE.Scene, texture: THREE.Texture | null) {
  scene.environment = texture
}

function createGlowTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  if (!context) {
    return new THREE.Texture()
  }

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.12, 'rgba(255, 245, 220, 0.98)')
  gradient.addColorStop(0.35, 'rgba(255, 215, 150, 0.46)')
  gradient.addColorStop(0.7, 'rgba(255, 180, 110, 0.08)')
  gradient.addColorStop(1, 'rgba(255, 180, 110, 0)')

  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createStarGlowTexture() {
  const size = 192
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    return new THREE.Texture()
  }

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.22, 'rgba(225, 236, 255, 0.95)')
  gradient.addColorStop(0.58, 'rgba(175, 205, 255, 0.28)')
  gradient.addColorStop(1, 'rgba(175, 205, 255, 0)')

  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createMoonCrescentTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    return new THREE.Texture()
  }

  context.clearRect(0, 0, size, size)
  context.fillStyle = 'rgba(238, 236, 221, 0.98)'
  context.beginPath()
  context.arc(size * 0.48, size * 0.5, size * 0.23, 0, Math.PI * 2)
  context.fill()

  context.globalCompositeOperation = 'destination-out'
  context.beginPath()
  context.arc(size * 0.58, size * 0.46, size * 0.23, 0, Math.PI * 2)
  context.fill()
  context.globalCompositeOperation = 'source-over'

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function createMoonGlowTexture() {
  const size = 224
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    return new THREE.Texture()
  }

  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )

  gradient.addColorStop(0, 'rgba(222, 235, 255, 0.88)')
  gradient.addColorStop(0.28, 'rgba(180, 212, 255, 0.34)')
  gradient.addColorStop(1, 'rgba(180, 212, 255, 0)')

  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function Starfield() {
  const baseMatRef = useRef<THREE.PointsMaterial>(null)
  const brightMatRef = useRef<THREE.PointsMaterial>(null)
  const basePositions = useMemo(() => createStarPositions(3_500, 1_337), [])
  const brightPositions = useMemo(() => createStarPositions(240, 3_211, 0.42), [])

  useFrame((state, delta) => {
    if (!baseMatRef.current || !brightMatRef.current) return
    const safeDelta = Math.min(delta, 1 / 30)
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    const glowFactor = THREE.MathUtils.clamp(scene.starsOpacity * 1.2, 0, 1)
    const shimmer = 0.94 + Math.sin(state.clock.elapsedTime * 0.9) * 0.11
    const brightPulse = 0.9 + Math.sin(state.clock.elapsedTime * 2.8) * 0.24

    baseMatRef.current.opacity = THREE.MathUtils.lerp(
      baseMatRef.current.opacity,
      Math.min(1, glowFactor * 1.28 * shimmer),
      safeDelta * 1.7,
    )
    baseMatRef.current.size = THREE.MathUtils.lerp(
      baseMatRef.current.size,
      2.3 + glowFactor * 1.15,
      safeDelta * 1.5,
    )

    brightMatRef.current.opacity = THREE.MathUtils.lerp(
      brightMatRef.current.opacity,
      Math.min(1, glowFactor * 1.32 * brightPulse),
      safeDelta * 2.4,
    )
    brightMatRef.current.size = THREE.MathUtils.lerp(
      brightMatRef.current.size,
      4 + glowFactor * 2.4,
      safeDelta * 2,
    )
  })

  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[basePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={baseMatRef}
          size={1.8}
          color="#dde8ff"
          transparent
          opacity={0}
          sizeAttenuation={false}
          depthWrite={false}
        />
      </points>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[brightPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={brightMatRef}
          size={2.8}
          color="#f4f8ff"
          transparent
          opacity={0}
          sizeAttenuation={false}
          depthWrite={false}
        />
      </points>
    </>
  )
}

function Constellations() {
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null)
  const pointMatRef = useRef<THREE.PointsMaterial>(null)
  const constellationData = useMemo(() => createConstellationData(), [])

  useFrame((state, delta) => {
    if (!lineMatRef.current || !pointMatRef.current) {
      return
    }

    const safeDelta = Math.min(delta, 1 / 30)
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    const starVisibility = THREE.MathUtils.clamp(scene.starsOpacity * 0.7, 0, 1)
    const pulse = 0.94 + Math.sin(state.clock.elapsedTime * 1.9) * 0.08
    const constellationVisibility = THREE.MathUtils.clamp(scene.starsOpacity * 0.62, 0, 1)
    lineMatRef.current.opacity = THREE.MathUtils.lerp(
      lineMatRef.current.opacity,
      constellationVisibility * 0.12,
      safeDelta * 2,
    )
    pointMatRef.current.opacity = THREE.MathUtils.lerp(
      pointMatRef.current.opacity,
      Math.min(0.42, starVisibility * 0.42 * pulse),
      safeDelta * 2.1,
    )
    pointMatRef.current.size = THREE.MathUtils.lerp(
      pointMatRef.current.size,
      0.92 + constellationVisibility * 0.16,
      safeDelta * 2.1,
    )
  })

  return (
    <>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[constellationData.lines, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={lineMatRef}
          color="#8eb7ff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[constellationData.stars, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={pointMatRef}
          color="#eef6ff"
          size={0.95}
          transparent
          opacity={0}
          sizeAttenuation={false}
          depthWrite={false}
        />
      </points>
    </>
  )
}

function Comet({
  start,
  end,
  duration,
  delay,
  offset,
}: {
  start: SphericalPoint
  end: SphericalPoint
  duration: number
  delay: number
  offset: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Sprite>(null)
  const headMatRef = useRef<THREE.SpriteMaterial>(null)
  const trailMatRef = useRef<THREE.LineBasicMaterial>(null)
  const trailAttrRef = useRef<THREE.BufferAttribute>(null)
  const glowTexture = useMemo(() => createStarGlowTexture(), [])
  const trailPositions = useMemo(() => new Float32Array(6), [])
  const path = useMemo(() => {
    return {
      start: vecFromSpherical(start.elevation, start.azimuth, new THREE.Vector3()).multiplyScalar(7_080),
      end: vecFromSpherical(end.elevation, end.azimuth, new THREE.Vector3()).multiplyScalar(7_080),
    }
  }, [end.azimuth, end.elevation, start.azimuth, start.elevation])
  const _headPos = useRef(new THREE.Vector3())
  const _tailPos = useRef(new THREE.Vector3())

  useEffect(() => {
    return () => {
      glowTexture.dispose()
    }
  }, [glowTexture])

  useFrame((state) => {
    if (!groupRef.current || !headRef.current || !headMatRef.current || !trailMatRef.current || !trailAttrRef.current) {
      return
    }

    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    const nightVisibility = THREE.MathUtils.clamp(scene.starsOpacity * 1.2, 0, 1)
    const cycle = duration + delay
    const localTime = (state.clock.elapsedTime + offset) % cycle

    if (nightVisibility <= 0.05 || localTime > duration) {
      groupRef.current.visible = false
      return
    }

    const progress = localTime / duration
    const easedProgress = THREE.MathUtils.smootherstep(progress, 0, 1)
    const tailProgress = Math.max(0, easedProgress - 0.032)
    const fade = 0.72 + Math.sin(progress * Math.PI) * 0.28

    _headPos.current.copy(path.start).lerp(path.end, easedProgress)
    _tailPos.current.copy(path.start).lerp(path.end, tailProgress)
    headRef.current.position.copy(_headPos.current)
    headRef.current.scale.setScalar(14 + fade * 7)

    trailPositions[0] = _tailPos.current.x
    trailPositions[1] = _tailPos.current.y
    trailPositions[2] = _tailPos.current.z
    trailPositions[3] = _headPos.current.x
    trailPositions[4] = _headPos.current.y
    trailPositions[5] = _headPos.current.z
    trailAttrRef.current.needsUpdate = true

    headMatRef.current.opacity = Math.min(1, fade * 1.15 * nightVisibility)
    trailMatRef.current.opacity = fade * 0.78 * nightVisibility
    groupRef.current.visible = true
  })

  return (
    <group ref={groupRef} visible={false} renderOrder={9}>
      <line>
        <bufferGeometry>
          <bufferAttribute
            ref={trailAttrRef}
            attach="attributes-position"
            args={[trailPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          ref={trailMatRef}
          color="#eff8ff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </line>
      <sprite ref={headRef}>
        <spriteMaterial
          ref={headMatRef}
          map={glowTexture}
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  )
}

function CometField() {
  return (
    <>
      {COMET_PATHS.map((comet) => (
        <Comet
          key={`${comet.start.azimuth}-${comet.end.azimuth}`}
          start={comet.start}
          end={comet.end}
          duration={comet.duration}
          delay={comet.delay}
          offset={comet.offset}
        />
      ))}
    </>
  )
}

function Moon() {
  const groupRef = useRef<THREE.Group>(null)
  const crescentRef = useRef<THREE.Sprite>(null)
  const crescentMatRef  = useRef<THREE.SpriteMaterial>(null)
  const glowMatRef = useRef<THREE.SpriteMaterial>(null)
  const crescentTexture = useMemo(() => createMoonCrescentTexture(), [])
  const glowTexture = useMemo(() => createMoonGlowTexture(), [])
  const _pos = useRef(new THREE.Vector3())

  useEffect(() => {
    return () => {
      crescentTexture.dispose()
      glowTexture.dispose()
    }
  }, [crescentTexture, glowTexture])

  useFrame((_, delta) => {
    if (!groupRef.current || !crescentRef.current || !crescentMatRef.current || !glowMatRef.current) return
    const safeDelta = Math.min(delta, 1 / 30)
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    vecFromSpherical(scene.moonElev, scene.moonAz, _pos.current)
    groupRef.current.position.copy(_pos.current).multiplyScalar(4_200)

    const moonVisibility = THREE.MathUtils.clamp(scene.moonOpacity * 1.05, 0, 1)
    const glowVisibility = THREE.MathUtils.clamp(scene.nightFactor * 0.75 + scene.twilightFactor * 0.35, 0, 1)
    const orientation = THREE.MathUtils.degToRad(scene.sunAz - scene.moonAz + 90)

    crescentRef.current.scale.setScalar(132 + glowVisibility * 28)
    crescentMatRef.current.rotation = orientation
    crescentMatRef.current.opacity = THREE.MathUtils.lerp(
      crescentMatRef.current.opacity,
      moonVisibility,
      safeDelta * 2,
    )
    glowMatRef.current.opacity = THREE.MathUtils.lerp(
      glowMatRef.current.opacity,
      glowVisibility * 0.34,
      safeDelta * 2,
    )
    groupRef.current.visible = glowVisibility > 0.02
  })

  return (
    <group ref={groupRef} visible={false} renderOrder={8}>
      <sprite scale={[280, 280, 1]}>
        <spriteMaterial
          ref={glowMatRef}
          map={glowTexture}
          color="#c4d9ff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={crescentRef}>
        <spriteMaterial
          ref={crescentMatRef}
          map={crescentTexture}
          color="#ebe7d6"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
        />
      </sprite>
    </group>
  )
}

function SunGlow() {
  const groupRef = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Sprite>(null)
  const coreRef = useRef<THREE.Sprite>(null)
  const haloMatRef = useRef<THREE.SpriteMaterial>(null)
  const coreMatRef = useRef<THREE.SpriteMaterial>(null)
  const glowTexture = useMemo(() => createGlowTexture(), [])
  const _pos = useRef(new THREE.Vector3())

  useEffect(() => {
    return () => {
      glowTexture.dispose()
    }
  }, [glowTexture])

  useFrame((_, delta) => {
    if (!groupRef.current || !haloMatRef.current || !coreMatRef.current) return
    const safeDelta = Math.min(delta, 1 / 30)
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    vecFromSpherical(scene.sunElev, scene.sunAz, _pos.current)
    groupRef.current.position.copy(_pos.current).multiplyScalar(4_350)

    const visibleFactor = THREE.MathUtils.clamp((scene.sunElev + 3) / 10, 0, 1)
    const haloOpacity = scene.sunHaloOpacity * visibleFactor
    const coreOpacity = THREE.MathUtils.clamp(0.16 + visibleFactor * 0.34, 0, 0.5)

    if (haloRef.current) {
      haloRef.current.scale.setScalar(scene.sunHaloScale)
    }

    if (coreRef.current) {
      coreRef.current.scale.setScalar(scene.sunCoreScale)
    }

    haloMatRef.current.color.setHex(scene.sunGlowColorHex)
    haloMatRef.current.opacity = THREE.MathUtils.lerp(
      haloMatRef.current.opacity,
      haloOpacity,
      safeDelta * 3,
    )
    coreMatRef.current.color.setHex(scene.sunColorHex)
    coreMatRef.current.opacity = THREE.MathUtils.lerp(
      coreMatRef.current.opacity,
      coreOpacity,
      safeDelta * 3,
    )

    groupRef.current.visible = visibleFactor > 0.001
  })

  return (
    <group ref={groupRef} renderOrder={10}>
      <sprite ref={haloRef}>
        <spriteMaterial
          ref={haloMatRef}
          map={glowTexture}
          color="#fff1c8"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite ref={coreRef}>
        <spriteMaterial
          ref={coreMatRef}
          map={glowTexture}
          color="#fff7dc"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  )
}

export default function OceanScene() {
  const { gl, scene: threeScene } = useThree()

  const sky = useMemo(() => {
    const s   = new SkyImpl()
    s.scale.setScalar(10_000)
    const u   = (s.material as THREE.ShaderMaterial).uniforms
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    u['mieCoefficient'].value  = scene.mieCoefficient
    u['turbidity'].value       = scene.turbidity
    u['rayleigh'].value        = scene.rayleigh
    u['mieDirectionalG'].value = scene.mieG

    if (u['cloudScale'] !== undefined) {
      u['cloudScale'].value = scene.cloudScale
      u['cloudSpeed'].value = scene.cloudSpeed
      u['cloudCoverage'].value = scene.cloudCoverage
      u['cloudDensity'].value = scene.cloudDensity
      u['cloudElevation'].value = scene.cloudElevation
    }

    vecFromSpherical(scene.sunElev, scene.sunAz, u['sunPosition'].value)
    return s
  }, [])

  const envSky = useMemo(() => {
    const s = new SkyImpl()
    s.scale.setScalar(10_000)
    return s
  }, [])
  const pmremGenerator = useMemo(() => new THREE.PMREMGenerator(gl), [gl])
  const envScene = useMemo(() => {
    const s = new THREE.Scene()
    s.add(envSky)
    return s
  }, [envSky])
  const envTargetRef = useRef<THREE.WebGLRenderTarget | null>(null)
  const envKeyRef = useRef('')
  const skyTimeRef = useRef(0)
  const _sunPos   = useRef(new THREE.Vector3())

  useEffect(() => {
    return () => {
      envTargetRef.current?.dispose()
      pmremGenerator.dispose()
    }
  }, [pmremGenerator])

  useFrame((state, delta) => {
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    const safeDelta = Math.min(delta, 1 / 30)
    const envKey = buildEnvironmentKey(scene)

    skyTimeRef.current += safeDelta

    vecFromSpherical(scene.sunElev, scene.sunAz, _sunPos.current)
    applySkyUniforms(
      sky.material as THREE.ShaderMaterial,
      scene,
      _sunPos.current,
      skyTimeRef.current,
    )
    applySkyUniforms(
      envSky.material as THREE.ShaderMaterial,
      scene,
      _sunPos.current,
      skyTimeRef.current,
    )

    if (envKey !== envKeyRef.current || !envTargetRef.current) {
      envKeyRef.current = envKey
      envTargetRef.current?.dispose()
      envTargetRef.current = pmremGenerator.fromScene(envScene)
      setSceneEnvironment(threeScene, envTargetRef.current.texture)
    }

    state.gl.toneMappingExposure = scene.exposure
  })

  return (
    <>
      <primitive object={sky} />
      <SunGlow />
      <Starfield />
      <Constellations />
      <CometField />
      <Moon />
      <Suspense fallback={null}>
        <Ocean />
        <SceneEncounters />
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.45}
        minPolarAngle={Math.PI * 0.16}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, 8, 0]}
      />
    </>
  )
}
