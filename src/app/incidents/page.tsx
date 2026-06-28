"use client";

import { useStore } from "@/lib/store";
import { rel, sourceMeta, statusTone } from "@/lib/format";
import { SevPill } from "@/components/ui";

const COLS = "78px 90px 1fr 120px 96px 60px";
const STATUS_FILTERS = ["all", "open", "investigating", "resolved"];
const SOURCE_FILTERS = ["all", "access", "surveillance", "assets", "manual"];

export default function IncidentsPage() {
  useStore((s) => s.tick);
  const incidents = useStore((s) => s.incidents);
  const selectedId = useStore((s) => s.selectedIncident);
  const incFilter = useStore((s) => s.incFilter);
  const incSource = useStore((s) => s.incSource);
  const resolveText = useStore((s) => s.resolveText);
  const select = useStore((s) => s.selectIncident);
  const setIncFilter = useStore((s) => s.setIncFilter);
  const setIncSource = useStore((s) => s.setIncSource);
  const setResolveText = useStore((s) => s.setResolveText);
  const assign = useStore((s) => s.assignIncident);
  const resolve = useStore((s) => s.resolveIncident);

  const rows = incidents.filter(
    (i) => (incFilter === "all" || i.status === incFilter) && (incSource === "all" || i.source === incSource)
  );
  const detail = incidents.find((i) => i.id === selectedId) || null;

  return (
    <div
      style={{
        maxWidth: 1500,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: detail ? "1.55fr 1fr" : "1fr",
        gap: 16,
        alignItems: "start",
      }}
    >
      {/* LIST COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* filter bar */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          <span className="label" style={{ marginRight: 2 }}>STATUS</span>
          {STATUS_FILTERS.map((s) => {
            const active = s === incFilter;
            return (
              <button
                key={s}
                onClick={() => setIncFilter(s)}
                className="mono"
                style={{
                  font: "600 10px var(--font-mono-stack)",
                  letterSpacing: ".5px",
                  textTransform: "uppercase",
                  padding: "6px 12px",
                  borderRadius: 7,
                  cursor: "pointer",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#04120f" : "var(--muted)",
                }}
              >
                {s}
              </button>
            );
          })}
          <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
          <span className="label" style={{ marginRight: 2 }}>SOURCE</span>
          {SOURCE_FILTERS.map((s) => {
            const active = s === incSource;
            return (
              <button
                key={s}
                onClick={() => setIncSource(s)}
                className="mono"
                style={{
                  font: "600 10px var(--font-mono-stack)",
                  letterSpacing: ".5px",
                  textTransform: "uppercase",
                  padding: "6px 12px",
                  borderRadius: 7,
                  cursor: "pointer",
                  border: `1px solid ${active ? "var(--info)" : "var(--border)"}`,
                  background: "transparent",
                  color: active ? "var(--info)" : "var(--muted)",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* table */}
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 14px" }}>
            <span>ID</span><span>Severity</span><span>Description</span><span>Investigator</span><span>Status</span><span>Age</span>
          </div>
          {rows.map((i) => (
            <div
              key={i.id}
              onClick={() => select(i.id)}
              className="row-hover"
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                gap: 10,
                alignItems: "center",
                padding: "11px 14px",
                borderBottom: "1px solid var(--border)",
                background: i.id === selectedId ? "var(--panel2)" : "transparent",
              }}
            >
              <span className="mono" style={{ font: "600 11px var(--font-mono-stack)", color: "var(--accent)" }}>{i.id}</span>
              <span><SevPill sev={i.sev} /></span>
              <span style={{ font: "500 12.5px var(--font-sans-stack)", color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.desc}</span>
              <span style={{ font: "500 11px var(--font-sans-stack)", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.investigator || "Unassigned"}</span>
              <span className="mono" style={{ font: "600 9.5px var(--font-mono-stack)", textTransform: "uppercase", letterSpacing: ".5px", color: statusTone(i.status) }}>{i.status}</span>
              <span className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>{rel(i.created)}</span>
            </div>
          ))}
          {rows.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>
              No incidents match the current filters.
            </div>
          )}
        </div>
      </div>

      {/* DETAIL COLUMN */}
      {detail ? (
        <div className="panel" style={{ position: "sticky", top: 0 }}>
          <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
              <span className="mono" style={{ font: "600 14px var(--font-mono-stack)", color: "var(--accent)" }}>{detail.id}</span>
              <SevPill sev={detail.sev} />
              <div style={{ flex: 1 }} />
              <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", textTransform: "uppercase", letterSpacing: ".6px", color: statusTone(detail.status) }}>● {detail.status}</span>
            </div>
            <div style={{ font: "500 14px var(--font-sans-stack)", color: "var(--fg)", lineHeight: 1.5 }}>{detail.desc}</div>
            <div style={{ display: "flex", gap: 18, marginTop: 13 }}>
              <Meta label="SOURCE" value={sourceMeta[detail.source] || detail.source} />
              <Meta label="LOCATION" value={detail.node} />
              <Meta label="INVESTIGATOR" value={detail.investigator || "Unassigned"} />
            </div>
          </div>

          {detail.images > 0 && (
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <div className="label" style={{ marginBottom: 9, letterSpacing: ".7px" }}>ATTACHMENTS · {detail.images} / 10</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Array.from({ length: detail.images }).map((_, k) => (
                  <div
                    key={k}
                    style={{
                      width: 72,
                      height: 54,
                      borderRadius: 6,
                      border: "1px solid var(--border2)",
                      background:
                        "repeating-linear-gradient(45deg,var(--panel2),var(--panel2) 5px,var(--panel3) 5px,var(--panel3) 10px)",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: 4,
                    }}
                  >
                    <span className="mono" style={{ font: "500 8px var(--font-mono-stack)", color: "var(--faint)" }}>snapshot</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
            <div className="label" style={{ marginBottom: 11, letterSpacing: ".7px" }}>LIFECYCLE · OPEN → INVESTIGATING → RESOLVED</div>
            {detail.log.map((l, k) => (
              <div key={k} style={{ display: "flex", gap: 11, paddingBottom: 11 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent)", flex: "0 0 9px", marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: "500 12px var(--font-sans-stack)", color: "var(--fg)" }}>{l.s}</div>
                  <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", marginTop: 2 }}>
                    {new Date(l.t).toLocaleTimeString()} · {rel(l.t)} ago
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {detail.status === "resolved" ? (
              <div style={{ background: "var(--panel2)", border: "1px solid var(--ok)", borderRadius: 8, padding: 12 }}>
                <div className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: ".7px", color: "var(--ok)", marginBottom: 6 }}>RESOLVED · PERMANENT RECORD</div>
                <div style={{ font: "500 12px var(--font-sans-stack)", color: "var(--fg)", lineHeight: 1.5 }}>{detail.resolution}</div>
                <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", marginTop: 8 }}>
                  This record cannot be reopened or re-resolved.
                </div>
              </div>
            ) : (
              <>
                {detail.status === "open" && (
                  <div style={{ display: "flex", gap: 9, marginBottom: 11 }}>
                    <button
                      onClick={() => assign(detail.id)}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 8,
                        border: "1px solid var(--info)",
                        background: "transparent",
                        color: "var(--info)",
                        font: "600 11px var(--font-mono-stack)",
                        letterSpacing: ".5px",
                        cursor: "pointer",
                      }}
                    >
                      ASSIGN TO ME
                    </button>
                  </div>
                )}
                <textarea
                  className="textarea"
                  value={resolveText}
                  onChange={(e) => setResolveText(e.target.value)}
                  placeholder="Document resolution findings…"
                  style={{ minHeight: 70, marginBottom: 9 }}
                />
                <button
                  onClick={() => resolve(detail.id)}
                  style={{
                    width: "100%",
                    height: 40,
                    borderRadius: 8,
                    border: "none",
                    background: "var(--ok)",
                    color: "#04120a",
                    font: "600 11.5px var(--font-mono-stack)",
                    letterSpacing: ".6px",
                    cursor: "pointer",
                  }}
                >
                  MARK RESOLVED
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)" }}>{label}</div>
      <div style={{ font: "500 11.5px var(--font-sans-stack)", color: "var(--muted)", marginTop: 3 }}>{value}</div>
    </div>
  );
}
