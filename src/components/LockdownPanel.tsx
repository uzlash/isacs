"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { rel } from "@/lib/format";
import { liftLockdown, type Lockdown } from "@/lib/api/lockdown";

// Lockdown STATUS banner + history + lift. Initiation is node-centric now —
// see NodeInspector ("Lock down this node").
interface Props {
  active: Lockdown | null;
  history: Lockdown[];
  refresh: () => Promise<void>;
  canWrite: boolean;
  nodeName: (id: string) => string;
}

export default function LockdownPanel({ active, history, refresh, canWrite, nodeName }: Props) {
  const [lifting, setLifting] = useState(false);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const scopeLabel = (l: Lockdown) => (l.nodeIds === null ? "ALL NODES" : `${l.nodeIds.length} NODE(S)`);

  const submitLift = async () => {
    if (!active) return;
    if (!resolution.trim()) return setError("A resolution is required to lift the lockdown.");
    setBusy(true);
    setError("");
    try {
      await liftLockdown(active.id, resolution.trim());
      await refresh();
      setLifting(false);
      setResolution("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to lift lockdown");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ overflow: "hidden", border: active ? "1px solid var(--danger)" : "1px solid var(--border)" }}>
      {active ? (
        <div style={{ padding: "14px 16px", background: "color-mix(in srgb, var(--danger) 10%, var(--panel))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--danger)", boxShadow: "0 0 8px var(--danger)", animation: "isacs-pulse 1.6s infinite", flex: "0 0 9px" }} />
            <span className="mono" style={{ font: "700 12px var(--font-mono-stack)", letterSpacing: "1px", color: "var(--danger)" }}>FACILITY LOCKDOWN ACTIVE</span>
            <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 4, padding: "1px 6px" }}>{scopeLabel(active)}</span>
            <div style={{ flex: 1 }} />
            {canWrite && (
              <button onClick={() => { setResolution(""); setError(""); setLifting(true); }} className="mono" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", borderRadius: 7, cursor: "pointer", border: "none", background: "var(--danger)", color: "#fff" }}>
                LIFT LOCKDOWN
              </button>
            )}
          </div>
          <div style={{ font: "500 13px var(--font-sans-stack)", color: "var(--fg)", marginTop: 10, lineHeight: 1.5 }}>{active.description}</div>
          <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
            <Meta label="STARTED">{rel(Date.parse(active.createdAt))} ago</Meta>
            <Meta label="BY">{active.creator?.email || "—"}</Meta>
            <Meta label="SCOPE">{active.nodeIds === null ? "Entire facility" : active.nodeIds.map(nodeName).join(", ")}</Meta>
          </div>
        </div>
      ) : (
        <div style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={16} strokeWidth={1.8} color="var(--muted)" />
          <span className="mono" style={{ font: "600 11px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--fg)" }}>NO ACTIVE LOCKDOWN</span>
          <span className="panel-sub">· all ACM devices operating normally · select a node to lock it down</span>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div className="mono" style={{ padding: "9px 16px", font: "600 9px var(--font-mono-stack)", letterSpacing: "1px", color: "var(--faint)" }}>LOCKDOWN HISTORY</div>
          {history.slice(0, 5).map((l) => (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 90px 1fr 90px", gap: 10, padding: "9px 16px", borderTop: "1px solid var(--border)", alignItems: "center" }}>
              <span style={{ font: "500 11.5px var(--font-sans-stack)", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description}</span>
              <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{scopeLabel(l)}</span>
              <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.creator?.email || "—"}</span>
              <span className="mono" style={{ font: "600 9.5px var(--font-mono-stack)", textTransform: "uppercase", letterSpacing: ".4px", color: l.status === "active" ? "var(--danger)" : "var(--ok)" }}>{l.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* LIFT MODAL */}
      {lifting && (
        <div onClick={() => !busy && setLifting(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
              <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>Lift lockdown</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setLifting(false)} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>
              <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>
                Lifting unlocks all affected ACM devices and auto-resolves the linked ASRS report.
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>RESOLUTION (AUDIT TRAIL)</div>
                <textarea className="textarea" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Visitor identified and escorted off premises" style={{ minHeight: 64 }} autoFocus />
              </div>
              {error && <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {error}</div>}
              <button onClick={submitLift} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
                {busy ? "LIFTING…" : "LIFT LOCKDOWN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)" }}>{label}</div>
      <div style={{ font: "500 11px var(--font-sans-stack)", color: "var(--muted)", marginTop: 3 }}>{children}</div>
    </div>
  );
}
