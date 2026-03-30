"use client";

import { AnimatePresence, motion } from "framer-motion";

export default function SceneLoadingOverlay({
  visible,
  progress,
}: {
  visible: boolean;
  progress: number;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.05,
            filter: "blur(20px)",
            transition: { duration: 0.8, ease: "easeInOut" },
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-white"
        >
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
                className="font-display text-[0.8rem] font-semibold uppercase tracking-[0.7em] text-[#0BC6B4]"
              >
                Loading Ocean
              </motion.p>
            </div>

            <div className="relative flex h-24 w-64 flex-col items-center justify-center">
              <div className="relative h-[3px] w-full overflow-visible rounded-full bg-[#0BC6B4]/10">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#0BC6B4] shadow-[0_0_8px_rgba(11,198,180,0.4)]"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.8, 1],
                      opacity: [0.7, 1, 0.7],
                      boxShadow: ["0 0 10px #0BC6B4", "0 0 20px #0BC6B4", "0 0 10px #0BC6B4"],
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute right-0 top-1/2 z-20 h-3 w-3 -translate-y-1/2 rounded-full bg-[#0BC6B4]"
                  />
                </motion.div>
              </div>
            </div>

            <motion.div className="font-mono tracking-[0.2em] text-[#0BC6B4]">
              {Math.round(progress)}%
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
