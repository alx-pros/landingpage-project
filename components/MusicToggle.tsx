"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { musicConfig } from "./musicConfig";

function extractYouTubeVideoId(url: string) {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname.includes("youtu.be")) {
      return parsedUrl.pathname.slice(1) || null;
    }

    if (parsedUrl.hostname.includes("youtube.com")) {
      return parsedUrl.searchParams.get("v");
    }
  } catch {
    return null;
  }

  return null;
}

function postCommand(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({
      event: "command",
      func,
      args,
    }),
    "https://www.youtube.com"
  );
}

function fadeVolume(iframe: HTMLIFrameElement | null, from: number, to: number, duration = 800) {
  const steps = 20;
  const stepTime = duration / steps;
  let current = from;

  const delta = (to - from) / steps;

  const interval = setInterval(() => {
    current += delta;

    postCommand(iframe, "setVolume", [Math.max(0, Math.min(100, current))]);

    if ((delta > 0 && current >= to) || (delta < 0 && current <= to)) {
      clearInterval(interval);
    }
  }, stepTime);
}

export default function MusicToggle() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const videoId = useMemo(() => extractYouTubeVideoId(musicConfig.youtubeUrl), []);

  // Define unique heights for each bar to create a "mountain" shape
  const barHeights = [12, 14, 18, 16, 12, 14];

  useEffect(() => {
    if (!isReady) return;
    if (isPlaying) {
      postCommand(iframeRef.current, "playVideo");
      fadeVolume(iframeRef.current, 0, 100, 1000);
    } else {
      fadeVolume(iframeRef.current, 100, 0, 600);
      setTimeout(() => postCommand(iframeRef.current, "pauseVideo"), 600);
    }
  }, [isPlaying, isReady]);

  const disabled = !videoId;

  return (
    <>
      <button
        type="button"
        name="music button"
        aria-label="music button"
        disabled={disabled}
        onClick={() => !disabled && setIsPlaying(!isPlaying)}
        className="fixed cursor-pointer top-5 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[#0d8c6a] bg-[#0BC6B4] hover:bg-[#0BC6B4]/30 text-white shadow-lg backdrop-blur-md transition-all"
      >
        <span className="flex items-center gap-[3px] h-[32px]">
          {barHeights.map((height, i) => (
            <span
              key={i}
              className="block w-[2px] bg-white rounded-full transition-all duration-500 ease-in-out"
              style={{
                // 1. Initial State (The Dot)
                height: isPlaying ? `${height}px` : "3px",

                // 2. Separate Properties to avoid shorthand conflicts
                animationName: isPlaying ? "waveform" : "none",
                animationDuration: `${0.8 + i * 0.1}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDelay: `${i * 0.15}s`,

                // 3. Transform & Origin
                transformOrigin: "center",
                opacity: isPlaying ? 1 : 0.6,
              }}
            />
          ))}
        </span>
      </button>

      {videoId && (
        <iframe
          ref={iframeRef}
          className="hidden"
          src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&playsinline=1`}
          allow="autoplay"
          onLoad={() => setIsReady(true)}
        />
      )}
    </>
  );
}
