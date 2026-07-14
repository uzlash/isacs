"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSessionUser } from "@/lib/auth";
import { isLive } from "@/lib/config";
import { createReport, type CreateReportInput } from "@/lib/api/mutations";
import { isBbiwReport, isClipUrl, parseBbiwDescription } from "@/lib/api/bbiw";
import { rel, roleMeta, sourceMeta, statusTone } from "@/lib/format";
import { SevPill } from "@/components/ui";
import type { Incident, User } from "@/lib/types";

const COLS = "78px 90px 1fr 120px 96px 60px";
const STATUS_FILTERS = ["all", "open", "investigating", "resolved"];
const SOURCE_FILTERS = ["all", "access", "surveillance", "assets", "manual", "lockdown"];

// Roles allowed to hand an incident to someone other than themselves —
// mirrors the "Resolve Incidents" bracket in format.ts's ROLE_MATRIX minus
// security_personnel, who can self-claim but shouldn't delegate to peers.
const REASSIGN_ROLES = ["super_admin", "security_manager"];
// Roles that make sense as an investigator to hand an incident to.
const INVESTIGATOR_ROLES = ["super_admin", "security_manager", "security_personnel"];

export default function IncidentsPage() {
  useStore((s) => s.tick);
  const incidents = useStore((s) => s.incidents);
  const users = useStore((s) => s.users);
  const selectedId = useStore((s) => s.selectedIncident);
  const incFilter = useStore((s) => s.incFilter);
  const incSource = useStore((s) => s.incSource);
  const resolveText = useStore((s) => s.resolveText);
  const select = useStore((s) => s.selectIncident);
  const setIncFilter = useStore((s) => s.setIncFilter);
  const setIncSource = useStore((s) => s.setIncSource);
  const setResolveText = useStore((s) => s.setResolveText);
  const assign = useStore((s) => s.assignIncident);
  const addAssignee = useStore((s) => s.addAssignee);
  const removeAssignee = useStore((s) => s.removeAssignee);
  const resolve = useStore((s) => s.resolveIncident);
  const refreshReports = useStore((s) => s.refreshReports);
  const sessionUser = useSessionUser();
  const canReassign = !!sessionUser && REASSIGN_ROLES.includes(sessionUser.role);

  const [showNew, setShowNew] = useState(false);

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
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowNew(true)}
            className="btn-accent"
            style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Plus size={12} strokeWidth={2.6} /> NEW REPORT
          </button>
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
            {isBbiwReport(detail.desc) ? <BbiwDetection detail={detail} /> : (
              <div style={{ font: "500 14px var(--font-sans-stack)", color: "var(--fg)", lineHeight: 1.5 }}>{detail.desc}</div>
            )}
            <div style={{ display: "flex", gap: 18, marginTop: 13 }}>
              <Meta label="SOURCE" value={sourceMeta[detail.source] || detail.source} />
              <Meta label="LOCATION" value={detail.node} />
              <Meta label="INVESTIGATOR" value={detail.investigator || "Unassigned"} />
              <Meta label="ROSTER" value={detail.assignments.length ? `+${detail.assignments.length}` : "—"} />
            </div>
          </div>

          {detail.imageUrls.length > 0 && (
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <div className="label" style={{ marginBottom: 9, letterSpacing: ".7px" }}>
                {detail.imageUrls.some(isClipUrl) ? "DETECTION CLIP" : `ATTACHMENTS · ${detail.imageUrls.length}`}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {detail.imageUrls.map((url, k) =>
                  isClipUrl(url) ? (
                    <video key={k} controls preload="metadata" style={{ width: "100%", maxHeight: 260, borderRadius: 8, border: "1px solid var(--border2)", background: "#000" }}>
                      <source src={url} type="video/mp4" />
                      Your browser does not support video playback.
                    </video>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={k} src={url} alt="attachment" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border2)" }} />
                  )
                )}
                {detail.imageUrls.some(isClipUrl) && (
                  <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>
                    Clip served by the BBIW node — must be reachable from your browser.
                  </span>
                )}
              </div>
            </div>
          )}
          {detail.imageUrls.length === 0 && detail.images > 0 && (
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

          {(detail.assignments.length > 0 || (canReassign && detail.status !== "resolved")) && (
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <div className="label" style={{ marginBottom: 9, letterSpacing: ".7px" }}>
                ROSTER · PERSONNEL ATTACHED BESIDES THE INVESTIGATOR
              </div>
              {detail.assignments.length === 0 ? (
                <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>
                  Nobody else is attached to this report yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: canReassign && detail.status !== "resolved" ? 10 : 0 }}>
                  {detail.assignments.map((a) => (
                    <span
                      key={a.id}
                      className="mono"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "600 10px var(--font-mono-stack)", color: "var(--fg)", background: "var(--panel2)", border: "1px solid var(--border2)", borderRadius: 7, padding: "5px 6px 5px 10px" }}
                    >
                      {a.name}
                      {canReassign && detail.status !== "resolved" && (
                        <button
                          onClick={() => removeAssignee(detail.id, a.userId)}
                          title="Remove from roster"
                          style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 2px" }}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {canReassign && detail.status !== "resolved" && (
                <RosterAddPicker
                  users={users}
                  exclude={[detail.investigatorId, ...detail.assignments.map((a) => a.userId)].filter((x): x is string => !!x)}
                  onAdd={(userId) => addAssignee(detail.id, userId)}
                />
              )}
            </div>
          )}

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
                  <div style={{ marginBottom: 11 }}>
                    <div style={{ display: "flex", gap: 9 }}>
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
                    {canReassign && (
                      <AssignToPicker
                        users={users}
                        excludeUserId={sessionUser?.id}
                        onAssign={(investigatorId) => assign(detail.id, investigatorId)}
                      />
                    )}
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

      {showNew && (
        <NewReportModal
          onClose={() => setShowNew(false)}
          onCreated={async () => {
            setShowNew(false);
            await refreshReports();
          }}
        />
      )}
    </div>
  );
}

const SOURCES: CreateReportInput["source"][] = ["manual", "access-control", "surveillance", "assets", "lockdown"];

function NewReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void | Promise<void> }) {
  const [source, setSource] = useState<CreateReportInput["source"]>("manual");
  const [description, setDescription] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!description.trim()) return setError("A description is required.");
    if (!isLive) {
      // mock mode has no /reports write — guide the operator
      setError("Manual reports post to the live API only (running in mock mode).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createReport({
        source,
        description: description.trim(),
        ...(sourceRef.trim() ? { sourceRef: sourceRef.trim() } : {}),
      });
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>New ASRS report</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <div className="field-label" style={{ marginBottom: 6 }}>SOURCE</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {SOURCES.map((s) => {
                const on = source === s;
                return (
                  <button key={s} onClick={() => setSource(s)} className="mono" style={{ font: "600 9.5px var(--font-mono-stack)", padding: "6px 11px", borderRadius: 7, cursor: "pointer", textTransform: "uppercase", letterSpacing: ".3px", border: `1px solid ${on ? "var(--accent)" : "var(--border2)"}`, background: on ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", color: on ? "var(--accent)" : "var(--muted)" }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: 5 }}>DESCRIPTION</div>
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened…" style={{ minHeight: 84 }} autoFocus />
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: 5 }}>SOURCE REF (OPTIONAL)</div>
            <input className="input mono" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="e.g. node id, camera id, related record" />
          </div>
          {error && <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {error}</div>}
          <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
            {busy ? "CREATING…" : "CREATE REPORT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Pick a different investigator than yourself — only rendered for roles
// allowed to delegate (see REASSIGN_ROLES). Options are limited to roles that
// realistically investigate incidents (see INVESTIGATOR_ROLES) and active accounts.
function AssignToPicker({
  users,
  excludeUserId,
  onAssign,
}: {
  users: User[];
  excludeUserId?: string;
  onAssign: (investigatorId: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const options = users.filter(
    (u) => u.active && u.id !== excludeUserId && INVESTIGATOR_ROLES.includes(u.role)
  );

  return (
    <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
      <select
        className="input"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{ flex: 1, height: 38 }}
      >
        <option value="">Assign to someone else…</option>
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {u.staff !== "—" ? u.staff : u.email} · {roleMeta[u.role].label}
          </option>
        ))}
      </select>
      <button
        onClick={() => selected && onAssign(selected)}
        disabled={!selected}
        style={{
          height: 38,
          padding: "0 14px",
          borderRadius: 8,
          border: "1px solid var(--border2)",
          background: "transparent",
          color: selected ? "var(--fg)" : "var(--faint)",
          font: "600 11px var(--font-mono-stack)",
          letterSpacing: ".5px",
          cursor: selected ? "pointer" : "default",
        }}
      >
        ASSIGN
      </button>
    </div>
  );
}

// Add a non-lead responder to a report's roster (§2) — visible only to
// REASSIGN_ROLES, same gate as picking a different lead investigator.
function RosterAddPicker({
  users,
  exclude,
  onAdd,
}: {
  users: User[];
  exclude: string[];
  onAdd: (userId: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const options = users.filter(
    (u) => u.active && !exclude.includes(u.id) && INVESTIGATOR_ROLES.includes(u.role)
  );

  return (
    <div style={{ display: "flex", gap: 9 }}>
      <select
        className="input"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{ flex: 1, height: 38 }}
      >
        <option value="">Add to roster…</option>
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {u.staff !== "—" ? u.staff : u.email} · {roleMeta[u.role].label}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (selected) {
            onAdd(selected);
            setSelected("");
          }
        }}
        disabled={!selected}
        style={{
          height: 38,
          padding: "0 14px",
          borderRadius: 8,
          border: "1px solid var(--border2)",
          background: "transparent",
          color: selected ? "var(--fg)" : "var(--faint)",
          font: "600 11px var(--font-mono-stack)",
          letterSpacing: ".5px",
          cursor: selected ? "pointer" : "default",
        }}
      >
        ADD
      </button>
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

// A BBIW detection report — parse the structured description into a headline +
// chips instead of showing the raw "BBIW: … | Camera: … | …" string.
function BbiwDetection({ detail }: { detail: Incident }) {
  const p = parseBbiwDescription(detail.desc);
  const hasClip = detail.imageUrls.some(isClipUrl);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "#a371f7", border: "1px solid #a371f7", borderRadius: 4, padding: "2px 7px" }}>BBIW AI</span>
        <span style={{ font: "600 15px var(--font-sans-stack)", color: "var(--fg)", textTransform: "capitalize" }}>{(p.rule || "detection").replace(/_/g, " ")}</span>
        {p.dangerous && (
          <span
            className="mono"
            style={{ font: "700 9px var(--font-mono-stack)", letterSpacing: ".6px", color: "#fff", background: "var(--danger)", borderRadius: 4, padding: "3px 8px" }}
          >
            ⚠ DANGEROUS
          </span>
        )}
        {hasClip && <span className="mono" style={{ font: "600 8px var(--font-mono-stack)", letterSpacing: ".4px", color: "var(--accent)" }}>▶ CLIP AVAILABLE</span>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
        {p.match && <Chip>Match · {p.match}</Chip>}
        {p.confidence && <Chip>Confidence · {p.confidence}</Chip>}
        {p.vehicleType && <Chip>Type · {p.vehicleType}</Chip>}
        {p.signals && <Chip>Signals · {p.signals}</Chip>}
        {p.camera && <Chip>Camera · {p.camera}</Chip>}
        {p.severity && <Chip>Severity · {p.severity}</Chip>}
        {p.node && <Chip>Node · {p.node}</Chip>}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)", background: "var(--panel2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "4px 9px" }}>
      {children}
    </span>
  );
}
