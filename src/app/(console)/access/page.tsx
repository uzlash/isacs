"use client";

import { useState } from "react";
import { Plus, Play, Link2, Power, ScanLine, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { cardTypeTone, rel } from "@/lib/format";
import { PanelHeader } from "@/components/ui";
import LockdownPanel from "@/components/LockdownPanel";
import NodeWizard from "@/components/NodeWizard";
import NodeInspector from "@/components/NodeInspector";
import CardModal from "@/components/CardModal";
import IdentifyCardModal from "@/components/IdentifyCardModal";
import { useLockdown } from "@/lib/useLockdown";
import { useSessionUser } from "@/lib/auth";
import { createCard, deactivateCard, deleteCard } from "@/lib/api/cards";
import type { AccessCard, AccessNode, CheckLogEntry } from "@/lib/types";

interface TreeRow extends AccessNode {
  depth: number;
  hasKids: boolean;
  open: boolean;
}

const CARD_COLS = "1.3fr 120px 1fr 80px 100px 190px";
const CARD_WRITE_ROLES = ["super_admin", "security_manager", "security_personnel", "staff_admin"];

export default function AccessPage() {
  const [showWizard, setShowWizard] = useState(false);
  const [editNode, setEditNode] = useState<AccessNode | null>(null);
  const [checkCard, setCheckCard] = useState<AccessCard | null>(null);
  useStore((s) => s.tick);
  const nodes = useStore((s) => s.nodes);
  const cards = useStore((s) => s.cards);
  const expanded = useStore((s) => s.expanded);
  const selectedNode = useStore((s) => s.selectedNode);
  const checkForm = useStore((s) => s.checkForm);
  const toggleNode = useStore((s) => s.toggleNode);
  const selectNode = useStore((s) => s.selectNode);
  const runCheckFor = useStore((s) => s.runCheckFor);
  const refreshNodes = useStore((s) => s.refreshNodes);
  const refreshCards = useStore((s) => s.refreshCards);

  const [showNewCard, setShowNewCard] = useState(false);
  const [showIdentify, setShowIdentify] = useState(false);
  const [assignCardTarget, setAssignCardTarget] = useState<AccessCard | null>(null);

  const { active, history, refresh: refreshLockdown } = useLockdown();
  const user = useSessionUser();
  const canWrite = !!user && ["super_admin", "security_manager", "security_personnel"].includes(user.role);
  const canWriteCards = !!user && CARD_WRITE_ROLES.includes(user.role);

  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const selected = nodes.find((n) => n.id === selectedNode) ?? null;
  const openEdit = (n: AccessNode) => {
    setEditNode(n);
    setShowWizard(true);
  };

  const deactivate = async (c: AccessCard) => {
    if (!confirm(`Deactivate card ${c.num}? It is denied at all checkpoints immediately, even if assigned.`)) return;
    try {
      await deactivateCard(c.id);
      await refreshCards();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to deactivate card");
    }
  };
  const removeCard = async (c: AccessCard) => {
    if (!confirm(`Delete card ${c.num}? If it has an active assignment you must revoke it first.`)) return;
    try {
      await deleteCard(c.id);
      await refreshCards();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete card (revoke its assignment first?)");
    }
  };

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
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <LockdownPanel active={active} history={history} refresh={refreshLockdown} canWrite={canWrite} nodeName={nodeName} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: 16, alignItems: "start" }}>
      {/* NODE HIERARCHY */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <PanelHeader
          title="ACCESS NODE HIERARCHY"
          right={
            <button
              onClick={() => {
                setEditNode(null);
                setShowWizard(true);
              }}
              className="btn-accent"
              style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".5px", padding: "6px 11px", display: "flex", alignItems: "center", gap: 5 }}
            >
              <Plus size={12} strokeWidth={2.6} /> NEW NODE
            </button>
          }
        />
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
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
      </div>

      {/* NODE INSPECTOR — click a node → see it on the map, edit/delete, lock down */}
      <NodeInspector
        node={selected}
        nodes={nodes}
        active={active}
        canWrite={canWrite}
        refreshLockdown={refreshLockdown}
        onSelect={selectNode}
        onEdit={openEdit}
        onDeleted={() => {
          void refreshNodes();
        }}
      />

      {/* CARDS REGISTRY (full width) — run access checks per-card from here */}
      <div className="panel" style={{ gridColumn: "1 / -1", overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="panel-title">ACCESS CARDS · {cards.length} REGISTERED</span>
          <span className="panel-sub">· assign to a holder · run a live checkpoint check</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowIdentify(true)} className="btn" style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".5px", padding: "6px 11px", display: "flex", alignItems: "center", gap: 5 }}>
            <ScanLine size={12} strokeWidth={2.4} /> IDENTIFY CARD
          </button>
          {canWriteCards && (
            <button onClick={() => setShowNewCard(true)} className="btn-accent" style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".5px", padding: "6px 11px", display: "flex", alignItems: "center", gap: 5 }}>
              <Plus size={12} strokeWidth={2.6} /> NEW CARD
            </button>
          )}
        </div>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: CARD_COLS, gap: 10, padding: "10px 16px" }}>
          <span>Identifiers</span><span>Type</span><span>Holder</span><span>Nodes</span><span>Status</span><span style={{ textAlign: "right" }}>Actions</span>
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
              <span style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  onClick={() => setCheckCard(c)}
                  className="btn"
                  title="Run access check"
                  style={{ height: 28, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 4, font: "600 9px var(--font-mono-stack)", letterSpacing: ".3px" }}
                >
                  <Play size={10} strokeWidth={2.4} /> CHECK
                </button>
                {canWriteCards && (
                  <>
                    <CardActionBtn onClick={() => setAssignCardTarget(c)} title="Assign to holder + nodes" tone="var(--accent)"><Link2 size={12} strokeWidth={1.9} /></CardActionBtn>
                    {c.active && <CardActionBtn onClick={() => deactivate(c)} title="Deactivate" tone="var(--warn)"><Power size={12} strokeWidth={1.9} /></CardActionBtn>}
                    <CardActionBtn onClick={() => removeCard(c)} title="Delete" tone="var(--danger)"><Trash2 size={12} strokeWidth={1.9} /></CardActionBtn>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      </div>

      {checkCard && (
        <CheckModal
          card={checkCard}
          nodes={nodes}
          defaultNodeId={checkForm.nodeId}
          onClose={() => setCheckCard(null)}
          onRun={runCheckFor}
        />
      )}

      {showNewCard && (
        <CardModal
          mode="create"
          onClose={() => setShowNewCard(false)}
          onDone={async () => {
            setShowNewCard(false);
            await refreshCards();
          }}
          onCreate={createCard}
        />
      )}

      {assignCardTarget && (
        <CardModal
          mode="assign"
          card={assignCardTarget}
          onClose={() => setAssignCardTarget(null)}
          onDone={async () => {
            setAssignCardTarget(null);
            await refreshCards();
          }}
        />
      )}

      {showIdentify && <IdentifyCardModal onClose={() => setShowIdentify(false)} />}

      {showWizard && (
        <NodeWizard
          editNode={editNode ?? undefined}
          onClose={() => {
            setShowWizard(false);
            setEditNode(null);
          }}
        />
      )}
    </div>
  );
}

function CardActionBtn({ children, onClick, title, tone }: { children: React.ReactNode; onClick: () => void; title: string; tone?: string }) {
  return (
    <button onClick={onClick} title={title} className="mono" style={{ height: 28, minWidth: 28, padding: "0 7px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, cursor: "pointer", background: "transparent", border: `1px solid ${tone ? tone : "var(--border2)"}`, color: tone ? tone : "var(--muted)" }}>
      {children}
    </button>
  );
}

// Per-card checkpoint check. Credential is pre-filled from the card; operator
// picks which of the three identifiers to present and against which checkpoint.
function CheckModal({
  card,
  nodes,
  defaultNodeId,
  onClose,
  onRun,
}: {
  card: AccessCard;
  nodes: AccessNode[];
  defaultNodeId: string;
  onClose: () => void;
  onRun: (code: string, nodeId: string) => Promise<CheckLogEntry | null>;
}) {
  const idents = [
    { label: "Card #", value: card.num },
    { label: "RFID", value: card.rfid },
    { label: "QR", value: card.qr },
  ].filter((i) => i.value) as { label: string; value: string }[];

  const [code, setCode] = useState(idents[0]?.value ?? card.num);
  const [nodeId, setNodeId] = useState(defaultNodeId || nodes[0]?.id || "");
  const [busy, setBusy] = useState(false);
  // per-card session log — this card's checks only, most recent first
  const [results, setResults] = useState<CheckLogEntry[]>([]);

  const run = async () => {
    if (!code || !nodeId) return;
    setBusy(true);
    try {
      const entry = await onRun(code, nodeId);
      if (entry) setResults((prev) => [entry, ...prev].slice(0, 8));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--accent)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden" }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flex: "0 0 8px" }} />
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>Run access check</span>
          <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>· {card.holder}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ font: "500 11px var(--font-sans-stack)", color: "var(--muted)", lineHeight: 1.55 }}>
            Presents this card&apos;s credential at a checkpoint and runs the 5-step decision sequence. Repeated denials auto-escalate to ASRS at the node&apos;s threshold.
          </div>

          {idents.length > 1 && (
            <div>
              <div className="field-label" style={{ marginBottom: 6 }}>PRESENT AS</div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {idents.map((i) => {
                  const on = code === i.value;
                  return (
                    <button
                      key={i.label}
                      onClick={() => setCode(i.value)}
                      className="mono"
                      style={{ padding: "6px 11px", borderRadius: 7, cursor: "pointer", font: "600 9.5px var(--font-mono-stack)", border: `1px solid ${on ? "var(--accent)" : "var(--border2)"}`, background: on ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", color: on ? "var(--accent)" : "var(--muted)" }}
                    >
                      {i.label} · {i.value}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="field-label" style={{ marginBottom: 5 }}>CHECKPOINT</div>
            <select className="select" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px" }}>
            Presenting <span style={{ color: "var(--accent)" }}>{code}</span> at{" "}
            <span style={{ color: "var(--fg)" }}>{nodes.find((n) => n.id === nodeId)?.name ?? "—"}</span>
          </div>

          <button
            onClick={run}
            disabled={busy || !nodeId}
            style={{ width: "100%", height: 44, borderRadius: 9, border: "none", background: "var(--accent)", color: "#04120f", font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".7px", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
          >
            {busy ? "RUNNING…" : "▶ RUN ACCESS CHECK"}
          </button>

          {results.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: "1px", color: "var(--faint)", marginBottom: 8 }}>
                CHECK RESULTS · THIS CARD
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {results.map((e) => {
                  const tone = e.granted ? "var(--ok)" : e.escalated ? "var(--danger)" : "var(--warn)";
                  const label = e.granted ? "GRANTED" : e.escalated ? "DENIED → ESCALATED" : "DENIED";
                  const detail = e.granted ? e.holder || "" : `${e.reason ?? ""} (${e.tries}/${e.maxT})`;
                  return (
                    <div key={e.id} className="anim-in" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, background: "var(--bg)", border: `1px solid ${e.granted ? "var(--ok)" : e.escalated ? "var(--danger)" : "var(--border2)"}` }}>
                      <span className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", width: 34, flex: "0 0 34px" }}>{rel(e.at)}</span>
                      <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: ".4px", color: tone, width: 130, flex: "0 0 130px" }}>{label}</span>
                      <span style={{ font: "500 10.5px var(--font-sans-stack)", color: "var(--fg)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.node} · {detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
