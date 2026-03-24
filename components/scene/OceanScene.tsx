'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Sky as SkyImpl } from 'three/examples/jsm/objects/Sky.js'
import * as THREE from 'three'
import Ocean from './Ocean'
import SceneEncounters from './SceneEncounters'
import { sceneParams } from './sceneParams'
import {
  getSceneSnapshot,
  type SceneSnapshot,
  vecFromSpherical,
} from './timeUtils'

function createStarPositions() {
  const count = 3_500
  const arr = new Float32Array(count * 3)
  let seed = 1_337

  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0
    return seed / 4_294_967_296
  }

  for (let i = 0; i < count; i++) {
    const theta = random() * Math.PI * 2
    const phi = random() * Math.PI * 0.46
    const r = 7_500 + random() * 1_200
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    arr[i * 3 + 1] = r * Math.cos(phi)
    arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }

  return arr
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

function Starfield() {
  const matRef = useRef<THREE.PointsMaterial>(null)
  const positions = useMemo(() => createStarPositions(), [])

  useFrame((_, delta) => {
    if (!matRef.current) return
    const safeDelta = Math.min(delta, 1 / 30)
    const { starsOpacity } = getSceneSnapshot(new Date(), sceneParams.location)
    matRef.current.opacity = THREE.MathUtils.lerp(
      matRef.current.opacity, starsOpacity, safeDelta * 1.5,
    )
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={1.8}
        color="#dde8ff"
        transparent
        opacity={0}
        sizeAttenuation={false}
        depthWrite={false}
      />
    </points>
  )
}

function Moon() {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef  = useRef<THREE.MeshStandardMaterial>(null)
  const _pos    = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return
    const safeDelta = Math.min(delta, 1 / 30)
    const scene = getSceneSnapshot(new Date(), sceneParams.location)
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

export default function OceanScene() {
  const { gl, scene: threeScene } = useThree()

  const sky = useMemo(() => {
    const s   = new SkyImpl()
    s.scale.setScalar(10_000)
    const u   = (s.material as THREE.ShaderMaterial).uniforms
    const scene = getSceneSnapshot(new Date(), sceneParams.location)
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
    const scene = getSceneSnapshot(new Date(), sceneParams.location)
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
      <Starfield />
      <Moon />
      <Suspense fallback={null}>
        <Ocean />
{/*         <SceneEncounters />
 */}      </Suspense>
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
