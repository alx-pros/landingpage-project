"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Preload, useProgress } from "@react-three/drei";
import * as THREE from "three";
import OceanScene from "./scene/OceanScene";
import { AnimatePresence, motion } from "framer-motion";
import { setSceneTimeOverride } from "./scene/sceneParams";

function SceneLoadingOverlay({
  active,
  progress,
}: {
  active: boolean;
  progress: number;
}) {
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!active && progress === 100) {
      const timeout = setTimeout(() => setIsFinished(true), 800);
      return () => clearTimeout(timeout);
    }

    setIsFinished(false);
  }, [active, progress]);

  return (
    <AnimatePresence>
      {!isFinished && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.05,
            filter: "blur(20px)",
            transition: { duration: 0.8, ease: "easeInOut" },
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden"
        >
          {/* THE AMBIENT "OCEAN" DEPTH */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#0BC6B4]/10"
            animate={{
              background: [
                "radial-gradient(circle at 50% 120%, rgba(11, 198, 180, 0.1) 0%, #fff 70%)",
                "radial-gradient(circle at 50% 110%, rgba(11, 198, 180, 0.2) 0%, #fff 70%)",
                "radial-gradient(circle at 50% 120%, rgba(11, 198, 180, 0.1) 0%, #fff 70%)",
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <div className="overflow-hidden">
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="font-display text-[0.8rem] tracking-[0.7em] uppercase text-[#0BC6B4] font-semibold"
              >
                Loading Ocean
              </motion.p>
            </div>

            {/* THE WAVEFORM PROGRESS CONTAINER */}
            <div className="relative w-64 h-24 flex flex-col items-center justify-center">
              {/* The Main Progress Track */}
              <div className="relative w-full h-[3px] bg-[#0BC6B4]/10 rounded-full overflow-visible">
                {/* The "Liquid" Fill */}
                <motion.div
                  className="absolute inset-y-0 left-0 bg-[#0BC6B4] rounded-full shadow-[0_0_8px_rgba(11,198,180,0.4)]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  {/* The "Wake" - increased size and z-index to ensure visibility */}
                  <motion.div
                    animate={{
                      scale: [1, 1.8, 1],
                      opacity: [0.7, 1, 0.7],
                      boxShadow: ["0 0 10px #0BC6B4", "0 0 20px #0BC6B4", "0 0 10px #0BC6B4"],
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#0BC6B4] z-20"
                  />
                </motion.div>
              </div>
            </div>

            <motion.div className="font-mono text-[#0BC6B4] tracking-[0.2em]">
              {Math.round(progress)}%
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function OceanCanvas({
  timeOverrideHour = null,
}: {
  timeOverrideHour?: number | null;
}) {
  const { active, progress } = useProgress();
  const sceneReady = !active && progress === 100;

  useEffect(() => {
    setSceneTimeOverride(timeOverrideHour);
  }, [timeOverrideHour]);

  return (
    <>
      <Canvas
        dpr={[1, 1.5]}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: sceneReady ? 1 : 0,
          transition: "opacity 700ms ease",
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
        <OceanScene />
      </Canvas>
      <SceneLoadingOverlay active={active} progress={progress} />
    </>
  );
}
