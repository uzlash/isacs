"use client";

import { useStore } from "@/lib/store";
import { statusTone } from "@/lib/format";

const COLS = "1.4fr 1.4fr 1fr 1.6fr 110px";

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
          <span>Visitor</span><span>Host</span><span>When</span><span>Purpose</span><span>Status</span>
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
    </div>
  );
}
