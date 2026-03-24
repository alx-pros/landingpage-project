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
      { elevation: 55, azimuth: 330 },
      { elevation: 58, azimuth: 342 },
      { elevation: 61, azimuth: 356 },
      { elevation: 64, azimuth: 9 },
      { elevation: 69, azimuth: 18 },
      { elevation: 74, azimuth: 24 },
      { elevation: 78, azimuth: 33 },
    ],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  {
    stars: [
      { elevation: 64, azimuth: 36 },
      { elevation: 69, azimuth: 28 },
      { elevation: 72, azimuth: 18 },
      { elevation: 69, azimuth: 10 },
      { elevation: 64, azimuth: 3 },
    ],
    segments: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    stars: [
      { elevation: 28, azimuth: 218 },
      { elevation: 34, azimuth: 225 },
      { elevation: 31, azimuth: 233 },
      { elevation: 22, azimuth: 222 },
      { elevation: 17, azimuth: 227 },
      { elevation: 23, azimuth: 238 },
      { elevation: 28, azimuth: 244 },
    ],
    segments: [[0, 1], [1, 2], [1, 3], [3, 4], [2, 5], [5, 6]],
  },
] as const

const COMET_PATHS = [
  {
    start: { elevation: 68, azimuth: 300 },
    end: { elevation: 47, azimuth: 255 },
    duration: 2.7,
    delay: 12,
    offset: 1.5,
  },
  {
    start: { elevation: 73, azimuth: 35 },
    end: { elevation: 51, azimuth: 75 },
    duration: 2.3,
    delay: 16,
    offset: 7.4,
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

function Starfield() {
  const baseMatRef = useRef<THREE.PointsMaterial>(null)
  const brightMatRef = useRef<THREE.PointsMaterial>(null)
  const basePositions = useMemo(() => createStarPositions(3_500, 1_337), [])
  const brightPositions = useMemo(() => createStarPositions(240, 3_211, 0.42), [])

  useFrame((state, delta) => {
    if (!baseMatRef.current || !brightMatRef.current) return
    const safeDelta = Math.min(delta, 1 / 30)
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    const glowFactor = THREE.MathUtils.clamp(
      scene.starsOpacity + scene.twilightFactor * 0.42,
      0,
      1,
    )
    const shimmer = 0.88 + Math.sin(state.clock.elapsedTime * 0.7) * 0.08
    const brightPulse = 0.78 + Math.sin(state.clock.elapsedTime * 2.4) * 0.22

    baseMatRef.current.opacity = THREE.MathUtils.lerp(
      baseMatRef.current.opacity, glowFactor * 0.96 * shimmer, safeDelta * 1.5,
    )
    baseMatRef.current.size = THREE.MathUtils.lerp(
      baseMatRef.current.size,
      1.8 + glowFactor * 0.55,
      safeDelta * 1.3,
    )

    brightMatRef.current.opacity = THREE.MathUtils.lerp(
      brightMatRef.current.opacity,
      glowFactor * 0.78 * brightPulse,
      safeDelta * 2.1,
    )
    brightMatRef.current.size = THREE.MathUtils.lerp(
      brightMatRef.current.size,
      2.6 + glowFactor * 1.45,
      safeDelta * 1.8,
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

function PolarStarAndConstellations() {
  const northStarRef = useRef<THREE.Sprite>(null)
  const northStarMatRef = useRef<THREE.SpriteMaterial>(null)
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null)
  const pointMatRef = useRef<THREE.PointsMaterial>(null)
  const glowTexture = useMemo(() => createStarGlowTexture(), [])
  const constellationData = useMemo(() => createConstellationData(), [])
  const _northStarPos = useRef(new THREE.Vector3())

  useEffect(() => {
    return () => {
      glowTexture.dispose()
    }
  }, [glowTexture])

  useFrame((state, delta) => {
    if (!northStarRef.current || !northStarMatRef.current || !lineMatRef.current || !pointMatRef.current) {
      return
    }

    const safeDelta = Math.min(delta, 1 / 30)
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    const starVisibility = THREE.MathUtils.clamp(
      scene.starsOpacity + scene.twilightFactor * 0.35,
      0,
      1,
    )
    const constellationVisibility = THREE.MathUtils.clamp(scene.nightFactor * 1.15, 0, 1)
    const latitude = sceneParams.location?.latitude ?? 43
    const polarisElevation = THREE.MathUtils.clamp(Math.abs(latitude), 24, 66)
    const pulse = 0.88 + Math.sin(state.clock.elapsedTime * 1.8) * 0.12

    vecFromSpherical(polarisElevation, 0, _northStarPos.current)
    northStarRef.current.position.copy(_northStarPos.current).multiplyScalar(7_380)
    northStarRef.current.scale.setScalar(90 + starVisibility * 65 * pulse)

    northStarMatRef.current.opacity = THREE.MathUtils.lerp(
      northStarMatRef.current.opacity,
      starVisibility * 0.92 * pulse,
      safeDelta * 2.2,
    )
    lineMatRef.current.opacity = THREE.MathUtils.lerp(
      lineMatRef.current.opacity,
      constellationVisibility * 0.42,
      safeDelta * 1.8,
    )
    pointMatRef.current.opacity = THREE.MathUtils.lerp(
      pointMatRef.current.opacity,
      constellationVisibility * 0.88,
      safeDelta * 1.8,
    )
    pointMatRef.current.size = THREE.MathUtils.lerp(
      pointMatRef.current.size,
      3.1 + constellationVisibility * 0.8,
      safeDelta * 1.8,
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
          size={3.1}
          transparent
          opacity={0}
          sizeAttenuation={false}
          depthWrite={false}
        />
      </points>
      <sprite ref={northStarRef} renderOrder={9}>
        <spriteMaterial
          ref={northStarMatRef}
          map={glowTexture}
          color="#eef6ff"
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
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
    const nightVisibility = THREE.MathUtils.clamp((scene.nightFactor - 0.08) / 0.92, 0, 1)
    const cycle = duration + delay
    const localTime = (state.clock.elapsedTime + offset) % cycle

    if (nightVisibility <= 0.05 || localTime > duration) {
      groupRef.current.visible = false
      return
    }

    const progress = localTime / duration
    const easedProgress = THREE.MathUtils.smootherstep(progress, 0, 1)
    const tailProgress = Math.max(0, easedProgress - 0.18)
    const fade = Math.sin(progress * Math.PI)

    _headPos.current.copy(path.start).lerp(path.end, easedProgress)
    _tailPos.current.copy(path.start).lerp(path.end, tailProgress)
    headRef.current.position.copy(_headPos.current)
    headRef.current.scale.setScalar(62 + fade * 34)

    trailPositions[0] = _tailPos.current.x
    trailPositions[1] = _tailPos.current.y
    trailPositions[2] = _tailPos.current.z
    trailPositions[3] = _headPos.current.x
    trailPositions[4] = _headPos.current.y
    trailPositions[5] = _headPos.current.z
    trailAttrRef.current.needsUpdate = true

    headMatRef.current.opacity = fade * nightVisibility * 0.95
    trailMatRef.current.opacity = fade * nightVisibility * 0.72
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
          color="#dceeff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </line>
      <sprite ref={headRef}>
        <spriteMaterial
          ref={headMatRef}
          map={glowTexture}
          color="#f6fbff"
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
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef  = useRef<THREE.MeshStandardMaterial>(null)
  const _pos    = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return
    const safeDelta = Math.min(delta, 1 / 30)
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location)
    vecFromSpherical(scene.moonElev, scene.moonAz, _pos.current)
    meshRef.current.position.copy(_pos.current).multiplyScalar(4_200)
    matRef.current.opacity = THREE.MathUtils.lerp(
      matRef.current.opacity, scene.moonOpacity, safeDelta * 1.5,
    )
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[50, 32, 32]} />
      <meshStandardMaterial
        ref={matRef}
        color="#d8d0c0"
        emissive="#b0a888"
        emissiveIntensity={1.0}
        roughness={0.95}
        metalness={0}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
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
      <PolarStarAndConstellations />
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
