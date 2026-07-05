"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Lock, MapPin, Pencil, Plus, Trash2, Users, Wifi, WifiOff } from "lucide-react";
import FacilityKmlMap, { type NodeMarker } from "@/components/map/FacilityKmlMap";
import { deleteNode } from "@/lib/api/nodes";
import { initiateLockdown, liftLockdown, type Lockdown } from "@/lib/api/lockdown";
import { listAcms, type Acm } from "@/lib/api/acms";
import { useStore } from "@/lib/store";
import { isLive } from "@/lib/config";
import type { AccessNode } from "@/lib/types";

interface Props {
  node: AccessNode | null;
  nodes: AccessNode[];
  active: Lockdown | null;
  canWrite: boolean;
  refreshLockdown: () => Promise<void>;
  onSelect: (id: string) => void;
  onEdit: (node: AccessNode) => void;
  onDeleted: () => void;
}

export default function NodeInspector({ node, nodes, active, canWrite, refreshLockdown, onSelect, onEdit, onDeleted }: Props) {
  const users = useStore((s) => s.users);
  const router = useRouter();
  const [modal, setModal] = useState<null | "lock" | "lift">(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ACM modules attached to the selected node (live mode).
  const [acms, setAcms] = useState<Acm[] | null>(null);
  const nodeId = node?.id;
  useEffect(() => {
    if (!isLive || !nodeId) {
      setAcms(null);
      return;
    }
    let cancelled = false;
    setAcms(null);
    listAcms({ nodeId })
      .then((list) => !cancelled && setAcms(list))
      .catch(() => !cancelled && setAcms([]));
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const markers: NodeMarker[] = nodes
    .filter((n) => n.latitude != null && n.longitude != null)
    .map((n) => ({ id: n.id, name: n.name, lat: n.latitude as number, lng: n.longitude as number }));

  if (!node) {
    return (
      <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, border: "1px dashed var(--border2)" }}>
        <span className="mono" style={{ font: "500 11.5px var(--font-mono-stack)", color: "var(--faint)", textAlign: "center", padding: "0 24px" }}>
          Select a node from the tree (or a marker on the map) to view its location and lock it down.
        </span>
      </div>
    );
  }

  const hasCoords = node.latitude != null && node.longitude != null;
  const isLocked = !!active && (active.nodeIds === null || active.nodeIds.includes(node.id));
  const parent = node.parent ? nodes.find((n) => n.id === node.parent) : null;
  const fmt = (n: number) => n.toFixed(6);
  // personnel posted to this node (assignment lives on the user account —
  // managed in User Management via assignedNodeIds)
  const assigned = users.filter((u) => u.assignedNodeIds?.includes(node.id));

  const remove = async () => {
    if (!confirm(`Delete access node "${node.name}"? Nodes with children cannot be deleted.`)) return;
    try {
      await deleteNode(node.id);
      onDeleted();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete node");
    }
  };

  const submitLock = async () => {
    if (!text.trim()) return setError("A reason is required — it goes into the audit trail.");
    setBusy(true);
    setError("");
    try {
      await initiateLockdown(text.trim(), [node.id]);
      await refreshLockdown();
      setModal(null);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initiate lockdown");
      await refreshLockdown();
    } finally {
      setBusy(false);
    }
  };

  const submitLift = async () => {
    if (!active) return;
    if (!text.trim()) return setError("A resolution is required to lift the lockdown.");
    setBusy(true);
    setError("");
    try {
      await liftLockdown(active.id, text.trim());
      await refreshLockdown();
      setModal(null);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to lift lockdown");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ overflow: "hidden", border: isLocked ? "1px solid var(--danger)" : "1px solid var(--border)" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: isLocked ? "var(--danger)" : "var(--accent)", flex: "0 0 9px", ...(isLocked ? { animation: "isacs-pulse 1.6s infinite" } : {}) }} />
        <span className="panel-title">{node.name}</span>
        <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>L{node.level} · max {node.max}</span>
        {isLocked && <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 4, padding: "1px 6px" }}>LOCKED DOWN</span>}
      </div>

      <div style={{ padding: 14 }}>
        <FacilityKmlMap
          height={220}
          showSwitcher={false}
          nodeMarkers={markers}
          selectedNodeId={node.id}
          onNodeClick={onSelect}
          marker={hasCoords ? { lat: node.latitude as number, lng: node.longitude as number } : null}
          focus={hasCoords ? { lat: node.latitude as number, lng: node.longitude as number } : null}
        />

        <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
          <Meta label="LOCATION">{node.loc || "—"}</Meta>
          <Meta label="PARENT">{parent ? parent.name : "Root node"}</Meta>
          <Meta label="COORDINATES">
            {hasCoords ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin size={11} strokeWidth={2} color="var(--accent)" />{fmt(node.latitude as number)}, {fmt(node.longitude as number)}</span>
            ) : (
              <span style={{ color: "var(--warn)" }}>not set — edit to place on map</span>
            )}
          </Meta>
        </div>

        {/* Personnel posted here — assignment is edited in User Management */}
        <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden" }}>
          <div style={{ padding: "9px 12px", borderBottom: assigned.length ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 7, background: "var(--bg)" }}>
            <Users size={12} strokeWidth={1.9} color="var(--muted)" />
            <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)" }}>ASSIGNED PERSONNEL</span>
            <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", color: assigned.length ? "var(--accent)" : "var(--faint)" }}>· {assigned.length}</span>
            <div style={{ flex: 1 }} />
            <span className="mono" style={{ font: "500 8.5px var(--font-mono-stack)", color: "var(--faint)" }}>manage in User Management</span>
          </div>
          {assigned.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {assigned.map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.active ? "var(--ok)" : "var(--faint)", flex: "0 0 6px" }} />
                  <span style={{ font: "500 11.5px var(--font-sans-stack)", color: "var(--fg)" }}>{u.staff !== "—" ? u.staff : u.email}</span>
                  <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{u.email}</span>
                  {!u.active && <span className="mono" style={{ font: "600 8px var(--font-mono-stack)", color: "var(--faint)", border: "1px solid var(--border2)", borderRadius: 3, padding: "1px 5px" }}>DEACTIVATED</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="mono" style={{ padding: "10px 12px", font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>
              No personnel posted to this node.
            </div>
          )}
        </div>

        {/* ACM modules mounted at this node */}
        {isLive && (
          <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden" }}>
            <div style={{ padding: "9px 12px", borderBottom: acms && acms.length ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 7, background: "var(--bg)" }}>
              <Cpu size={12} strokeWidth={1.9} color="var(--muted)" />
              <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)" }}>ACCESS CONTROL MODULES</span>
              <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", color: acms && acms.length ? "var(--accent)" : "var(--faint)" }}>· {acms ? acms.length : "…"}</span>
              <div style={{ flex: 1 }} />
              {canWrite && (
                <button
                  onClick={() => router.push("/acms")}
                  className="mono"
                  title="Register a module for this node"
                  style={{ display: "flex", alignItems: "center", gap: 4, font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".4px", color: "var(--accent)", background: "transparent", border: "1px solid var(--border2)", borderRadius: 5, padding: "3px 7px", cursor: "pointer" }}
                >
                  <Plus size={10} strokeWidth={2.6} /> REGISTER
                </button>
              )}
            </div>
            {acms === null ? (
              <div className="mono" style={{ padding: "10px 12px", font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>loading modules…</div>
            ) : acms.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {acms.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
                    {a.isOnline ? <Wifi size={12} strokeWidth={2} color="var(--ok)" /> : <WifiOff size={12} strokeWidth={2} color="var(--faint)" />}
                    <span style={{ font: "500 11.5px var(--font-sans-stack)", color: "var(--fg)" }}>{a.name}</span>
                    <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{a.serialNumber}</span>
                    <div style={{ flex: 1 }} />
                    {!a.isActive && <span className="mono" style={{ font: "600 8px var(--font-mono-stack)", color: "var(--faint)", border: "1px solid var(--border2)", borderRadius: 3, padding: "1px 5px" }}>DISABLED</span>}
                    <span className="mono" style={{ font: "600 8px var(--font-mono-stack)", letterSpacing: ".3px", color: a.isOnline ? "var(--ok)" : "var(--faint)" }}>{a.isOnline ? "ONLINE" : "OFFLINE"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mono" style={{ padding: "10px 12px", font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>
                No modules mounted at this node yet.
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {canWrite && (
            <>
              <button onClick={() => onEdit(node)} className="btn" style={{ height: 36, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, font: "600 10px var(--font-mono-stack)", letterSpacing: ".4px" }}>
                <Pencil size={13} strokeWidth={1.9} /> EDIT
              </button>
              <button onClick={remove} className="mono" style={{ height: 36, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, font: "600 10px var(--font-mono-stack)", letterSpacing: ".4px", borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--danger)" }}>
                <Trash2 size={13} strokeWidth={1.9} /> DELETE
              </button>
              <div style={{ flex: 1 }} />
              {isLocked ? (
                <button onClick={() => { setText(""); setError(""); setModal("lift"); }} className="mono" style={{ height: 36, padding: "0 16px", font: "600 10px var(--font-mono-stack)", letterSpacing: ".4px", borderRadius: 7, cursor: "pointer", border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)" }}>
                  LIFT LOCKDOWN
                </button>
              ) : (
                <button onClick={() => { setText(""); setError(""); setModal("lock"); }} className="mono" style={{ height: 36, padding: "0 16px", display: "flex", alignItems: "center", gap: 6, font: "600 10px var(--font-mono-stack)", letterSpacing: ".4px", borderRadius: 7, cursor: "pointer", border: "none", background: "var(--danger)", color: "#fff" }}>
                  <Lock size={12} strokeWidth={2.4} /> LOCK DOWN NODE
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {modal && (
        <div onClick={() => !busy && setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
              <span style={{ font: "600 13px var(--font-sans-stack)", color: modal === "lock" ? "var(--danger)" : "var(--fg)" }}>
                {modal === "lock" ? `Lock down · ${node.name}` : "Lift lockdown"}
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>
              <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>
                {modal === "lock"
                  ? `Locks the ACM devices at ${node.name}. Only one lockdown can be active facility-wide at a time.`
                  : "Unlocks all affected ACM devices and auto-resolves the linked ASRS report."}
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 5 }}>{modal === "lock" ? "REASON (AUDIT TRAIL)" : "RESOLUTION (AUDIT TRAIL)"}</div>
                <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={modal === "lock" ? "e.g. Unidentified person at this checkpoint" : "e.g. Situation cleared"} style={{ minHeight: 64 }} autoFocus />
              </div>
              {error && <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {error}</div>}
              <button
                onClick={modal === "lock" ? submitLock : submitLift}
                disabled={busy}
                className="mono"
                style={{ width: "100%", height: 42, borderRadius: 10, border: "none", background: modal === "lock" ? "var(--danger)" : "var(--accent)", color: modal === "lock" ? "#fff" : "#04120f", font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
              >
                {busy ? "WORKING…" : modal === "lock" ? "CONFIRM LOCKDOWN" : "LIFT LOCKDOWN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)" }}>{label}</div>
      <div style={{ font: "500 11px var(--font-sans-stack)", color: "var(--muted)", marginTop: 3 }}>{children}</div>
    </div>
  );
}
