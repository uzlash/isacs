"use client";

import { useStore } from "@/lib/store";

function NumRow({
  title,
  desc,
  value,
  unit,
  onChange,
}: {
  title: string;
  desc: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>{title}</div>
        <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", marginTop: 2 }}>{desc}</div>
      </div>
      <input
        className="input mono"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 84, height: 38, font: "600 13px var(--font-mono-stack)", textAlign: "center" }}
      />
      <span className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)", width: 32 }}>{unit}</span>
    </div>
  );
}

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* APPOINTMENT RULES */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">APPOINTMENT RULES</span>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
          <NumRow
            title="Maximum appointment duration"
            desc="Caps the length of any single visit"
            value={settings.maxApptDuration}
            unit="min"
            onChange={(v) => setSetting("maxApptDuration", v)}
          />
          <NumRow
            title="Advance booking window"
            desc="How far ahead appointments may be booked"
            value={settings.advanceBooking}
            unit="days"
            onChange={(v) => setSetting("advanceBooking", v)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>Permit staff-to-staff appointments</div>
              <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", marginTop: 2 }}>Inter-department meetings with security escort</div>
            </div>
            <button
              onClick={() => setSetting("staffToStaff", !settings.staffToStaff)}
              style={{
                width: 42,
                height: 24,
                borderRadius: 13,
                cursor: "pointer",
                border: "none",
                position: "relative",
                transition: ".2s",
                background: settings.staffToStaff ? "var(--accent)" : "var(--border2)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: ".2s",
                  left: settings.staffToStaff ? 21 : 3,
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ACCESS CONTROL RULES */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">ACCESS CONTROL RULES</span>
        </div>
        <div style={{ padding: 18 }}>
          <NumRow
            title="Default max failed attempts before escalation"
            desc="Individual checkpoints can override this"
            value={settings.maxFailedTries}
            unit="tries"
            onChange={(v) => setSetting("maxFailedTries", v)}
          />
        </div>
      </div>

      <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", textAlign: "center" }}>
        All settings changes are audit-logged · who changed what, and when · cache TTL 30s
      </div>
    </div>
  );
}
