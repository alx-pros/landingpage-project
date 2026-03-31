// MusicToggle.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { musicConfig } from "./musicConfig";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function MusicToggle({
  isPlaying,
  onToggle,
}: {
  isPlaying: boolean;
  onToggle: () => void;
}) {
  const playerRef        = useRef<any>(null);
  const fadeIntervalRef  = useRef<NodeJS.Timeout | null>(null);
  const pendingPlayRef   = useRef(false); // queued play before player is ready
  const [isReady, setIsReady] = useState(false);

  const videoId = useMemo(() => {
    const url   = musicConfig.youtubeUrl;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w-]{11})/
    );
    return match ? match[1] : null;
  }, []);

  const barHeights = [12, 14, 18, 16, 12, 14];

  const clearFade = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }, []);

  // ── Initialize player once on mount ───────────────────────────────────────
  useEffect(() => {
    if (!videoId || typeof window === "undefined") return;

    const initPlayer = () => {
      playerRef.current = new window.YT.Player("youtube-player", {
        videoId,
        playerVars: {
          autoplay:   0,
          controls:   0,
          disablekb:  1,
          enablejsapi: 1,
          playsinline: 1,
          mute:       1,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            // NOTE: we do NOT call playVideo() here — no user gesture context.
            // If the user already clicked, they'll need one more click, but
            // in practice the player is ready well before the user first clicks.
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src   = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }
  }, [videoId]);

  // ── Fade-only effect (no playVideo / pauseVideo calls here) ───────────────
  //
  // playVideo() MUST be called synchronously inside a user-gesture handler on
  // mobile. useEffect fires after the render, outside the gesture context, so
  // the browser silently blocks it. This effect handles only the volume fade;
  // the actual play/pause calls live in handleButtonClick below.
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    clearFade();

    if (isPlaying) {
      // Fade in from 0
      playerRef.current.setVolume(0);
      let vol = 0;
      fadeIntervalRef.current = setInterval(() => {
        vol = Math.min(vol + 2, 100);
        playerRef.current?.setVolume(vol);
        if (vol >= 100) clearFade();
      }, 30);
    } else {
      // Fade out then pause
      let vol = playerRef.current.getVolume() as number;
      fadeIntervalRef.current = setInterval(() => {
        vol = Math.max(vol - 4, 0);
        playerRef.current?.setVolume(vol);
        if (vol <= 0) {
          clearFade();
          playerRef.current?.pauseVideo();
        }
      }, 30);
    }

    return clearFade;
  }, [isPlaying, isReady, clearFade]);

  // ── Button handler — play MUST be triggered here for mobile gesture ────────
  const handleButtonClick = useCallback(() => {
    const nextPlaying = !isPlaying;

    if (nextPlaying) {
      if (playerRef.current && isReady) {
        // Synchronous call inside gesture handler — mobile browsers allow this
        playerRef.current.unMute();
        playerRef.current.setVolume(0);
        playerRef.current.playVideo();
      } else {
        // Player not ready yet; flag so we can remind the user or retry
        pendingPlayRef.current = true;
      }
    }
    // pause is handled by the fade effect via the isPlaying state change

    onToggle();
  }, [isPlaying, isReady, onToggle]);

  return (
    <>
      <button
        type="button"
        onClick={handleButtonClick}
        className="relative z-50 cursor-pointer flex h-9 w-9 items-center justify-center rounded-full border border-[#0d8c6a] bg-[#0BC6B4] hover:bg-[#0BC6B4]/30 text-white shadow-lg backdrop-blur-md transition-all focus:outline-none"
      >
        <span className="flex h-[32px] items-center gap-[3px]">
          {barHeights.map((height, i) => (
            <span
              key={i}
              className="block w-[1px] rounded-full bg-white transition-all duration-500"
              style={{
                height:                 isPlaying ? `${height}px` : "3px",
                opacity:                isPlaying ? 1 : 0.6,
                transformOrigin:        "center",
                animationName:          isPlaying ? "waveform" : "none",
                animationDuration:      `${0.8 + i * 0.1}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDelay:         `${i * 0.15}s`,
              }}
            />
          ))}
        </span>
      </button>

      <div id="youtube-player" className="hidden" />
    </>
  );
}