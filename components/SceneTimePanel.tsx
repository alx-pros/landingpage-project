"use client";

import { useEffect, useState } from "react";

const HOUR_LABELS: Record<number, string> = {
  0: "Midnight",
  5: "Sunrise",
  8: "Morning",
  12: "Noon",
  18: "Sunset",
  20: "Dusk",
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

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

  return {
    hours: clamp(hours, 0, 23),
    minutes: clamp(minutes, 0, 59),
  };
}

function formatHour(value: number) {
  const { hours, minutes } = getTimeParts(value);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export default function SceneTimePanel({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (hour: number | null) => void;
}) {
  const [hoursInput, setHoursInput] = useState(() => getTimeParts(value).hours);
  const [minutesInput, setMinutesInput] = useState(() => getTimeParts(value).minutes);

  useEffect(() => {
    const syncInputs = () => {
      const parts = getTimeParts(value);
      setHoursInput(parts.hours);
      setMinutesInput(parts.minutes);
    };

    syncInputs();

    if (value !== null) {
      return;
    }

    const intervalId = window.setInterval(syncInputs, 30_000);
    return () => window.clearInterval(intervalId);
  }, [value]);

  const applyTimeChange = (nextHours: number, nextMinutes: number) => {
    const clampedHours = clamp(Math.floor(nextHours), 0, 23);
    const clampedMinutes = clamp(Math.floor(nextMinutes), 0, 59);
    setHoursInput(clampedHours);
    setMinutesInput(clampedMinutes);
    onChange(clampedHours + clampedMinutes / 60);
  };

  return (
    <aside className="fixed right-5 bottom-5 z-30 w-[min(22rem,calc(100vw-2.5rem))] rounded-[1.4rem] border border-white/15 bg-[#03131f]/70 p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl pointer-events-auto">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-[0.62rem] uppercase tracking-[0.28em] text-[#73e3d5]">
            Scene Time
          </p>
          <p className="mt-1 font-body text-sm text-white/70">
            Test every hour across the full day.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] transition ${
            value === null
              ? "border-[#73e3d5] bg-[#0BC6B4] text-black"
              : "border-white/15 bg-white/5 text-white/75 hover:border-white/30 hover:text-white"
          }`}
        >
          Auto
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-black/15 p-3">
        <div className="mb-2 flex items-center justify-between text-[0.68rem] uppercase tracking-[0.24em] text-white/55">
          <span>Selected</span>
          <span>{value === null ? formatHour(new Date().getHours() + new Date().getMinutes() / 60) : formatHour(value)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          value={value === null ? new Date().getHours() : Math.floor(value)}
          onChange={(event) => applyTimeChange(Number(event.target.value), minutesInput)}
          className="w-full accent-[#0BC6B4]"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
          <span className="mb-2 block text-[0.62rem] uppercase tracking-[0.22em] text-white/45">
            Hours
          </span>
          <input
            type="number"
            min={0}
            max={23}
            value={hoursInput}
            onChange={(event) => {
              const nextHours = Number(event.target.value || 0);
              setHoursInput(nextHours);
              applyTimeChange(nextHours, minutesInput);
            }}
            className="w-full bg-transparent font-mono text-lg text-white outline-none"
          />
        </label>
        <label className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2">
          <span className="mb-2 block text-[0.62rem] uppercase tracking-[0.22em] text-white/45">
            Minutes
          </span>
          <input
            type="number"
            min={0}
            max={59}
            value={minutesInput}
            onChange={(event) => {
              const nextMinutes = Number(event.target.value || 0);
              setMinutesInput(nextMinutes);
              applyTimeChange(hoursInput, nextMinutes);
            }}
            className="w-full bg-transparent font-mono text-lg text-white outline-none"
          />
        </label>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {HOURS.map((hour) => {
          const active = value !== null && Math.floor(value) === hour;
          const label = HOUR_LABELS[hour];

          return (
            <button
              key={hour}
              type="button"
              onClick={() => applyTimeChange(hour, 0)}
              className={`rounded-2xl border px-2 py-2 text-left transition ${
                active
                  ? "border-[#73e3d5] bg-[#0BC6B4] text-black shadow-[0_10px_30px_rgba(11,198,180,0.28)]"
                  : "border-white/10 bg-white/5 text-white/85 hover:border-white/25 hover:bg-white/10"
              }`}
            >
              <div className="font-mono text-xs tracking-[0.16em]">{formatHour(hour)}</div>
              <div className={`mt-1 text-[0.65rem] ${active ? "text-black/70" : "text-white/45"}`}>
                {label ?? " "}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
