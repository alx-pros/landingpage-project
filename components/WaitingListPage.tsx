"use client";

import dynamic from "next/dynamic";
import { useState, useId, useEffect, useCallback, useRef } from "react";
import MusicToggle from "./MusicToggle";
import Link from "next/link";
import SceneTimePanel from "./SceneTimePanel";

const OceanCanvas = dynamic(() => import("@/components/OceanCavas"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-ink" />,
});

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = () => {
    intervalRef.current = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % placeholder.length);
    }, 3000);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible" && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (document.visibilityState === "visible") {
      startAnimation();
    }
  };

  useEffect(() => {
    startAnimation();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [placeholder]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const newDataRef = useRef<any[]>([]);
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

    // Draw with the actual text color instead of always white
    ctx.fillStyle = computedStyles.color;
    ctx.fillText(value, 16, 40);

    const imageData = ctx.getImageData(0, 0, 800, 800);
    const pixelData = imageData.data;
    const newData: any[] = [];

    for (let t = 0; t < 800; t++) {
      let i = 4 * t * 800;
      for (let n = 0; n < 800; n++) {
        let e = i + 4 * n;
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

      {/* Static placeholder */}
      <div className="absolute left-4 inset-y-0 flex items-center pointer-events-none">
        {!value && <p className="text-sm sm:text-base text-white/50 truncate">{placeholder}</p>}
      </div>
      <button
        type="submit"
        className={`absolute right-0 uppercase text-black tracking-widest bg-[#0BC6B4] hover:bg-[#0BC6B4]/30 rounded-tr-xl border-l border-[#0d8c6a] rounded-br-xl top-1/2 -translate-y-1/2 z-20 cursor-pointer flex items-center gap-2 px-3 sm:px-6 py-3.5 text-sm font-medium transition ${submitted ? "border-transparent! cursor-text" : ""}`}
      >
        {submitted ? "Thank you!" : <p>Reserve a spot</p>}
      </button>
    </form>
  );
}

export default function WaitlistPage() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [timeOverrideHour, setTimeOverrideHour] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(new Date());
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const displayedSceneTime = formatTimeLabel(getDisplayDate(timeOverrideHour, clockNow));

  return (
    <>
      <OceanCanvas timeOverrideHour={timeOverrideHour} />
      <div className="fixed inset-0 z-10 pointer-events-none ocean-veil" />

      <nav className="fixed min-w-[320px] top-0 inset-x-0 z-20 flex justify-between items-center px-10 py-8 animate-fade-down">
        <span className="font-display text-[0.92rem] font-bold tracking-[0.28em] uppercase text-[#0BC6B4] text-ocean">
          DeepWave
        </span>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-white/15 bg-[#03131f]/55 px-4 py-2 font-mono text-[0.75rem] tracking-[0.18em] text-[#ccecff] backdrop-blur-md">
            {displayedSceneTime}
          </div>
          <MusicToggle />
        </div>
      </nav>

      <main className="fixed min-w-[320px] inset-0 z-20 flex flex-col items-center justify-center px-6 text-center pointer-events-none">
        <div className="inline-flex items-center gap-2.5 mb-6 animate-fade-up [animation-delay:350ms] pointer-events-auto">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0BC6B4] glow-dot animate-pulse-dot" />
          <span className="font-body text-[0.67rem] tracking-[0.32em] uppercase text-[#0BC6B4] text-ocean">
            Early access open
          </span>
        </div>
        <h1 className="font-display text-[clamp(2.5rem,6.5vw,4.2rem)] font-normal leading-[1.07] tracking-tight mb-5 max-w-2xl text-ocean animate-fade-up [animation-delay:500ms]">
          The future of <br />
          <em className="text-[#0BC6B4] italic">Deep Focus</em>
          <br />
          is setting sail.
        </h1>
        <label htmlFor="email" className="font-body text-[1.12rem] font-light leading-relaxed text-white/55 max-w-sm mb-9 text-ocean animate-fade-up [animation-delay:650ms]">
          A focused workspace for makers, writers, and builders who crave clarity. Built on calm.{" "}
          <span className="whitespace-nowrap">Launching soon.</span>
        </label>
        <div className="w-full max-w-md pointer-events-auto animate-rise-in [animation-delay:800ms]">
          <WaitlistForm placeholder="your@email.com" className="w-full" id="email" />
          <p className="mt-4 text-[0.68rem] tracking-[0.1em] uppercase text-white/20 text-ocean">
            No spam — just one note when we open the hatch.
          </p>
        </div>
      </main>
      <footer className="fixed min-w-[320px] bottom-0 inset-x-0 z-20 justify-between items-center px-10 py-8 animate-fade-down">
        <div className="flex flex-col sm:flex-row w-full items-center sm:justify-between gap-2">
          <p className="text-left text-sm leading-normal text-white">
            © {currentYear} DeepWave. All rights reserved.
          </p>
          <p className="text-left text-sm leading-normal text-white">
            Designed and Developed by&nbsp;
            <Link
              href="https://alxpro.com"
              target="_blank"
              className="font-black text-[#0BC6B4] hover:underline"
            >
              AlxPro
            </Link>
          </p>
        </div>
      </footer>
      <SceneTimePanel value={timeOverrideHour} onChange={setTimeOverrideHour} />
    </>
  );
}
