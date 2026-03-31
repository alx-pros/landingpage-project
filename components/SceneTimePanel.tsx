"use client";

import { useEffect, useState, useRef, useCallback, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

const HOUR_LABELS: Record<number, string> = {
  0: "Midnight",
  5: "Sunrise",
  8: "Morning",
  12: "Noon",
  18: "Sunset",
  20: "Dusk",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTimeParts(value: number | null) {
  if (value === null) {
    const now = new Date();
    return { hours: now.getHours(), minutes: now.getMinutes() };
  }
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return { hours: clamp(hours, 0, 23), minutes: clamp(minutes, 0, 59) };
}

function PanelContent({
  value,
  onChange,
  onClose,
  showDragHandle = false,
}: {
  value: number | null;
  onChange: (hour: number | null) => void;
  onClose: () => void;
  showDragHandle?: boolean;
}) {
  const parts = getTimeParts(value);
  const [hoursInput, setHoursInput] = useState(parts.hours);
  const [minutesInput, setMinutesInput] = useState(parts.minutes);

  useEffect(() => {
    const p = getTimeParts(value);
    setHoursInput(p.hours);
    setMinutesInput(p.minutes);
  }, [value]);

  const idPrefix = useId();

  const handleManualChange = (h: number, m: number) => {
    const clH = clamp(h, 0, 23);
    const clM = clamp(m, 0, 59);
    setHoursInput(clH);
    setMinutesInput(clM);
    onChange(clH + clM / 60);
  };

  return (
    <div className="w-full flex flex-col rounded-t-[2rem] sm:rounded-[1.5rem] bg-black/50 border border-white/10 p-6 pb-10 sm:pb-6 text-white min-w-[320px]">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-1 gap-2">
          <h4 className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#0BC6B4]">
            Scene Time
          </h4>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-4 py-1.5 cursor-pointer rounded-full border border-white/10 hover:bg-[#07786d]/50 text-[0.65rem] font-bold uppercase tracking-widest transition-all focus-within:ring-3 focus-within:ring-[#0BC6B4] focus-within:border-[#0d8c6a] focus-within:outline-none ${
            value === null
              ? "bg-[#0BC6B4] hover:bg-[#0BC6B4]! text-black"
              : "bg-white/5 text-white/60"
          }`}
        >
          {value === null ? "Live Local Time" : "Manual Time"}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col items-center focus-within:ring-3 focus-within:ring-[#0BC6B4] focus-within:border-[#0d8c6a] focus-within:outline-none">
          <label
            htmlFor={`${idPrefix}-hours`}
            className="text-[0.55rem] uppercase tracking-widest text-white/55 mb-1"
          >
            Hours
          </label>
          <input
            type="number"
            id={`${idPrefix}-hours`}
            name="hours"
            aria-label="hours"
            value={hoursInput}
            onChange={(e) => handleManualChange(parseInt(e.target.value || "0"), minutesInput)}
            className="bg-transparent text-2xl font-mono text-center w-full outline-none text-[#0BC6B4]"
          />
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col items-center focus-within:ring-3 focus-within:ring-[#0BC6B4] focus-within:border-[#0d8c6a] focus-within:outline-none">
          <label
            htmlFor={`${idPrefix}-minutes`}
            className="text-[0.55rem] uppercase tracking-widest text-white/55 mb-1"
          >
            Minutes
          </label>
          <input
            type="number"
            id={`${idPrefix}-minutes`}
            name="minutes"
            aria-label="minutes"
            value={minutesInput}
            onChange={(e) => handleManualChange(hoursInput, parseInt(e.target.value || "0"))}
            className="bg-transparent text-2xl font-mono text-center w-full outline-none text-[#0BC6B4]"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Object.entries(HOUR_LABELS).map(([h, label]) => {
          const hour = parseInt(h);
          const active = value !== null && Math.floor(value) === hour;
          return (
            <button
              key={hour}
              type="button"
              onClick={() => handleManualChange(hour, 0)}
              className={`flex flex-col cursor-pointer items-center justify-center rounded-xl py-3 transition-all hover:bg-[#07786d]/50 border border-white/10 focus-within:ring-3 focus-within:ring-[#0BC6B4] focus-within:border-[#0d8c6a] focus-within:outline-none ${
                active ? "bg-[#0BC6B4] hover:bg-[#0BC6B4]!" : "bg-white/5"
              }`}
            >
              <span className={`font-mono text-sm ${active ? "text-black" : "text-white/55"}`}>
                {hour.toString().padStart(2, "0")}:00
              </span>
              <span
                className={`text-[12px] mt-1 uppercase leading-none font-black text-center ${active ? "text-black" : "text-[#0BC6B4]"}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SceneTimePanel({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (hour: number | null) => void;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!isOpen || !buttonRef.current || window.innerWidth < 640) return; // 640 is sm: breakpoint

    const rect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 384; // w-[24rem]
    const gap = 8;

    let left = rect.left;

    // Right-edge collision detection
    if (left + panelWidth > window.innerWidth - 16) {
      left = Math.max(16, rect.right - panelWidth);
    }

    setDropdownPos({
      top: rect.bottom + window.scrollY + gap,
      left: left + window.scrollX,
    });
  }, [isOpen]);

  // Update position on open and on window resize
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
    }
    return () => window.removeEventListener("resize", updatePosition);
  }, [isOpen, updatePosition]);

  // Compute position whenever the panel opens
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 384; // w-[24rem]
    const gap = 8; // px below the button

    let left = rect.left;
    // If it would overflow the right edge, align to the button's right edge instead
    if (left + panelWidth > window.innerWidth - 16) {
      left = rect.right - panelWidth;
    }

    setDropdownPos({ top: rect.bottom + gap, left });
  }, [isOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        portalRef.current &&
        !portalRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = (event: Event) => {
      if (window.innerWidth < 640) return;
      if (portalRef.current && portalRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [isOpen]);

  return (
    <div className="relative pointer-events-auto" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label="time panel"
        name="time panel"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[#0d8c6a] bg-[#0BC6B4] hover:bg-[#0BC6B4]/30 px-3 text-sm font-mono tracking-[0.18em] text-white shadow-xl focus-within:ring-3 focus-within:ring-[#0BC6B4] focus-within:border-[#0d8c6a] focus-within:outline-none"
      >
        <span className="font-bold">{label}</span>
        <span
          className={`relative top-[1px] text-[0.7rem] transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div className="fixed inset-0 z-[9999] pointer-events-none" ref={portalRef}>
                {/* Backdrop — mobile only */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsOpen(false)}
                  className="absolute inset-0 bg-black/40 shadow-lg backdrop-blur-[2px] pointer-events-auto sm:hidden"
                />

                {/* Desktop dropdown */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  style={{ top: dropdownPos.top, left: dropdownPos.left }}
                  className="hidden sm:block absolute w-[24rem] pointer-events-auto
             max-h-[80vh] overflow-y-auto rounded-[1.5rem]"
                >
                  <PanelContent
                    value={value}
                    onChange={onChange}
                    onClose={() => setIsOpen(false)}
                  />
                </motion.div>

                <motion.div
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={{ top: 0, bottom: 0.3 }}
                  onDragEnd={(_, info) => {
                    // Close if dragged > 80 px down OR flicked fast downward
                    if (info.offset.y > 80 || info.velocity.y > 400) {
                      setIsOpen(false);
                    }
                  }}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="fixed inset-x-0 bottom-0 sm:hidden pointer-events-auto
                             max-h-[85dvh] overflow-y-auto"
                  style={{ touchAction: "none" }}
                >
                  <PanelContent
                    value={value}
                    onChange={onChange}
                    onClose={() => setIsOpen(false)}
                    showDragHandle
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
