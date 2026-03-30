"use client";

import { useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Preload, useProgress } from "@react-three/drei";
import * as THREE from "three";
import OceanScene from "./scene/OceanScene";
import { setSceneTimeOverride } from "./scene/sceneParams";

function SceneLoadReporter({
  onProgressChange,
  onReadyChange,
}: {
  onProgressChange?: (progress: number) => void;
  onReadyChange?: (ready: boolean) => void;
}) {
  const { active, progress, loaded, total } = useProgress();
  const [readyLatched, setReadyLatched] = useState(false);

  useEffect(() => {
    onProgressChange?.(progress);
  }, [onProgressChange, progress]);

  useEffect(() => {
    if (readyLatched) return;

    const hasLoadedAssets = total > 0 && loaded >= total;
    const hasReachedFullProgress = progress >= 99.9;
    const isReady = hasLoadedAssets && hasReachedFullProgress && !active;

    if (!isReady) {
      onReadyChange?.(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setReadyLatched(true);
      onReadyChange?.(true);
    }, 650);

    return () => clearTimeout(timeout);
  }, [active, loaded, onReadyChange, progress, readyLatched, total]);

  useEffect(() => {
    return () => onReadyChange?.(false);
  }, [onReadyChange]);

  return null;
}

export default function OceanCanvas({
  timeOverrideHour = null,
  onProgressChange,
  onReadyChange,
}: {
  timeOverrideHour?: number | null;
  onProgressChange?: (progress: number) => void;
  onReadyChange?: (ready: boolean) => void;
}) {
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    setSceneTimeOverride(timeOverrideHour);
  }, [timeOverrideHour]);

  const handleReadyChange = useCallback((ready: boolean) => {
    setSceneReady(ready);
    onReadyChange?.(ready);
  }, [onReadyChange]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "auto",
        opacity: sceneReady ? 1 : 0,
        transition: "opacity 850ms ease",
        zIndex: 0,
      }}
      camera={{
        fov: 55,
        near: 1,
        far: 20_000,
        position: [0, 22, 90],
      }}
      onCreated={({ camera }) => camera.lookAt(0, 8, 0)}
      gl={{
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.1,
        outputColorSpace: THREE.SRGBColorSpace,
        powerPreference: "high-performance",
        antialias: true,
      }}
    >
      <Preload all />
      <SceneLoadReporter onProgressChange={onProgressChange} onReadyChange={handleReadyChange} />
      <OceanScene />
    </Canvas>
  );
}
