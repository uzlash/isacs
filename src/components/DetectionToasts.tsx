"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Video, X } from "lucide-react";
import { useStore } from "@/lib/store";

// Live BBIW detection alerts. The store's SSE handler pushes a DetectionToast
// when a surveillance AI report arrives; this renders them stacked bottom-right,
// each auto-dismissing after ~12s, with a "view clip" / "view report" action.
export default function DetectionToasts() {
  const toasts = useStore((s) => s.detectionToasts);
  const dismiss = useStore((s) => s.dismissToast);
  const router = useRouter();

  // auto-expire the oldest toasts
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 12000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  if (!toasts.length) return null;

  const sevTone = (s: string) =>
    /crit/i.test(s) ? "var(--danger)" : /high/i.test(s) ? "#e3a008" : /med/i.test(s) ? "var(--warn)" : "var(--muted)";

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 200, display: "flex", flexDirection: "column", gap: 10, width: 340, maxWidth: "calc(100vw - 36px)" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-in"
          style={{
            background: "var(--panel)",
            border: "1px solid #a371f7",
            borderLeft: "3px solid #a371f7",
            borderRadius: 11,
            boxShadow: "0 14px 40px rgba(0,0,0,.5)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Sparkles size={13} strokeWidth={2} color="#a371f7" />
              <span className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "#a371f7" }}>BBIW DETECTION</span>
              {t.severity && (
                <span className="mono" style={{ font: "600 8px var(--font-mono-stack)", textTransform: "uppercase", color: sevTone(t.severity), border: `1px solid ${sevTone(t.severity)}`, borderRadius: 4, padding: "1px 5px" }}>{t.severity}</span>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer", display: "flex" }} aria-label="Dismiss">
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)", marginTop: 7, textTransform: "capitalize" }}>
              {t.rule.replace(/_/g, " ")}
            </div>
            <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)", marginTop: 2 }}>
              {t.camera}
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
              {t.clipUrl && (
                <a
                  href={t.clipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono"
                  style={{ display: "flex", alignItems: "center", gap: 5, textDecoration: "none", font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".3px", color: "#a371f7", border: "1px solid #a371f7", borderRadius: 7, padding: "6px 10px" }}
                >
                  <Video size={12} strokeWidth={2} /> VIEW CLIP
                </a>
              )}
              <button
                onClick={() => { dismiss(t.id); router.push("/incidents"); }}
                className="mono"
                style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".3px", color: "var(--muted)", background: "transparent", border: "1px solid var(--border2)", borderRadius: 7, padding: "6px 10px", cursor: "pointer" }}
              >
                VIEW REPORTS
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
