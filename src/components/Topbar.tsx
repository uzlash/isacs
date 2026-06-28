"use client";

import { useRouter, usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { openIncidentCount, useStore } from "@/lib/store";
import { VIEW_TITLES } from "@/lib/format";
import { viewIdForPath } from "./nav";
import type { Theme } from "@/lib/types";

const THEME_SWATCH: Record<Theme, { bg: string; panel: string; sw: string }> = {
  obsidian: { bg: "#0a0e14", panel: "#0f141d", sw: "#34d3c0" },
  daylight: { bg: "#eceff4", panel: "#ffffff", sw: "#0d9488" },
  steel: { bg: "#13161a", panel: "#191d23", sw: "#c9a227" },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const view = viewIdForPath(pathname);
  const [title, subtitle] = VIEW_TITLES[view] || ["", ""];

  // subscribe to tick so the clock re-renders each second
  const tick = useStore((s) => s.tick);
  const ready = useStore((s) => s.ready);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const openCount = useStore((s) => openIncidentCount(s.incidents));

  const d = new Date();
  const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const dateStr = d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
  void tick; // referenced to force re-render on tick

  return (
    <header
      style={{
        height: 58,
        flex: "0 0 58px",
        borderBottom: "1px solid var(--border)",
        background: "var(--panel)",
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 20px",
      }}
    >
      <div style={{ minWidth: 230 }}>
        <div style={{ font: "600 14.5px var(--font-sans-stack)", color: "var(--fg)", letterSpacing: ".2px" }}>
          {title}
        </div>
        <div
          className="mono"
          style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", letterSpacing: ".3px" }}
        >
          {subtitle}
        </div>
      </div>

      {/* search */}
      <div
        style={{
          flex: 1,
          maxWidth: 380,
          display: "flex",
          alignItems: "center",
          gap: 9,
          height: 34,
          padding: "0 12px",
          background: "var(--panel2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <Search size={14} strokeWidth={2} color="var(--faint)" />
        <input
          placeholder="Search people, cards, incidents, nodes…"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--fg)",
            font: "500 12px var(--font-sans-stack)",
          }}
        />
        <span
          className="mono"
          style={{
            font: "500 9px var(--font-mono-stack)",
            color: "var(--faint)",
            border: "1px solid var(--border2)",
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          ⌘K
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* event bus live pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 11px",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--ok)",
            boxShadow: "0 0 8px var(--ok)",
            animation: "isacs-pulse 2.2s infinite",
          }}
        />
        <span
          className="mono"
          style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--muted)" }}
        >
          EVENT BUS LIVE
        </span>
      </div>

      {/* clock */}
      <div style={{ textAlign: "right", minWidth: 88 }} suppressHydrationWarning>
        <div
          className="mono"
          style={{ font: "600 15px var(--font-mono-stack)", color: "var(--fg)", letterSpacing: "1px", lineHeight: 1 }}
          suppressHydrationWarning
        >
          {ready ? clock : "--:--:--"}
        </div>
        <div
          className="mono"
          style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", letterSpacing: ".5px" }}
          suppressHydrationWarning
        >
          {ready ? dateStr : ""}
        </div>
      </div>

      {/* theme switcher */}
      <div
        style={{
          display: "flex",
          gap: 5,
          padding: 4,
          background: "var(--panel2)",
          borderRadius: 8,
          border: "1px solid var(--border)",
        }}
      >
        {(Object.keys(THEME_SWATCH) as Theme[]).map((t) => {
          const sw = THEME_SWATCH[t];
          const cur = theme === t;
          return (
            <button
              key={t}
              title={t}
              onClick={() => setTheme(t)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                cursor: "pointer",
                background: sw.bg,
                border: `1.5px solid ${cur ? sw.sw : "var(--border2)"}`,
                boxShadow: cur ? `inset 0 0 0 2px ${sw.panel}` : "none",
                padding: 0,
              }}
            />
          );
        })}
      </div>

      {/* alert bell */}
      <button
        onClick={() => router.push("/incidents")}
        className="btn"
        style={{
          position: "relative",
          width: 36,
          height: 36,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--panel2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bell size={17} strokeWidth={1.7} />
        {openCount > 0 && (
          <span
            className="mono"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: "var(--danger)",
              color: "#fff",
              font: "600 9.5px var(--font-mono-stack)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--panel)",
            }}
          >
            {openCount}
          </span>
        )}
      </button>
    </header>
  );
}
