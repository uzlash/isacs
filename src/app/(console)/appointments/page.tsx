"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useSessionUser } from "@/lib/auth";
import { statusTone } from "@/lib/format";
import { cancelAppointment, postponeAppointment } from "@/lib/api/mutations";
import type { Appointment } from "@/lib/types";

const COLS = "1.4fr 1.4fr 1fr 1.6fr 110px 120px";
const WRITE_ROLES = ["super_admin", "security_personnel", "staff_admin"];

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function AppointmentsPage() {
  const appts = useStore((s) => s.appointments);
  const staff = useStore((s) => s.staff);
  const visitors = useStore((s) => s.visitors);
  const settings = useStore((s) => s.settings);
  const show = useStore((s) => s.showSchedule);
  const schedule = useStore((s) => s.schedule);
  const open = useStore((s) => s.openSchedule);
  const close = useStore((s) => s.closeSchedule);
  const setSched = useStore((s) => s.setSched);
  const submit = useStore((s) => s.submitSchedule);

  const user = useSessionUser();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);
  const [modal, setModal] = useState<
    | { kind: "cancel"; appt: Appointment }
    | { kind: "postpone"; appt: Appointment }
    | null
  >(null);

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>
          Max duration {settings.maxApptDuration} min · booking window {settings.advanceBooking} days · double-booking prevented
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={open}
          className="btn-accent"
          style={{ font: "600 10.5px var(--font-mono-stack)", letterSpacing: ".5px", padding: "9px 16px" }}
        >
          + SCHEDULE APPOINTMENT
        </button>
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 16px" }}>
          <span>Visitor</span><span>Host</span><span>When</span><span>Purpose</span><span>Status</span><span style={{ textAlign: "right" }}>Actions</span>
        </div>
        {appts.map((a) => (
          <div key={a.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <span style={{ font: "600 12px var(--font-sans-stack)", color: "var(--fg)" }}>{a.visitor}</span>
            <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{a.host}</span>
            <div>
              <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--fg)" }}>{fmtTime(a.start)} – {fmtTime(a.end)}</div>
              <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>{fmtDay(a.start)}</div>
            </div>
            <span style={{ font: "500 11.5px var(--font-sans-stack)", color: "var(--muted)" }}>{a.purpose}</span>
            <span>
              <span className="pill mono" style={{ textTransform: "uppercase", color: statusTone(a.status), border: `1px solid ${statusTone(a.status)}` }}>
                {a.status}
              </span>
            </span>
            <span style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {a.status === "scheduled" && canWrite ? (
                <>
                  <IconBtn onClick={() => setModal({ kind: "postpone", appt: a })} title="Postpone" tone="var(--warn)">
                    <span className="mono" style={{ font: "600 8.5px var(--font-mono-stack)" }}>POSTPONE</span>
                  </IconBtn>
                  <IconBtn onClick={() => setModal({ kind: "cancel", appt: a })} title="Cancel" tone="var(--danger)">
                    <span className="mono" style={{ font: "600 8.5px var(--font-mono-stack)" }}>CANCEL</span>
                  </IconBtn>
                </>
              ) : (
                <span className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>—</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* SCHEDULE MODAL */}
      {show && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 440, background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 20px 60px rgba(0,0,0,.5)", overflow: "hidden" }}
          >
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
              <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>Schedule Appointment</span>
              <div style={{ flex: 1 }} />
              <button onClick={close} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>VISITOR</div>
                <select className="select" value={schedule.visitor} onChange={(e) => setSched("visitor", e.target.value)}>
                  {visitors.map((v) => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>HOST (STAFF)</div>
                <select className="select" value={schedule.host} onChange={(e) => setSched("host", e.target.value)}>
                  {staff.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <div>
                  <div className="field-label" style={{ marginBottom: 5 }}>TIME</div>
                  <input className="input mono" style={{ font: "500 12px var(--font-mono-stack)" }} value={schedule.date} onChange={(e) => setSched("date", e.target.value)} placeholder="14:30" />
                </div>
                <div>
                  <div className="field-label" style={{ marginBottom: 5 }}>DURATION (MIN)</div>
                  <input className="input mono" style={{ font: "500 12px var(--font-mono-stack)" }} type="number" value={schedule.dur} onChange={(e) => setSched("dur", Number(e.target.value))} />
                </div>
              </div>
              {schedule.error && (
                <div style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>
                  ⚠ {schedule.error}
                </div>
              )}
              <button onClick={submit} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", marginTop: 2 }}>
                CONFIRM BOOKING
              </button>
              <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", textAlign: "center" }}>
                Host receives email notification automatically
              </div>
            </div>
          </div>
        </div>
      )}

      {modal?.kind === "cancel" && (
        <CancelModal
          appt={modal.appt}
          onClose={() => setModal(null)}
          onDone={async () => {
            await useStore.getState().refreshAppointments();
            setModal(null);
          }}
        />
      )}

      {modal?.kind === "postpone" && (
        <PostponeModal
          appt={modal.appt}
          onClose={() => setModal(null)}
          onDone={async () => {
            await useStore.getState().refreshAppointments();
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

// ---- cancel ----
function CancelModal({ appt, onClose, onDone }: { appt: Appointment; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason.trim()) return setError("A cancellation reason is required.");
    setBusy(true);
    setError("");
    try {
      await cancelAppointment(appt.id, reason.trim());
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel appointment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={`Cancel · ${appt.visitor} → ${appt.host}`} onClose={() => !busy && onClose()} accent="var(--danger)">
      <Field label="REASON">
        <textarea className="input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this appointment being cancelled?" autoFocus style={{ resize: "vertical", font: "500 12px var(--font-sans-stack)" }} />
      </Field>
      {error && <Err>{error}</Err>}
      <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "CANCELLING…" : "CANCEL APPOINTMENT"}
      </button>
    </Shell>
  );
}

// ---- postpone ----
function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PostponeModal({ appt, onClose, onDone }: { appt: Appointment; onClose: () => void; onDone: () => Promise<void> }) {
  const [start, setStart] = useState(toLocalInput(appt.start));
  const [end, setEnd] = useState(toLocalInput(appt.end));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const nowLocal = toLocalInput(Date.now());

  const submit = async () => {
    if (!start || !end || !reason.trim()) return setError("New start, new end and a reason are all required.");
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (startMs <= Date.now()) return setError("New start must be in the future.");
    if (endMs <= startMs) return setError("New end must be after the new start.");
    setBusy(true);
    setError("");
    try {
      await postponeAppointment(appt.id, new Date(start).toISOString(), new Date(end).toISOString(), reason.trim());
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to postpone appointment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={`Postpone · ${appt.visitor} → ${appt.host}`} onClose={() => !busy && onClose()} accent="var(--warn)">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
        <Field label="NEW START">
          <input className="input mono" type="datetime-local" min={nowLocal} value={start} onChange={(e) => setStart(e.target.value)} style={{ font: "500 12px var(--font-mono-stack)" }} />
        </Field>
        <Field label="NEW END">
          <input className="input mono" type="datetime-local" min={start || nowLocal} value={end} onChange={(e) => setEnd(e.target.value)} style={{ font: "500 12px var(--font-mono-stack)" }} />
        </Field>
      </div>
      <Field label="REASON">
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this appointment being moved?" style={{ resize: "vertical", font: "500 12px var(--font-sans-stack)" }} />
      </Field>
      {error && <Err>{error}</Err>}
      <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "POSTPONING…" : "POSTPONE APPOINTMENT"}
      </button>
    </Shell>
  );
}

// ---- shared bits (matched to acms page) ----
function Shell({ title, onClose, children, accent }: { title: string; onClose: () => void; children: React.ReactNode; accent?: string }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: "100%", background: "var(--panel)", border: `1px solid ${accent || "var(--border2)"}`, borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: accent || "var(--fg)" }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>{children}</div>
      </div>
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

function Err({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {children}</div>
  );
}

function IconBtn({ children, onClick, title, tone }: { children: React.ReactNode; onClick: () => void; title: string; tone?: string }) {
  return (
    <button onClick={onClick} title={title} className="mono" style={{ height: 28, minWidth: 28, padding: "0 7px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 6, cursor: "pointer", background: "transparent", border: `1px solid ${tone ? tone : "var(--border2)"}`, color: tone ? tone : "var(--muted)" }}>
      {children}
    </button>
  );
}
