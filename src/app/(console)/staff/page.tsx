"use client";

import { useStore } from "@/lib/store";
import { initials } from "@/lib/format";

const COLS = "2fr 1fr 1.4fr 1.4fr 100px";

export default function StaffPage() {
  const staff = useStore((s) => s.staff);

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto" }}>
      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 16px" }}>
          <span>Name</span><span>Staff ID</span><span>Department</span><span>Designation</span><span>Account</span>
        </div>
        {staff.map((s) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="mono" style={{ width: 30, height: 30, borderRadius: 7, background: "var(--panel3)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 10px var(--font-mono-stack)", color: "var(--accent)" }}>
                {initials(s.name)}
              </div>
              <span style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>{s.name}</span>
            </div>
            <span className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)" }}>{s.staffId}</span>
            <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{s.dept}</span>
            <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{s.desig}</span>
            <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{s.email}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
