"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Water } from "three/examples/jsm/objects/Water.js";
import * as THREE from "three";
import { getSceneDate, sceneParams } from "./sceneParams";
import { getSceneSnapshot, vecFromSpherical, type SceneSnapshot } from "./timeUtils";

function updateWaterMaterial(
  material: THREE.ShaderMaterial,
  scene: SceneSnapshot,
  step: number,
  sunDir: THREE.Vector3,
  moonDir: THREE.Vector3,
) {
  const uniforms = material.uniforms;
  const lightDirection = sunDir.clone().lerp(moonDir, scene.nightFactor).normalize();
  const highlightColor = new THREE.Color(scene.sunColorHex).lerp(
    new THREE.Color(0xc7dbff),
    scene.nightFactor
  );
  const highlightIntensity = THREE.MathUtils.lerp(
    scene.sunReflectionIntensity,
    0.95,
    scene.nightFactor
  );

  uniforms["time"].value += step * scene.waterTimeScale;
  uniforms["distortionScale"].value = scene.waterDistortionScale;
  uniforms["size"].value = scene.waterSize;
  uniforms["alpha"].value = scene.waterAlpha;
  uniforms["waterColor"].value.setHex(scene.waterColorHex);
  uniforms["sunDirection"].value.copy(lightDirection);
  uniforms["sunColor"].value.copy(highlightColor).multiplyScalar(highlightIntensity);
}

export default function Ocean() {
  const waterNormals = useTexture("/textures/waternormals.jpg");
  const geometry = useMemo(() => new THREE.PlaneGeometry(10_000, 10_000), []);
  const normalTexture = useMemo(() => {
    const texture = waterNormals.clone();
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }, [waterNormals]);

  const water = useMemo(() => {
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location);
    return new Water(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normalTexture,
      sunDirection: vecFromSpherical(scene.sunElev, scene.sunAz),
      sunColor: scene.sunColorHex,
      waterColor: scene.waterColorHex,
      distortionScale: scene.waterDistortionScale,
      alpha: scene.waterAlpha,
      fog: false,
    });
  }, [geometry, normalTexture]);

  const _sunDir = useRef(new THREE.Vector3());
  const _moonDir = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const scene = getSceneSnapshot(getSceneDate(), sceneParams.location);
    const step = Math.min(delta, 1 / 30);

    vecFromSpherical(scene.sunElev, scene.sunAz, _sunDir.current);
    vecFromSpherical(scene.moonElev, scene.moonAz, _moonDir.current);
    updateWaterMaterial(
      water.material as THREE.ShaderMaterial,
      scene,
      step,
      _sunDir.current,
      _moonDir.current,
    );
  });

  return <primitive object={water} rotation={[-Math.PI / 2, 0, 0]} />;
}
