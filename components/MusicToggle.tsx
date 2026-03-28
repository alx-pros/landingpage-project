"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const playerRef = useRef<any>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const videoId = useMemo(() => {
    const url = musicConfig.youtubeUrl;
    const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/user\/\S+|\/ytscreeningroom\?v=))([\w-]{11})/);
    return match ? match[1] : null;
  }, []);

  const barHeights = [12, 14, 18, 16, 12, 14];

  // Helper to clear any ongoing fade to prevent volume "fighting"
  const clearFade = () => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!videoId || typeof window === "undefined") return;

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player("youtube-player", {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          playsinline: 1,
          mute: 1,
        },
        events: {
          onReady: () => {
            setIsReady(true);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }
  }, [videoId]);

  // 3. Control Logic with Fade
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    clearFade();

    if (isPlaying) {
      playerRef.current.unMute();
      playerRef.current.playVideo();
      
      let vol = playerRef.current.getVolume();
      fadeIntervalRef.current = setInterval(() => {
        vol += 2; // Adjust step size for smoothness
        playerRef.current.setVolume(vol);
        if (vol >= 100) clearFade();
      }, 30); // ~33fps for smooth fading
      
    } else {
      let vol = playerRef.current.getVolume();
      fadeIntervalRef.current = setInterval(() => {
        vol -= 4; // Fade out slightly faster than fade in
        playerRef.current.setVolume(vol);
        
        if (vol <= 0) {
          clearFade();
          playerRef.current.pauseVideo();
        }
      }, 30);
    }

    return () => clearFade();
  }, [isPlaying, isReady]);

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="relative z-50 cursor-pointer flex h-9 w-9 items-center justify-center rounded-full border border-[#0d8c6a] bg-[#0BC6B4] hover:bg-[#0BC6B4]/30 text-white shadow-lg backdrop-blur-md transition-all focus:outline-none"
      >
        <span className="flex h-[32px] items-center gap-[3px]">
          {barHeights.map((height, i) => (
            <span
              key={i}
              className="block w-[1px] rounded-full bg-white transition-all duration-500"
              style={{
                height: isPlaying ? `${height}px` : "3px",
                opacity: isPlaying ? 1 : 0.6,
                transformOrigin: "center",
                animationName: isPlaying ? "waveform" : "none",
                animationDuration: `${0.8 + i * 0.1}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </span>
      </button>

      <div id="youtube-player" className="hidden" />
    </>
  );
}