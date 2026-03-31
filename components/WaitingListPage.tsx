"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import MusicToggle from "./MusicToggle";
import Link from "next/link";
import SceneTimePanel from "./SceneTimePanel";
import { Logo } from "@/public/Logo";
import { AnimatePresence, motion } from "framer-motion";
import SceneLoadingOverlay from "./SceneLoadingOverlay";

const OceanCanvas = dynamic(() => import("@/components/OceanCavas"), {
  ssr: false,
  loading: () => null,
});

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

interface PixelPoint {
  x: number;
  y: number;
  r: number;
  color: string;
}

function getDisplayDate(timeOverrideHour: number | null, baseDate: Date) {
  if (timeOverrideHour === null) {
    return baseDate;
  }

  const nextDate = new Date(baseDate);
  const wholeHours = Math.floor(timeOverrideHour);
  const minutes = Math.round((timeOverrideHour - wholeHours) * 60);
  nextDate.setHours(wholeHours, minutes, 0, 0);
  return nextDate;
}

function formatTimeLabel(date: Date) {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function WaitlistForm({
  placeholder,
  className,
  onSubmit,
  id,
}: {
  placeholder: string;
  className?: string;
  onSubmit?: (email: string) => void;
  id?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const newDataRef = useRef<PixelPoint[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [animating, setAnimating] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const draw = useCallback(() => {
    if (!inputRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 800;
    ctx.clearRect(0, 0, 800, 800);

    const computedStyles = getComputedStyle(inputRef.current);
    const fontSize = parseFloat(computedStyles.fontSize);
    ctx.font = `${fontSize * 2}px ${computedStyles.fontFamily}`;

    ctx.fillStyle = computedStyles.color;
    ctx.fillText(value, 16, 40);

    const imageData = ctx.getImageData(0, 0, 800, 800);
    const pixelData = imageData.data;
    const newData: Array<{ x: number; y: number; color: [number, number, number, number] }> = [];

    for (let t = 0; t < 800; t++) {
      const i = 4 * t * 800;
      for (let n = 0; n < 800; n++) {
        const e = i + 4 * n;
        if (pixelData[e + 3] > 0) {
          newData.push({
            x: n,
            y: t,
            color: [pixelData[e], pixelData[e + 1], pixelData[e + 2], pixelData[e + 3]],
          });
        }
      }
    }

    newDataRef.current = newData.map(({ x, y, color }) => ({
      x,
      y,
      r: 1,
      color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`,
    }));
  }, [value]);

  useEffect(() => {
    draw();
  }, [value, draw]);

  const animate = (start: number) => {
    const animateFrame = (pos: number = 0) => {
      requestAnimationFrame(() => {
        const newArr = [];
        for (let i = 0; i < newDataRef.current.length; i++) {
          const current = newDataRef.current[i];
          if (current.x < pos) {
            newArr.push(current);
          } else {
            if (current.r <= 0) {
              current.r = 0;
              continue;
            }
            current.x += Math.random() > 0.5 ? 1 : -1;
            current.y += Math.random() > 0.5 ? 1 : -1;
            current.r -= 0.05 * Math.random();
            newArr.push(current);
          }
        }
        newDataRef.current = newArr;
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(pos, 0, 800, 800);
          newDataRef.current.forEach((t) => {
            const { x: n, y: i, r: s, color } = t;
            if (n > pos) {
              ctx.beginPath();
              ctx.rect(n, i, s, s);
              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              ctx.stroke();
            }
          });
        }
        if (newDataRef.current.length > 0) {
          animateFrame(pos - 8);
        } else {
          setValue("");
          setAnimating(false);
        }
      });
    };
    animateFrame(start);
  };

  const vanishAndSubmit = () => {
    setAnimating(true);
    draw();
    const maxX = newDataRef.current.reduce(
      (prev, current) => (current.x > prev ? current.x : prev),
      0
    );
    if (maxX === 0) {
      setValue("");
      setAnimating(false);
      return;
    }
    animate(maxX);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!inputRef.current?.checkValidity()) return;
    e.preventDefault();
    if (animating || submitted) return;
    vanishAndSubmit();
    setSubmitted(true);
    onSubmit?.(value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative w-full h-12 rounded-xl overflow-hidden bg-transparent flex items-center focus-within:ring-3 focus-within:ring-[#0BC6B4] border border-[#0d8c6a] focus-within:border-[#0d8c6a] focus-within:outline-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className={`absolute pointer-events-none scale-50 top-[17%] left-2 origin-top-left ${animating ? "opacity-100" : "opacity-0"}`}
      />

      <input
        ref={inputRef}
        value={value}
        type="email"
        name="email"
        id={id}
        autoComplete="email"
        required
        pattern={EMAIL_REGEX.source}
        onChange={(e) => !animating && setValue(e.target.value)}
        className={`w-full h-full bg-transparent pl-4 pr-38 sm:pr-44 text-sm sm:text-base text-white outline-none truncate ${animating && "text-transparent!"}`}
      />

      <div className="absolute left-4 inset-y-0 flex items-center pointer-events-none">
        {!value && <p className="text-sm sm:text-base text-white/50 truncate">{placeholder}</p>}
      </div>
      <button
        type="submit"
        className={`absolute right-0 uppercase text-black tracking-widest bg-[#0BC6B4] hover:bg-[#0BC6B4]/30 rounded-tr-xl border-l border-[#0d8c6a] rounded-br-xl top-1/2 -translate-y-1/2 z-20 cursor-pointer flex items-center gap-2 px-3 sm:px-6 py-3.5 text-sm font-medium transition focus-within:ring-3 focus-within:ring-transparent focus-within:border-[#0d8c6a] focus-within:outline-none ${submitted ? "cursor-text" : ""}`}
      >
        {submitted ? "Thank you!" : <p>Reserve a spot</p>}
      </button>
    </form>
  );
}

export default function WaitlistPage() {
  const currentYear = new Date().getFullYear();
  const [timeOverrideHour, setTimeOverrideHour] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(new Date());
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, []);

  // FIX: memoize onToggle so MusicToggle receives a stable function reference.
  //
  // Without useCallback, every setClockNow tick (every second) re-renders
  // WaitlistPage and produces a new onToggle arrow function. MusicToggle then
  // re-renders, and — because onToggle is in handleButtonClick's useCallback
  // deps — handleButtonClick is also recreated on every tick.
  //
  // On mobile this constant churn means the button's onClick is being swapped
  // out repeatedly. When the user taps, the browser's gesture-activation token
  // is consumed by React's synthetic event dispatch; if React is mid-reconcile
  // (replacing the onClick reference), iOS Safari can silently drop the
  // resulting playVideo() postMessage to the cross-origin iframe.
  //
  // A stable onToggle → stable handleButtonClick → the tap always lands on
  // the same committed handler → playVideo() fires reliably on first touch.
  const handleMusicToggle = useCallback(() => {
    setIsMusicPlaying((playing) => !playing);
  }, []);

  const displayedSceneTime = formatTimeLabel(getDisplayDate(timeOverrideHour, clockNow));

  return (
    <>
      <SceneLoadingOverlay visible={!sceneReady} progress={sceneProgress} />
      <OceanCanvas
        timeOverrideHour={timeOverrideHour}
        onProgressChange={setSceneProgress}
        onReadyChange={setSceneReady}
      />
      <div className="fixed inset-0 z-10 pointer-events-none ocean-veil" />

      <div className="relative z-20 flex flex-col w-full min-h-screen pointer-events-none">
        {/* NAV */}
        <nav className="relative flex mx-auto justify-between items-center px-5 sm:px-10 py-4 sm:py-8 animate-fade-down w-full min-w-[320px] max-w-[1024px] pointer-events-auto">
          <span className="font-display text-[0.92rem] font-bold tracking-[0.28em] uppercase text-[#0BC6B4] text-ocean">
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <Logo />
              <p className="hidden sm:block text-lg">DeepWave</p>
            </div>
          </span>
          <div className="flex items-center gap-3">
            <SceneTimePanel
              value={timeOverrideHour}
              onChange={setTimeOverrideHour}
              label={displayedSceneTime}
            />
            <MusicToggle
              isPlaying={isMusicPlaying}
              onToggle={handleMusicToggle}
            />
          </div>
        </nav>

        {/* MAIN */}
        <main className="relative flex-1 flex mx-auto flex-col items-center justify-center px-6 py-2 sm:py-10 text-center pointer-events-none w-full min-w-[320px] max-w-[1024px]">
          <AnimatePresence>
            {!isMusicPlaying && (
              <motion.div
                key="hero-copy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16, filter: "blur(12px)" }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="flex flex-col items-center"
              >
                <div className="inline-flex items-center gap-2.5 mb-3 sm:mb-6 animate-fade-up [animation-delay:350ms] pointer-events-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0BC6B4] glow-dot animate-pulse-dot" />
                  <span className="font-body text-[0.67rem] tracking-[0.32em] uppercase text-[#0BC6B4] text-ocean">
                    Early access open
                  </span>
                </div>
                <h1 className="font-display text-[clamp(2.5rem,6.5vw,4.2rem)] font-normal leading-[1.07] tracking-tight mb-2 sm:mb-5 max-w-2xl text-ocean animate-fade-up [animation-delay:500ms]">
                  The future of <br />
                  <em className="text-[#0BC6B4] italic">Deep Focus</em>
                  <br />
                  is setting sail.
                </h1>
                <label
                  htmlFor="email"
                  className="font-body text-[1.12rem] font-light leading-relaxed text-white/55 max-w-sm mb-5 sm:mb-9 text-ocean animate-fade-up [animation-delay:650ms]"
                >
                  A focused workspace for makers, writers, and builders who crave clarity. Built on
                  calm. <span className="whitespace-nowrap">Launching soon.</span>
                </label>
                <div className="w-full max-w-md pointer-events-auto animate-rise-in [animation-delay:800ms]">
                  <WaitlistForm placeholder="your@email.com" className="w-full" id="email" />
                  <p className="mt-2 sm:mt-4 text-[0.68rem] tracking-[0.1em] uppercase text-white/20 text-ocean">
                    No spam — just one note when we open{" "}
                    <span className="whitespace-nowrap">the hatch</span>.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* FOOTER */}
        <footer className="relative flex mx-auto flex-col sm:flex-row justify-between items-center px-5 sm:px-10 py-4 sm:py-8 animate-fade-down w-full min-w-[320px] max-w-[1024px] pointer-events-auto">
          <div className="flex flex-col sm:flex-row w-full items-center sm:justify-between gap-2">
            <p className="text-left text-sm leading-normal text-white">
              © {currentYear} DeepWave. All rights reserved.
            </p>
            <p className="text-left text-sm leading-normal text-white">
              Designed and Developed by&nbsp;
              <Link
                href="https://alxpro.com"
                target="_blank"
                className="font-black text-[#0BC6B4] hover:underline focus-within:rounded focus-within:ring-3 focus-within:ring-[#0BC6B4] focus-within:border-[#0d8c6a] focus-within:outline-none"
              >
                AlxPro
              </Link>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}