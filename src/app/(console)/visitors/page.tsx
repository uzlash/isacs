"use client";

import { Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { initials, rel } from "@/lib/format";

const COLS = "2fr 1.6fr 1.4fr 130px 120px";

export default function VisitorsPage() {
  useStore((s) => s.tick);
  const visitors = useStore((s) => s.visitors);
  const search = useStore((s) => s.visitorSearch);
  const setSearch = useStore((s) => s.setVisitorSearch);
  const checkIn = useStore((s) => s.checkIn);

  const q = search.toLowerCase();
  const rows = visitors.filter(
    (v) => !q || v.name.toLowerCase().includes(q) || v.org.toLowerCase().includes(q)
  );

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, maxWidth: 320, display: "flex", alignItems: "center", gap: 9, height: 36, padding: "0 12px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <Search size={14} strokeWidth={2} color="var(--faint)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visitors…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--fg)", font: "500 12px var(--font-sans-stack)" }}
          />
        </div>
        <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>
          Persistent profiles · returning visitors not re-registered
        </span>
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 16px" }}>
          <span>Visitor</span><span>Organisation</span><span>Contact</span><span>Status</span><span />
        </div>
        {rows.map((v) => {
          const onSite = !!v.checkedIn;
          return (
            <div key={v.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="mono" style={{ width: 30, height: 30, borderRadius: 7, background: "var(--panel3)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 10px var(--font-mono-stack)", color: "var(--muted)" }}>
                  {initials(v.name)}
                </div>
                <div>
                  <div style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>{v.name}</div>
                  <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{v.desig}</div>
                </div>
              </div>
              <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{v.org}</span>
              <span className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)" }}>{v.phone}</span>
              <span>
                <span
                  className="pill mono"
                  style={
                    onSite
                      ? { color: "var(--ok)", border: "1px solid var(--ok)" }
                      : { color: "var(--faint)", border: "1px solid var(--border2)" }
                  }
                >
                  {onSite ? `${rel(v.checkedIn!)} ago` : "Not on site"}
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                {onSite ? (
                  <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--ok)" }}>● on site</span>
                ) : (
                  <button
                    onClick={() => checkIn(v.id)}
                    className="mono"
                    style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".4px", padding: "5px 11px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)" }}
                  >
                    CHECK IN
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
