"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import type { Density, Theme } from "@/lib/types";

const THEMES: Theme[] = ["obsidian", "daylight", "steel"];
const DENSITIES: Density[] = ["compact", "balanced", "spacious"];

/**
 * Client-only bootstrap:
 *  - hydrates persisted prefs from localStorage into the store
 *  - seeds the in-memory data once mounted (avoids SSR/CSR time mismatch)
 *  - applies theme / density / accent to <html> and persists changes
 *  - drives the 1s clock tick and the ~3.8s live-feed pulse
 *
 * The matching inline script in the root layout sets data-theme/density
 * before first paint so there is no flash.
 */
export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const hydrate = useStore((s) => s.hydrate);
  const tickClock = useStore((s) => s.tickClock);
  const maybePushRandom = useStore((s) => s.maybePushRandom);
  const setTheme = useStore((s) => s.setTheme);
  const setDensity = useStore((s) => s.setDensity);
  const setAccent = useStore((s) => s.setAccent);
  const setLiveFeed = useStore((s) => s.setLiveFeed);

  // initial hydration (runs once)
  useEffect(() => {
    try {
      const t = localStorage.getItem("isacs-theme");
      if (t && (THEMES as string[]).includes(t)) setTheme(t as Theme);
      const d = localStorage.getItem("isacs-density");
      if (d && (DENSITIES as string[]).includes(d)) setDensity(d as Density);
      const a = localStorage.getItem("isacs-accent");
      if (a) setAccent(a);
      const lf = localStorage.getItem("isacs-livefeed");
      if (lf != null) setLiveFeed(lf === "1");
    } catch {
      /* localStorage unavailable */
    }
    hydrate(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // apply + persist prefs whenever they change
  const theme = useStore((s) => s.theme);
  const density = useStore((s) => s.density);
  const accent = useStore((s) => s.accent);
  const liveFeed = useStore((s) => s.liveFeed);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", theme);
    el.setAttribute("data-density", density);
    if (accent) el.style.setProperty("--accent", accent);
    else el.style.removeProperty("--accent");
    try {
      localStorage.setItem("isacs-theme", theme);
      localStorage.setItem("isacs-density", density);
      if (accent) localStorage.setItem("isacs-accent", accent);
      else localStorage.removeItem("isacs-accent");
      localStorage.setItem("isacs-livefeed", liveFeed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [theme, density, accent, liveFeed]);

  // clock + live feed timers
  useEffect(() => {
    const clock = setInterval(tickClock, 1000);
    const feed = setInterval(maybePushRandom, 3800);
    return () => {
      clearInterval(clock);
      clearInterval(feed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
