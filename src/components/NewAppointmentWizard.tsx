"use client";

import { Fragment, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { createAppointment } from "@/lib/api/mutations";
import { createVisitor, type CreateVisitorInput } from "@/lib/api/visitors";
import { getHolderNodes, type AccessNodeRef } from "@/lib/api/access";

const STEPS = ["Host", "Visitor", "Access", "Appointment"];

function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewAppointmentWizard({ onClose }: { onClose: () => void }) {
  const staff = useStore((s) => s.staff);
  const visitors = useStore((s) => s.visitors);
  const settings = useStore((s) => s.settings);

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ---- step 0: host ----
  const [hostQuery, setHostQuery] = useState("");
  const [hostId, setHostId] = useState("");
  const host = staff.find((s) => s.id === hostId);
  const hostResults = staff.filter((s) => {
    const q = hostQuery.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.staffId.toLowerCase().includes(q);
  });

  // ---- step 1: visitor ----
  const [visitorMode, setVisitorMode] = useState<"pick" | "new">("pick");
  const [visitorQuery, setVisitorQuery] = useState("");
  const [visitorId, setVisitorId] = useState("");
  const [conflict, setConflict] = useState<{ id: string; name: string } | null>(null);
  const [vName, setVName] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vDesig, setVDesig] = useState("");
  const [vOrg, setVOrg] = useState("");
  const visitor = visitors.find((v) => v.id === visitorId);
  const visitorResults = visitors.filter((v) => {
    const q = visitorQuery.toLowerCase();
    return !q || v.name.toLowerCase().includes(q) || v.org.toLowerCase().includes(q);
  });

  // ---- step 2: access (picked now; the card isn't minted/assigned until check-in) ----
  const [nodesLoading, setNodesLoading] = useState(false);
  const [nodesFetchedFor, setNodesFetchedFor] = useState("");
  const [noBadge, setNoBadge] = useState(false);
  const [explicitNodes, setExplicitNodes] = useState<AccessNodeRef[]>([]);
  const [impliedNodes, setImpliedNodes] = useState<AccessNodeRef[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  useEffect(() => {
    if (step !== 2 || !hostId || nodesFetchedFor === hostId) return;
    setNodesLoading(true);
    setNoBadge(false);
    setError("");
    getHolderNodes("staff", hostId)
      .then((r) => {
        setExplicitNodes(r.explicit);
        setImpliedNodes(r.implied);
        setNodesFetchedFor(hostId);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNoBadge(true);
        else setError(e instanceof Error ? e.message : "Failed to load the host's access nodes");
      })
      .finally(() => setNodesLoading(false));
  }, [step, hostId, nodesFetchedFor]);

  // ---- step 3: appointment details ----
  const [start, setStart] = useState(() => toLocalInput(Date.now() + 15 * 60000));
  const [end, setEnd] = useState(() => toLocalInput(Date.now() + 45 * 60000));
  const [purpose, setPurpose] = useState("");

  const next = async () => {
    setError("");

    if (step === 0) {
      if (!hostId) return setError("Pick the staff member this visitor is here to see.");
      setStep(1);
      return;
    }

    if (step === 1) {
      if (visitorMode === "new") {
        if (!vName.trim()) return setError("The visitor's name is required.");
        setBusy(true);
        try {
          const body: CreateVisitorInput = {
            name: vName.trim(),
            email: vEmail.trim() || undefined,
            phone: vPhone.trim() || undefined,
            designation: vDesig.trim() || undefined,
            placeOfWork: vOrg.trim() || undefined,
          };
          const created = await createVisitor(body);
          await useStore.getState().refreshVisitors();
          setVisitorId(created.id);
          setVisitorMode("pick");
          setStep(2);
        } catch (e) {
          if (e instanceof ApiError && e.status === 409 && e.data && typeof e.data === "object" && "existing" in e.data) {
            const existing = (e.data as { existing: { id: string; name: string } }).existing;
            setConflict(existing);
          } else {
            setError(e instanceof Error ? e.message : "Failed to create visitor");
          }
        } finally {
          setBusy(false);
        }
        return;
      }
      if (!visitorId) return setError("Pick the visitor, or switch to “+ New visitor”.");
      setStep(2);
      return;
    }

    if (step === 2) {
      if (noBadge) return; // blocked — see banner
      if (!selectedNodeIds.length) return setError("Select at least one node to request for the visitor.");
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!start || !end) return setError("Set both a start and an end time.");
      const startMs = new Date(start).getTime();
      const endMs = new Date(end).getTime();
      if (endMs <= startMs) return setError("End time must be after the start time.");
      const minutes = (endMs - startMs) / 60000;
      if (minutes > settings.maxApptDuration) {
        return setError(`Duration exceeds the facility limit (${settings.maxApptDuration} min).`);
      }
      const maxAdvanceMs = Date.now() + settings.advanceBooking * 24 * 3600000;
      if (startMs > maxAdvanceMs) {
        return setError(`Can't book more than ${settings.advanceBooking} days in advance.`);
      }
      setBusy(true);
      try {
        await createAppointment({
          hostStaffId: hostId,
          visitorId,
          scheduledAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
          purpose: purpose.trim() || undefined,
          requestedAccessNodeIds: selectedNodeIds,
        });
        setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to book the appointment");
      } finally {
        setBusy(false);
      }
    }
  };

  const back = () => {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  };

  const finish = async () => {
    await Promise.all([
      useStore.getState().refreshAppointments(),
      useStore.getState().refreshVisitors(),
    ]).catch(() => {});
    onClose();
  };

  return (
    <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        {/* header + step rail */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>Book Visitor Appointment</span>
          {!done && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              {STEPS.map((label, i) => {
                const s = i < step ? "done" : i === step ? "active" : "idle";
                return (
                  <Fragment key={label}>
                    <span className="mono" style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", font: "600 9px var(--font-mono-stack)", ...(s === "active" ? { background: "var(--accent)", color: "#04120f" } : s === "done" ? { background: "rgba(63,185,80,0.15)", color: "var(--ok)", border: "1px solid var(--ok)" } : { background: "var(--bg)", color: "var(--faint)", border: "1px solid var(--border2)" }) }}>
                      {s === "done" ? "✓" : i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span style={{ width: 14, height: 1.5, borderRadius: 2, background: s === "done" ? "var(--ok)" : "var(--border2)" }} />}
                  </Fragment>
                );
              })}
            </div>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid var(--ok)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", background: "rgba(63,185,80,0.08)" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              </div>
              <div style={{ font: "600 15px var(--font-sans-stack)", color: "var(--fg)" }}>{visitor?.name} is booked in</div>
              <div style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)", marginTop: 4 }}>
                Hosted by {host?.name} · {new Date(start).toLocaleString()}
              </div>
              <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)", lineHeight: 1.7, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 13px", marginTop: 14, textAlign: "left" }}>
                REQUESTED NODES: {explicitNodes.filter((n) => selectedNodeIds.includes(n.id)).map((n) => n.name).join(", ") || "—"}<br />
                No card is issued yet — it&rsquo;s minted and assigned when this visitor checks in.
              </div>
              <button onClick={finish} className="btn-accent" style={{ width: "100%", height: 42, marginTop: 18, font: "600 11px var(--font-mono-stack)", letterSpacing: ".5px" }}>CLOSE</button>
            </div>
          ) : (
            <>
              {step === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field-label">HOST — WHO IS THE VISITOR HERE TO SEE?</div>
                  <input className="input" value={hostQuery} onChange={(e) => setHostQuery(e.target.value)} placeholder="Search staff by name or ID…" autoFocus />
                  <PickList
                    items={hostResults.map((s) => ({ id: s.id, primary: s.name, secondary: `${s.staffId} · ${s.desig}` }))}
                    selected={hostId}
                    onPick={setHostId}
                  />
                </div>
              )}

              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div className="field-label">VISITOR</div>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => { setVisitorMode(visitorMode === "pick" ? "new" : "pick"); setError(""); setConflict(null); }} className="mono" style={{ font: "600 10px var(--font-mono-stack)", color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
                      {visitorMode === "pick" ? "+ NEW VISITOR" : "← PICK EXISTING"}
                    </button>
                  </div>

                  {visitorMode === "pick" ? (
                    <>
                      <input className="input" value={visitorQuery} onChange={(e) => setVisitorQuery(e.target.value)} placeholder="Search visitors by name or org…" autoFocus />
                      <PickList
                        items={visitorResults.map((v) => ({ id: v.id, primary: v.name, secondary: v.org }))}
                        selected={visitorId}
                        onPick={setVisitorId}
                      />
                    </>
                  ) : (
                    <>
                      <input className="input" value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Full name" autoFocus />
                      <input className="input" value={vEmail} onChange={(e) => setVEmail(e.target.value)} placeholder="Email (optional)" />
                      <input className="input mono" value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="Phone (optional)" />
                      <input className="input" value={vDesig} onChange={(e) => setVDesig(e.target.value)} placeholder="Designation (optional)" />
                      <input className="input" value={vOrg} onChange={(e) => setVOrg(e.target.value)} placeholder="Organisation / place of work (optional)" />
                      {conflict && (
                        <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--warn)", background: "var(--panel2)", border: "1px solid var(--warn)", borderRadius: 7, padding: "9px 11px", display: "flex", alignItems: "center", gap: 8 }}>
                          A visitor with this email already exists: {conflict.name}
                          <button
                            onClick={() => { setVisitorId(conflict.id); setVisitorMode("pick"); setConflict(null); setStep(2); }}
                            className="mono"
                            style={{ marginLeft: "auto", font: "600 9.5px var(--font-mono-stack)", color: "var(--accent)", background: "none", border: "1px solid var(--accent)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                          >
                            USE THEM
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>
                    Choose which of {host?.name}&rsquo;s own access nodes this visitor should be able to use. This is a request only — the actual card isn&rsquo;t issued until the visitor checks in. Nodes shown greyed come along automatically as parents of a granted node.
                  </div>
                  {nodesLoading ? (
                    <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>Loading {host?.name}&rsquo;s access…</div>
                  ) : noBadge ? (
                    <div role="alert" style={{ font: "500 12px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 8, padding: "11px 13px", lineHeight: 1.5 }}>
                      ⚠ {host?.name} has no access badge configured — assign them a card via Access Control before booking visitor access for this host.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {explicitNodes.map((n) => {
                          const on = selectedNodeIds.includes(n.id);
                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => setSelectedNodeIds((p) => (on ? p.filter((x) => x !== n.id) : [...p, n.id]))}
                              className="mono"
                              style={{ font: "600 9.5px var(--font-mono-stack)", padding: "6px 10px", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, border: `1px solid ${on ? "var(--accent)" : "var(--border2)"}`, background: on ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", color: on ? "var(--accent)" : "var(--muted)" }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? "var(--accent)" : "var(--border2)" }} />
                              {n.name}
                            </button>
                          );
                        })}
                        {explicitNodes.length === 0 && (
                          <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>This host has no directly-granted nodes.</div>
                        )}
                      </div>
                      {impliedNodes.length > 0 && (
                        <div>
                          <div className="field-label" style={{ marginBottom: 6 }}>IMPLIED (COME FOR FREE)</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                            {impliedNodes.map((n) => (
                              <span key={n.id} className="mono" style={{ font: "600 9.5px var(--font-mono-stack)", padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border2)", color: "var(--faint)", opacity: 0.7 }}>
                                {n.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {step === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>
                    Max duration {settings.maxApptDuration} min · booking window {settings.advanceBooking} days
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                    <Field label="START">
                      <input className="input mono" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={{ font: "500 12px var(--font-mono-stack)" }} />
                    </Field>
                    <Field label="END">
                      <input className="input mono" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} style={{ font: "500 12px var(--font-mono-stack)" }} />
                    </Field>
                  </div>
                  <Field label="PURPOSE (OPTIONAL)">
                    <input className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Vendor meeting" />
                  </Field>
                </div>
              )}

              {error && (
                <div role="alert" style={{ marginTop: 12, font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {error}</div>
              )}
            </>
          )}
        </div>

        {!done && (
          <div style={{ padding: "13px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={step === 0 ? onClose : back} className="btn" style={{ height: 40, padding: "0 16px", font: "600 11px var(--font-mono-stack)", letterSpacing: ".5px" }}>
              {step === 0 ? "CANCEL" : "BACK"}
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={next} disabled={busy || (step === 2 && noBadge)} className="btn-accent" style={{ height: 40, padding: "0 22px", font: "600 11px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy || (step === 2 && noBadge) ? 0.6 : 1 }}>
              {busy ? "WORKING…" : step === STEPS.length - 1 ? "BOOK APPOINTMENT" : "NEXT →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PickList({ items, selected, onPick }: { items: { id: string; primary: string; secondary: string }[]; selected: string; onPick: (id: string) => void }) {
  if (!items.length) {
    return <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>No matches.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 220, overflowY: "auto" }}>
      {items.map((it) => {
        const on = it.id === selected;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onPick(it.id)}
            style={{ textAlign: "left", padding: "8px 11px", borderRadius: 8, cursor: "pointer", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--bg)" }}
          >
            <div style={{ font: "600 12px var(--font-sans-stack)", color: on ? "var(--accent)" : "var(--fg)" }}>{it.primary}</div>
            <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{it.secondary}</div>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
