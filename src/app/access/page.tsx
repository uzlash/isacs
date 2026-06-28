"use client";

import { useStore } from "@/lib/store";
import { cardTypeTone, rel } from "@/lib/format";
import { PanelHeader } from "@/components/ui";
import type { AccessNode } from "@/lib/types";

interface TreeRow extends AccessNode {
  depth: number;
  hasKids: boolean;
  open: boolean;
}

const CARD_COLS = "1fr 130px 1fr 90px 110px";

export default function AccessPage() {
  useStore((s) => s.tick);
  const nodes = useStore((s) => s.nodes);
  const cards = useStore((s) => s.cards);
  const expanded = useStore((s) => s.expanded);
  const selectedNode = useStore((s) => s.selectedNode);
  const checkForm = useStore((s) => s.checkForm);
  const checkLog = useStore((s) => s.checkLog);
  const toggleNode = useStore((s) => s.toggleNode);
  const selectNode = useStore((s) => s.selectNode);
  const setCheckNode = useStore((s) => s.setCheckNode);
  const setCheckCode = useStore((s) => s.setCheckCode);
  const runCheck = useStore((s) => s.runCheck);

  // build the visible (collapsible) tree
  const byParent: Record<string, AccessNode[]> = {};
  nodes.forEach((n) => {
    const key = n.parent ?? "root";
    (byParent[key] = byParent[key] || []).push(n);
  });
  const rows: TreeRow[] = [];
  const walk = (pid: string, depth: number) => {
    (byParent[pid] || []).forEach((n) => {
      const kids = byParent[n.id] || [];
      const open = expanded[n.id] === true;
      rows.push({ ...n, depth, hasKids: kids.length > 0, open });
      if (open) walk(n.id, depth + 1);
    });
  };
  walk("root", 0);

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* NODE HIERARCHY */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <PanelHeader title="ACCESS NODE HIERARCHY" right={<span className="panel-sub">inheritance flows down ↓</span>} />
        {rows.map((n) => (
          <div
            key={n.id}
            onClick={() => selectNode(n.id)}
            className="row-hover"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderBottom: "1px solid var(--border)",
              background: n.id === selectedNode ? "var(--panel2)" : "transparent",
            }}
          >
            <span style={{ width: n.depth * 22, flex: "0 0 auto" }} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(n.id);
              }}
              style={{ width: 18, flex: "0 0 18px", background: "none", border: "none", color: "var(--faint)", cursor: "pointer", fontSize: 11, padding: 0 }}
            >
              {n.hasKids ? (n.open ? "▾" : "▸") : ""}
            </button>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent)", flex: "0 0 9px" }} />
            <span style={{ flex: 1, font: "500 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>{n.name}</span>
            <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>L{n.level}</span>
            <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--warn)", border: "1px solid var(--border2)", padding: "1px 6px", borderRadius: 4 }}>
              max {n.max}
            </span>
          </div>
        ))}
      </div>

      {/* CHECKPOINT ENGINE + DECISION LOG */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="panel" style={{ border: "1px solid var(--accent)", overflow: "hidden" }}>
          <PanelHeader title="LIVE CHECKPOINT ENGINE" dot="var(--accent)" />
          <div style={{ padding: 16 }}>
            <div style={{ font: "500 11px var(--font-sans-stack)", color: "var(--muted)", lineHeight: 1.55, marginBottom: 14 }}>
              Simulate a credential presented at a checkpoint. Runs the 5-step decision sequence; repeated denials auto-escalate to ASRS at the node&apos;s threshold.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 13 }}>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>CHECKPOINT</div>
                <select className="select" value={checkForm.nodeId} onChange={(e) => setCheckNode(e.target.value)}>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>CREDENTIAL</div>
                <input
                  className="input mono"
                  style={{ font: "500 12px var(--font-mono-stack)" }}
                  value={checkForm.code}
                  onChange={(e) => setCheckCode(e.target.value)}
                  placeholder="RFID / QR / Card #"
                />
              </div>
            </div>
            <button
              onClick={runCheck}
              style={{ width: "100%", height: 42, borderRadius: 8, border: "none", background: "var(--accent)", color: "#04120f", font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".7px", cursor: "pointer" }}
            >
              ▶ RUN ACCESS CHECK
            </button>
            <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
              <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)" }}>Try:</span>
              <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--muted)" }}>
                RFID-8841 @ Building A ✓ · QR-VIS-7741 @ Server Room ✗ (×2 → escalates)
              </span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ overflow: "hidden" }}>
          <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--border)" }}>
            <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: "1px", color: "var(--faint)" }}>DECISION LOG</span>
          </div>
          {checkLog.length > 0 ? (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {checkLog.map((e) => {
                const tone = e.granted ? "var(--ok)" : e.escalated ? "var(--danger)" : "var(--warn)";
                const label = e.granted ? "GRANTED" : e.escalated ? "DENIED → ESCALATED" : "DENIED";
                const detail = e.granted ? e.holder || "" : `${e.reason} (${e.tries}/${e.maxT})`;
                return (
                  <div key={e.id} className="anim-in" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
                    <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", width: 34, flex: "0 0 34px" }}>{rel(e.at)}</span>
                    <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: ".4px", color: tone, width: 128, flex: "0 0 128px" }}>{label}</span>
                    <span style={{ font: "500 11px var(--font-sans-stack)", color: "var(--fg)", flex: 1 }}>{e.node} · {detail}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: "center", font: "500 11px var(--font-sans-stack)", color: "var(--faint)" }}>No checks run yet.</div>
          )}
        </div>
      </div>

      {/* CARDS REGISTRY (full width) */}
      <div className="panel" style={{ gridColumn: "1 / -1", overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">ACCESS CARDS · {cards.length} REGISTERED</span>
        </div>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: CARD_COLS, gap: 10, padding: "10px 16px" }}>
          <span>Identifiers</span><span>Type</span><span>Holder</span><span>Nodes</span><span>Status</span>
        </div>
        {cards.map((c) => {
          const idents = [c.num, c.rfid, c.qr].filter(Boolean).join(" · ");
          return (
            <div key={c.id} style={{ display: "grid", gridTemplateColumns: CARD_COLS, gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <span className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--fg)" }}>{idents}</span>
              <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", textTransform: "uppercase", color: cardTypeTone[c.type] }}>{c.type}</span>
              <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{c.holder}</span>
              <span className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)" }}>{c.nodes.length} node(s)</span>
              <span>
                <span
                  className="pill mono"
                  style={
                    c.active
                      ? { color: "var(--ok)", border: "1px solid var(--ok)" }
                      : { color: "var(--faint)", border: "1px solid var(--border2)" }
                  }
                >
                  {c.active ? "ACTIVE" : "DEACTIVATED"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
