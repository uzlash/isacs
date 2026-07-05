"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Cpu, KeyRound, Pencil, Plus, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSessionUser } from "@/lib/auth";
import { rel } from "@/lib/format";
import {
  createAcm,
  deleteAcm,
  listAcms,
  rotateAcmSecret,
  updateAcm,
  type Acm,
  type AcmRegistration,
} from "@/lib/api/acms";

const COLS = "150px 1.4fr 1fr 110px 110px 150px";
const WRITE_ROLES = ["super_admin", "security_manager"];

type Modal =
  | { kind: "create" }
  | { kind: "edit"; acm: Acm }
  | { kind: "secret"; title: string; serial: string; mqttUsername?: string; secret: string };

export default function AcmsPage() {
  const nodes = useStore((s) => s.nodes);
  const acmVersion = useStore((s) => s.acmVersion);
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const user = useSessionUser();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);

  const [acms, setAcms] = useState<Acm[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const [modal, setModal] = useState<Modal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr("");
    try {
      setAcms(await listAcms());
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load ACM devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // live connectivity: re-fetch when an acm.online/offline event arrives
  useEffect(() => {
    if (acmVersion > 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acmVersion]);

  const shown = acms.filter((a) =>
    filter === "all" ? true : filter === "online" ? a.isOnline : !a.isOnline
  );
  const online = acms.filter((a) => a.isOnline).length;

  const toggleActive = async (a: Acm) => {
    try {
      await updateAcm(a.id, { isActive: !a.isActive });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update device");
    }
  };

  const remove = async (a: Acm) => {
    if (!confirm(`Remove ACM "${a.name}" (${a.serialNumber})? Its broker credentials are revoked and it can no longer connect.`)) return;
    try {
      await deleteAcm(a.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove device");
    }
  };

  const rotate = async (a: Acm) => {
    if (!confirm(`Rotate the device secret for "${a.name}"? The current secret is invalidated immediately — you must re-flash the device.`)) return;
    try {
      const { deviceSecret } = await rotateAcmSecret(a.id);
      setModal({ kind: "secret", title: "Secret rotated", serial: a.serialNumber, secret: deviceSecret });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to rotate secret");
    }
  };

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Cpu size={16} strokeWidth={1.9} color="var(--accent)" />
          <span className="panel-title">ACCESS CONTROL MODULES</span>
          <span className="panel-sub">· {acms.length} registered · {online} online</span>
          <div style={{ flex: 1 }} />
          {/* connectivity filter */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 3, border: "1px solid var(--border)" }}>
            {(["all", "online", "offline"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="mono"
                style={{
                  font: "600 9px var(--font-mono-stack)",
                  letterSpacing: ".4px",
                  padding: "5px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  border: "none",
                  textTransform: "uppercase",
                  background: filter === f ? "var(--panel2)" : "transparent",
                  color: filter === f ? "var(--fg)" : "var(--faint)",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => void load()} className="btn" style={{ height: 32, padding: "0 10px", display: "flex", alignItems: "center", gap: 5, font: "600 9.5px var(--font-mono-stack)" }} title="Refresh">
            <RefreshCw size={12} strokeWidth={2} />
          </button>
          {canWrite && (
            <button onClick={() => setModal({ kind: "create" })} className="btn-accent" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={13} strokeWidth={2.4} /> REGISTER DEVICE
            </button>
          )}
        </div>

        <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 16px" }}>
          <span>Status</span><span>Device</span><span>Access Node</span><span>Last Seen</span><span>Active</span><span style={{ textAlign: "right" }}>Actions</span>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>Loading ACM devices…</div>
        ) : loadErr ? (
          <div style={{ padding: 22, textAlign: "center" }}>
            <div style={{ color: "var(--danger)", font: "500 12px var(--font-sans-stack)", marginBottom: 10 }}>⚠ {loadErr}</div>
            <button onClick={() => void load()} className="btn" style={{ height: 34, padding: "0 14px", font: "600 10px var(--font-mono-stack)" }}>RETRY</button>
          </div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>
            {acms.length === 0 ? "No ACM devices registered yet." : `No ${filter} devices.`}
          </div>
        ) : (
          shown.map((a) => (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {a.isOnline ? <Wifi size={13} strokeWidth={2} color="var(--ok)" /> : <WifiOff size={13} strokeWidth={2} color="var(--faint)" />}
                <span className="mono" style={{ font: "600 9.5px var(--font-mono-stack)", letterSpacing: ".3px", color: a.isOnline ? "var(--ok)" : "var(--faint)" }}>{a.isOnline ? "ONLINE" : "OFFLINE"}</span>
              </span>
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ font: "500 12.5px var(--font-sans-stack)", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>
                  {a.serialNumber}{a.firmwareVersion ? ` · fw ${a.firmwareVersion}` : ""}{a.ipAddress ? ` · ${a.ipAddress}` : ""}
                </span>
              </span>
              <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.node?.name || nodeName(a.nodeId)}</span>
              <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>{a.lastSeenAt ? rel(Date.parse(a.lastSeenAt)) + " ago" : "never"}</span>
              <span>
                <span className="pill mono" style={a.isActive ? { color: "var(--ok)", border: "1px solid var(--ok)" } : { color: "var(--faint)", border: "1px solid var(--border2)" }}>
                  {a.isActive ? "ACTIVE" : "DISABLED"}
                </span>
              </span>
              <span style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                {canWrite && (
                  <>
                    <IconBtn onClick={() => setModal({ kind: "edit", acm: a })} title="Edit"><Pencil size={12} strokeWidth={1.9} /></IconBtn>
                    <IconBtn onClick={() => rotate(a)} title="Rotate secret" tone="var(--warn)"><KeyRound size={12} strokeWidth={1.9} /></IconBtn>
                    <IconBtn onClick={() => toggleActive(a)} title={a.isActive ? "Disable" : "Enable"} tone={a.isActive ? "var(--warn)" : "var(--ok)"}>
                      <span className="mono" style={{ font: "600 8.5px var(--font-mono-stack)" }}>{a.isActive ? "OFF" : "ON"}</span>
                    </IconBtn>
                    <IconBtn onClick={() => remove(a)} title="Remove" tone="var(--danger)"><Trash2 size={12} strokeWidth={1.9} /></IconBtn>
                  </>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {modal?.kind === "create" && (
        <AcmForm
          nodes={nodes.map((n) => ({ id: n.id, name: n.name }))}
          onClose={() => setModal(null)}
          onCreated={(reg) => {
            setModal({ kind: "secret", title: "Device registered", serial: reg.serialNumber, mqttUsername: reg.mqttUsername, secret: reg.deviceSecret });
            void load();
          }}
        />
      )}

      {modal?.kind === "edit" && (
        <AcmEdit
          acm={modal.acm}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      )}

      {modal?.kind === "secret" && (
        <SecretModal
          title={modal.title}
          serial={modal.serial}
          mqttUsername={modal.mqttUsername}
          secret={modal.secret}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ---- register form ----
function AcmForm({ nodes, onClose, onCreated }: { nodes: { id: string; name: string }[]; onClose: () => void; onCreated: (r: AcmRegistration) => void }) {
  const [nodeId, setNodeId] = useState(nodes[0]?.id ?? "");
  const [serialNumber, setSerial] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!nodeId) return setError("Select the access node this device is mounted at.");
    if (!serialNumber.trim() || !name.trim()) return setError("Serial number and name are required.");
    setBusy(true);
    setError("");
    try {
      const reg = await createAcm({ nodeId, serialNumber: serialNumber.trim(), name: name.trim() });
      onCreated(reg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to register device");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Register ACM device" onClose={() => !busy && onClose()}>
      {nodes.length === 0 ? (
        <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--warn)", lineHeight: 1.5 }}>
          No access nodes exist yet — create a node in Access Control Nodes first, then register the device against it.
        </div>
      ) : (
        <>
          <Field label="ACCESS NODE (WHERE IT'S MOUNTED)">
            <select className="select" value={nodeId} onChange={(e) => setNodeId(e.target.value)} autoFocus>
              {nodes.map((n) => (<option key={n.id} value={n.id}>{n.name}</option>))}
            </select>
          </Field>
          <Field label="SERIAL NUMBER (UNIQUE)">
            <input className="input mono" value={serialNumber} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. ACM-A1-0007" />
          </Field>
          <Field label="DISPLAY NAME">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Gate Reader" />
          </Field>
          {error && <Err>{error}</Err>}
          <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
            {busy ? "REGISTERING…" : "REGISTER DEVICE"}
          </button>
        </>
      )}
    </Shell>
  );
}

// ---- edit (name + active) ----
function AcmEdit({ acm, onClose, onSaved }: { acm: Acm; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(acm.name);
  const [isActive, setIsActive] = useState(acm.isActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    setError("");
    try {
      await updateAcm(acm.id, { name: name.trim(), isActive });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update device");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={`Edit · ${acm.serialNumber}`} onClose={() => !busy && onClose()}>
      <Field label="DISPLAY NAME">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
        <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--fg)" }}>Active</span>
        <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>· disabled devices heartbeat but every scan is denied at the gateway</span>
      </label>
      {error && <Err>{error}</Err>}
      <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "SAVING…" : "SAVE CHANGES"}
      </button>
    </Shell>
  );
}

// ---- one-time secret reveal ----
function SecretModal({ title, serial, mqttUsername, secret, onClose }: { title: string; serial: string; mqttUsername?: string; secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState("");
  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  };
  return (
    <Shell title={title} onClose={onClose} accent="var(--warn)">
      <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--warn)", lineHeight: 1.55, background: "color-mix(in srgb, var(--warn) 10%, var(--panel))", border: "1px solid var(--warn)", borderRadius: 8, padding: "10px 12px" }}>
        ⚠ Flash these onto <span style={{ color: "var(--fg)" }}>{serial}</span> now. The device secret is shown <b>once only</b> and cannot be retrieved again — only rotated.
      </div>
      {mqttUsername && (
        <SecretRow label="MQTT USERNAME (= DEVICE ID)" value={mqttUsername} copied={copied === "user"} onCopy={() => copy("user", mqttUsername)} />
      )}
      <SecretRow label="DEVICE SECRET (MQTT PASSWORD)" value={secret} copied={copied === "secret"} onCopy={() => copy("secret", secret)} />
      <button onClick={onClose} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px" }}>
        I&apos;VE SAVED IT — DONE
      </button>
    </Shell>
  );
}

function SecretRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <div className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)", marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", gap: 7 }}>
        <div className="mono" style={{ flex: 1, font: "500 10.5px var(--font-mono-stack)", color: "var(--fg)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 11px", wordBreak: "break-all" }}>{value}</div>
        <button onClick={onCopy} className="btn" style={{ width: 42, display: "flex", alignItems: "center", justifyContent: "center" }} title="Copy">
          <Copy size={14} strokeWidth={1.9} color={copied ? "var(--ok)" : "var(--muted)"} />
        </button>
      </div>
      {copied && <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--ok)", marginTop: 4 }}>copied</div>}
    </div>
  );
}

// ---- shared bits ----
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
