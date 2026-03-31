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
  const playerRef       = useRef<any>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

  // ── Initialize YouTube player ─────────────────────────────────────────────
  useEffect(() => {
    if (!videoId || typeof window === "undefined") return;

    const initPlayer = () => {
      playerRef.current = new window.YT.Player("youtube-player", {
        videoId,
        playerVars: {
          autoplay:    0,
          controls:    0,
          disablekb:   1,
          enablejsapi: 1,
          playsinline: 1,
          mute:        1, // starts muted — unmuted synchronously in the click handler
        },
        events: {
          onReady: () => setIsReady(true),
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

  // ── Volume fade effect ────────────────────────────────────────────────────
  //
  // playVideo(), unMute(), and setVolume(0) all live in the click handler so
  // they execute synchronously within the browser's gesture-activation token
  // (required by iOS Safari — the token expires before any async effect runs).
  //
  // This effect only manages the fade interval, which has no gesture requirement.
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    clearFade();

    if (isPlaying) {
      // Player is already playing, unmuted, and at volume 0 (set in click handler).
      // Just run the fade-in interval.
      let vol = 0;
      fadeIntervalRef.current = setInterval(() => {
        vol = Math.min(vol + 2, 100);
        playerRef.current?.setVolume(vol);
        if (vol >= 100) clearFade();
      }, 30);
    } else {
      // Fade out then pause.
      let vol = playerRef.current.getVolume() as number;
      fadeIntervalRef.current = setInterval(() => {
        vol = Math.max(vol - 4, 0);
        playerRef.current?.setVolume(vol);
        if (vol <= 0) {
          clearFade();
          playerRef.current?.pauseVideo();
          playerRef.current?.mute(); // re-mute so next playVideo() starts silent
        }
      }, 30);
    }

    return clearFade;
  }, [isPlaying, isReady, clearFade]);

  // ── Click handler ─────────────────────────────────────────────────────────
  //
  // iOS Safari requires playVideo(), unMute(), and setVolume() to all be called
  // synchronously inside the gesture handler. The audio context unlock token
  // expires after the event handler returns — any async path (useEffect,
  // setTimeout, Promise) is too late, causing the first tap to be silently
  // ignored and requiring a second tap to actually produce sound.
  const handleButtonClick = useCallback(() => {
    if (!isPlaying && playerRef.current && isReady) {
      playerRef.current.playVideo();  // must be synchronous — gesture required
      playerRef.current.unMute();     // must be synchronous — gesture required on iOS
      playerRef.current.setVolume(0); // start at 0 so the effect fades in cleanly
    }
    onToggle(); // flips isPlaying → triggers the fade-in interval in the effect
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
                height:                  isPlaying ? `${height}px` : "3px",
                opacity:                 isPlaying ? 1 : 0.6,
                transformOrigin:         "center",
                animationName:           isPlaying ? "waveform" : "none",
                animationDuration:       `${0.8 + i * 0.1}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDelay:          `${i * 0.15}s`,
              }}
            />
          ))}
        </span>
      </button>

      <div id="youtube-player" className="hidden" />
    </>
  );
}