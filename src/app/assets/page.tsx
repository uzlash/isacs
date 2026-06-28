"use client";

import { Truck } from "lucide-react";
import { useStore } from "@/lib/store";
import { PanelHeader } from "@/components/ui";
import FacilityMap from "@/components/FacilityMap";

export default function AssetsPage() {
  const assets = useStore((s) => s.assets);
  const toggleProto = useStore((s) => s.toggleProto);
  const reportBreach = useStore((s) => s.reportBreach);

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
      {/* TRACKED ASSETS */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">TRACKED ASSETS</span>
        </div>
        {assets.map((a) => {
          const active = a.protoActive;
          return (
            <div key={a.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--panel2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Truck size={17} strokeWidth={1.6} color="var(--warn)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>{a.name}</div>
                  <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", marginTop: 1 }}>
                    {a.type} · {a.plate || "no plate"} · tracker {a.tracker || "— no tracker —"}
                  </div>
                </div>
                <span
                  className="pill mono"
                  style={
                    active
                      ? { color: "var(--ok)", border: "1px solid var(--ok)" }
                      : { color: "var(--faint)", border: "1px solid var(--border2)" }
                  }
                >
                  {active ? "PROTOCOL ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)" }}>
                  Speed limit <span style={{ color: "var(--fg)" }}>{a.speed ? a.speed + " km/h" : "—"}</span>
                </div>
                <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)" }}>
                  Boundary <span style={{ color: "var(--fg)" }}>{a.geo ? "Geofenced" : "—"}</span>
                </div>
                <div style={{ flex: 1 }} />
                {a.tracker && (
                  <button
                    onClick={() => toggleProto(a.id)}
                    className="btn"
                    style={{ font: "600 9.5px var(--font-mono-stack)", padding: "5px 11px", borderRadius: 6 }}
                  >
                    {active ? "Deactivate" : "Activate"}
                  </button>
                )}
                {active && (
                  <button
                    onClick={() => reportBreach(a.id)}
                    className="mono"
                    style={{ font: "600 9.5px var(--font-mono-stack)", padding: "5px 11px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)" }}
                  >
                    ⚑ REPORT BREACH
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* LIVE POSITIONS */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <PanelHeader title="LIVE POSITIONS" />
        <div style={{ padding: 14 }}>
          <FacilityMap />
          <div style={{ font: "500 10px var(--font-sans-stack)", color: "var(--muted)", lineHeight: 1.55, marginTop: 12 }}>
            Protocol interlocks: a protocol requires an assigned GPS tracker; an asset with an active protocol cannot be deleted; a breach raises an ASRS incident automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
