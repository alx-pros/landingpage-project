import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null
      this.onloadend = null
      this.onerror = null
    }

    async readAsArrayBuffer(blob) {
      try {
        this.result = await blob.arrayBuffer()
        this.onloadend?.()
      } catch (error) {
        this.onerror?.(error)
      }
    }

    async readAsDataURL(blob) {
      try {
        const buffer = Buffer.from(await blob.arrayBuffer())
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`
        this.onloadend?.()
      } catch (error) {
        this.onerror?.(error)
      }
    }
  }
}

const outDir = new URL('../public/models/', import.meta.url)
const exporter = new GLTFExporter()

function standard(color, roughness = 0.85, metalness = 0.04, transparent = false, opacity = 1) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent, opacity })
}

function namedMesh(name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  return mesh
}

function bottleModel() {
  const group = new THREE.Group()
  group.name = 'FloatingBottle'

  const body = namedMesh(
    'BottleBody',
    new THREE.CylinderGeometry(0.18, 0.22, 1.4, 12),
    standard(0xcfe4e1, 0.2, 0.04, true, 0.45),
  )
  const note = namedMesh(
    'BottleNote',
    new THREE.BoxGeometry(0.62, 0.16, 0.02),
    standard(0xf1e8c8, 0.94),
  )
  const cork = namedMesh(
    'BottleCork',
    new THREE.CylinderGeometry(0.08, 0.09, 0.14, 8),
    standard(0x7e5144, 0.88),
  )

  note.rotation.z = Math.PI * 0.5
  cork.position.y = 0.74

  group.add(body, note, cork)
  return group
}

function buoyModel() {
  const group = new THREE.Group()
  group.name = 'Buoy'

  const floatBody = namedMesh(
    'BuoyFloat',
    new THREE.CylinderGeometry(0.26, 0.32, 1.2, 12),
    standard(0xff7f2a, 0.65),
  )
  floatBody.position.y = 0.65

  const light = namedMesh(
    'BuoyLight',
    new THREE.SphereGeometry(0.14, 10, 10),
    standard(0xfff6d2, 0.32),
  )
  light.position.y = 1.32

  const base = namedMesh(
    'BuoyBase',
    new THREE.CylinderGeometry(0.16, 0.2, 0.5, 12),
    standard(0xd6d0c2, 0.78),
  )
  base.position.y = 0.18

  group.add(floatBody, light, base)
  return group
}

function crateModel() {
  const group = new THREE.Group()
  group.name = 'DriftCrate'

  const body = namedMesh(
    'CrateBody',
    new THREE.BoxGeometry(1.2, 0.72, 0.82),
    standard(0x8c6844, 0.96),
  )
  const lid = namedMesh(
    'CrateLid',
    new THREE.BoxGeometry(1.34, 0.14, 0.94),
    standard(0x6f4b2f, 0.98),
  )
  lid.position.y = 0.04

  group.add(body, lid)
  return group
}

function islandModel() {
  const group = new THREE.Group()
  group.name = 'PalmIsland'

  const rock = namedMesh(
    'IslandRock',
    new THREE.ConeGeometry(86, 54, 7),
    standard(0x3a4740, 0.98),
  )
  const sand = namedMesh(
    'IslandSand',
    new THREE.CylinderGeometry(56, 78, 18, 18),
    standard(0xcdb887, 0.95),
  )
  sand.position.y = 16

  const trunkA = namedMesh(
    'PalmTrunkA',
    new THREE.CylinderGeometry(1.4, 2.4, 28, 6),
    standard(0x704f33, 0.94),
  )
  trunkA.position.set(-14, 39, 10)

  const leavesA = namedMesh(
    'PalmLeavesA',
    new THREE.ConeGeometry(11, 12, 5),
    standard(0x2d6d45, 0.96),
  )
  leavesA.position.set(-14, 54, 10)

  const trunkB = namedMesh(
    'PalmTrunkB',
    new THREE.CylinderGeometry(1.2, 2.1, 24, 6),
    standard(0x76553a, 0.94),
  )
  trunkB.position.set(18, 32, -8)

  const leavesB = namedMesh(
    'PalmLeavesB',
    new THREE.ConeGeometry(9, 10, 5),
    standard(0x2c6f49, 0.96),
  )
  leavesB.position.set(18, 44, -8)

  group.add(rock, sand, trunkA, leavesA, trunkB, leavesB)
  return group
}

function cliffModel() {
  const group = new THREE.Group()
  group.name = 'Cliff'

  const blockA = namedMesh(
    'CliffBlockA',
    new THREE.BoxGeometry(82, 68, 46),
    standard(0x43423d, 0.98),
  )
  blockA.position.set(-22, 34, 0)

  const blockB = namedMesh(
    'CliffBlockB',
    new THREE.BoxGeometry(58, 48, 38),
    standard(0x4c4c44, 0.98),
  )
  blockB.position.set(24, 24, -6)

  const base = namedMesh(
    'CliffBase',
    new THREE.CylinderGeometry(82, 95, 12, 10),
    standard(0x2f3834, 1),
  )
  base.position.y = 4

  group.add(blockA, blockB, base)
  return group
}

function seaStackModel() {
  const group = new THREE.Group()
  group.name = 'SeaStack'

  const stack = namedMesh(
    'StackBody',
    new THREE.CylinderGeometry(18, 36, 92, 8),
    standard(0x4a4a43, 0.99),
  )
  stack.position.y = 46

  const base = namedMesh(
    'StackBase',
    new THREE.CylinderGeometry(42, 54, 12, 9),
    standard(0x303734, 1),
  )
  base.position.y = 5

  const trunk = namedMesh(
    'StackPalmTrunk',
    new THREE.CylinderGeometry(0.9, 1.5, 14, 5),
    standard(0x74563e, 0.95),
  )
  trunk.position.set(2, 101, 2)

  const leaves = namedMesh(
    'StackPalmLeaves',
    new THREE.ConeGeometry(5.5, 6.5, 5),
    standard(0x2d6d45, 0.96),
  )
  leaves.position.set(2, 108, 2)

  group.add(stack, base, trunk, leaves)
  return group
}

function turtleModel() {
  const group = new THREE.Group()
  group.name = 'Turtle'

  const shell = namedMesh(
    'Shell',
    new THREE.SphereGeometry(2.4, 16, 16),
    standard(0x5d7446, 0.95),
  )
  shell.scale.set(1.3, 0.35, 1.55)

  const belly = namedMesh(
    'Belly',
    new THREE.SphereGeometry(2.05, 12, 12),
    standard(0x9ab072, 0.95),
  )
  belly.position.y = 0.2
  belly.scale.set(1.05, 0.18, 1.15)

  const head = namedMesh(
    'Head',
    new THREE.SphereGeometry(1.2, 12, 12),
    standard(0x708454, 0.95),
  )
  head.position.set(0, 0.05, 2.35)
  head.scale.set(0.35, 0.3, 0.5)

  const leftFrontFlipper = namedMesh(
    'LeftFrontFlipper',
    new THREE.SphereGeometry(1.4, 10, 10),
    standard(0x6e8652, 0.95),
  )
  leftFrontFlipper.position.set(2.6, -0.08, 0.9)
  leftFrontFlipper.scale.set(0.95, 0.08, 0.45)

  const rightFrontFlipper = leftFrontFlipper.clone()
  rightFrontFlipper.name = 'RightFrontFlipper'
  rightFrontFlipper.position.x *= -1

  const leftRearFlipper = namedMesh(
    'LeftRearFlipper',
    new THREE.SphereGeometry(1.2, 10, 10),
    standard(0x6e8652, 0.95),
  )
  leftRearFlipper.position.set(1.9, -0.08, -1.5)
  leftRearFlipper.scale.set(0.6, 0.08, 0.32)

  const rightRearFlipper = leftRearFlipper.clone()
  rightRearFlipper.name = 'RightRearFlipper'
  rightRearFlipper.position.x *= -1

  group.add(shell, belly, head, leftFrontFlipper, rightFrontFlipper, leftRearFlipper, rightRearFlipper)
  return group
}

function dolphinModel() {
  const group = new THREE.Group()
  group.name = 'Dolphin'

  const body = namedMesh(
    'Body',
    new THREE.SphereGeometry(1.4, 16, 12),
    standard(0x7f97a9, 0.78),
  )
  body.scale.set(2.8, 0.72, 0.95)

  const snout = namedMesh(
    'Snout',
    new THREE.ConeGeometry(0.9, 2.1, 10),
    standard(0x748ca0, 0.78),
  )
  snout.position.x = 3.25
  snout.rotation.z = -Math.PI * 0.5

  const dorsalFin = namedMesh(
    'DorsalFin',
    new THREE.ConeGeometry(0.42, 1.45, 6),
    standard(0x6b8194, 0.82),
  )
  dorsalFin.position.set(0.2, 1.05, 0)
  dorsalFin.rotation.z = -Math.PI * 0.5

  const tailCore = namedMesh(
    'TailCore',
    new THREE.ConeGeometry(0.92, 2, 10),
    standard(0x71869a, 0.8),
  )
  tailCore.position.set(-3.1, 0.18, 0)
  tailCore.rotation.z = Math.PI * 0.5

  const tailTop = namedMesh(
    'TailTop',
    new THREE.ConeGeometry(0.35, 1.2, 5),
    standard(0x71869a, 0.8),
  )
  tailTop.position.set(-4.55, 0.12, 0.62)
  tailTop.rotation.set(0.2, 0, 0.85)

  const tailBottom = namedMesh(
    'TailBottom',
    new THREE.ConeGeometry(0.35, 1.2, 5),
    standard(0x71869a, 0.8),
  )
  tailBottom.position.set(-4.55, 0.12, -0.62)
  tailBottom.rotation.set(-0.2, 0, -0.85)

  group.add(body, snout, dorsalFin, tailCore, tailTop, tailBottom)
  return group
}

function fishSchoolModel() {
  const group = new THREE.Group()
  group.name = 'FishSchool'

  for (let i = 0; i < 9; i++) {
    const fish = new THREE.Group()
    fish.name = `Fish_${i}`

    const row = i % 3
    const depth = Math.floor(i / 3)
    fish.position.set((row - 1) * 1.8, (depth % 2) * 0.45, (depth - 1) * 2.3)

    const body = namedMesh(
      `FishBody_${i}`,
      new THREE.SphereGeometry(0.95, 8, 8),
      standard(0x7ec7d4, 0.8),
    )
    body.scale.set(0.7, 0.34, 0.3)

    const tail = namedMesh(
      `FishTail_${i}`,
      new THREE.ConeGeometry(0.35, 0.82, 4),
      standard(0x66aab8, 0.82),
    )
    tail.position.x = -0.95
    tail.rotation.z = Math.PI * 0.5

    fish.add(body, tail)
    group.add(fish)
  }

  return group
}

async function exportModel(name, object) {
  const arrayBuffer = await exporter.parseAsync(object, { binary: true, trs: false, onlyVisible: true })
  await writeFile(join(outDir.pathname, `${name}.glb`), Buffer.from(arrayBuffer))
}

await mkdir(outDir, { recursive: true })

await exportModel('floating-bottle', bottleModel())
await exportModel('floating-buoy', buoyModel())
await exportModel('floating-crate', crateModel())
await exportModel('horizon-island', islandModel())
await exportModel('horizon-cliff', cliffModel())
await exportModel('horizon-sea-stack', seaStackModel())
await exportModel('creature-turtle', turtleModel())
await exportModel('creature-dolphin', dolphinModel())
await exportModel('creature-fish-school', fishSchoolModel())
