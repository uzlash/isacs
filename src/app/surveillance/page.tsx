"use client";

import { useStore } from "@/lib/store";
import { rel } from "@/lib/format";

export default function SurveillancePage() {
  useStore((s) => s.tick);
  const cameras = useStore((s) => s.cameras);
  const escalate = useStore((s) => s.escalateCam);

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".7px", color: "var(--faint)" }}>
          AUTO-SNAPSHOT EVERY 5 MIN · STORED ON-PREM (MinIO)
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {cameras.map((c) => {
          const tone = c.active ? "var(--ok)" : "var(--faint)";
          return (
            <div key={c.id} className="panel" style={{ overflow: "hidden" }}>
              {/* feed area */}
              <div
                style={{
                  position: "relative",
                  aspectRatio: "16 / 10",
                  background:
                    "repeating-linear-gradient(45deg,#0a0e14,#0a0e14 8px,#0d121a 8px,#0d121a 16px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent,rgba(0,0,0,.4))" }} />
                <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", zIndex: 1 }}>
                  {c.active ? "◉ RTSP FEED" : "NO SIGNAL"}
                </span>
                <div style={{ position: "absolute", top: 7, left: 8, display: "flex", alignItems: "center", gap: 5, zIndex: 1 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone, boxShadow: `0 0 6px ${tone}` }} />
                  <span className="mono" style={{ font: "600 8px var(--font-mono-stack)", letterSpacing: ".5px", color: tone }}>
                    {c.active ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
                <div className="mono" style={{ position: "absolute", top: 7, right: 8, font: "500 8px var(--font-mono-stack)", color: "var(--faint)", zIndex: 1 }}>
                  L{c.level}
                </div>
              </div>

              {/* meta */}
              <div style={{ padding: "11px 13px" }}>
                <div style={{ font: "600 11.5px var(--font-sans-stack)", color: "var(--fg)" }}>{c.name}</div>
                <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", marginTop: 2 }}>{c.loc}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--muted)" }}>snap {rel(c.snap)} ago</span>
                  <button
                    onClick={() => escalate(c.id)}
                    className="mono"
                    style={{
                      font: "600 9px var(--font-mono-stack)",
                      letterSpacing: ".4px",
                      color: "var(--danger)",
                      background: "transparent",
                      border: "1px solid var(--danger)",
                      borderRadius: 6,
                      padding: "4px 9px",
                      cursor: "pointer",
                    }}
                  >
                    ⚑ ESCALATE
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
