"use client";

import { useState } from "react";
import { CalendarClock, Car, Keyboard, QrCode, ShieldCheck, User } from "lucide-react";
import { useStore } from "@/lib/store";
import { statusTone } from "@/lib/format";
import { listCards, getCard } from "@/lib/api/cards";
import { getStaff, type ApiStaffWithAccount } from "@/lib/api/staff";
import { getVisitor, type ApiVisitorFull } from "@/lib/api/visitors";
import { getAsset } from "@/lib/api/assets";
import QrScanner from "@/components/QrScanner";
import type { AccessCard, Asset } from "@/lib/types";

type Holder =
  | { type: "staff"; data: ApiStaffWithAccount }
  | { type: "visitor"; data: ApiVisitorFull }
  | { type: "asset"; data: Asset };

interface Result {
  card: AccessCard;
  nodeIds: string[];
  holder: Holder | null;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function visitorOnSite(v: ApiVisitorFull): boolean {
  if (!v.checkedInAt) return false;
  return !v.checkedOutAt || new Date(v.checkedOutAt).getTime() < new Date(v.checkedInAt).getTime();
}

export default function IdentifyCardModal({ onClose }: { onClose: () => void }) {
  const nodes = useStore((s) => s.nodes);
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const [mode, setMode] = useState<"type" | "scan">("type");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const identify = async (raw?: string) => {
    const value = (raw ?? code).trim();
    if (!value) return setError("Enter or scan a card code.");
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const allCards = await listCards();
      const match = allCards.find((c) => c.num === value || c.rfid === value || c.qr === value);
      if (!match) {
        setError("No card found matching that code.");
        return;
      }
      const full = await getCard(match.id);
      const active = full.cardAssignments?.find((a) => !a.revokedAt) ?? null;
      if (!active) {
        setResult({ card: match, nodeIds: [], holder: null });
        return;
      }
      const nodeIds = active.accessNodeIds ?? [];
      if (active.holderType === "staff") {
        setResult({ card: match, nodeIds, holder: { type: "staff", data: await getStaff(active.holderId) } });
      } else if (active.holderType === "visitor") {
        setResult({ card: match, nodeIds, holder: { type: "visitor", data: await getVisitor(active.holderId) } });
      } else {
        setResult({ card: match, nodeIds, holder: { type: "asset", data: await getAsset(active.holderId) } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to identify card");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 500, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>Identify Card</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 7, padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10 }}>
            <button onClick={() => { setMode("type"); setError(""); }} style={tabStyle(mode === "type")}>
              <Keyboard size={13} strokeWidth={1.9} /> TYPE / RFID
            </button>
            <button onClick={() => { setMode("scan"); setError(""); }} style={tabStyle(mode === "scan")}>
              <QrCode size={13} strokeWidth={1.9} /> SCAN QR
            </button>
          </div>

          {mode === "type" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && identify()}
                placeholder="tap card or type the code…"
                autoFocus
                disabled={busy}
                style={{ flex: 1 }}
              />
              <button onClick={() => identify()} disabled={busy} className="btn-accent" style={{ height: 38, padding: "0 16px", font: "600 10.5px var(--font-mono-stack)", letterSpacing: ".5px", opacity: busy ? 0.7 : 1 }}>
                {busy ? "…" : "IDENTIFY"}
              </button>
            </div>
          ) : (
            <QrScanner paused={busy} onDecode={(text) => identify(text)} />
          )}

          {error && (
            <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {error}</div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div className="field-label" style={{ marginBottom: 6 }}>CARD</div>
                <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.7, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 13px" }}>
                  ID: {[result.card.num, result.card.rfid, result.card.qr].filter(Boolean).join(" · ")}<br />
                  TYPE: {result.card.type} · {result.card.active ? "ACTIVE" : "DEACTIVATED"}<br />
                  NODES: {result.nodeIds.map(nodeName).join(", ") || "—"}
                </div>
              </div>

              {!result.holder ? (
                <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>Not currently assigned to anyone.</div>
              ) : result.holder.type === "staff" ? (
                <StaffPanel data={result.holder.data} />
              ) : result.holder.type === "visitor" ? (
                <VisitorPanel data={result.holder.data} />
              ) : (
                <AssetPanel data={result.holder.data} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function tabStyle(on: boolean): React.CSSProperties {
  return {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 36,
    borderRadius: 7, cursor: "pointer", font: "600 10.5px var(--font-mono-stack)", border: "none",
    background: on ? "var(--panel2)" : "transparent", color: on ? "var(--fg)" : "var(--muted)",
    boxShadow: on ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
  };
}

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={12} strokeWidth={2} /> {title}
      </div>
      {children}
    </div>
  );
}

function StaffPanel({ data }: { data: ApiStaffWithAccount }) {
  return (
    <Section icon={User} title="STAFF HOLDER">
      <div style={{ font: "600 14px var(--font-sans-stack)", color: "var(--fg)" }}>{data.name}</div>
      <div style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)", marginTop: 2 }}>
        {data.designation || "—"} · {data.department || "—"} · {data.staffId}
      </div>
      <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)", marginTop: 6 }}>
        {data.email} · {data.phone || "—"}
      </div>
      {data.account && (
        <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={12} strokeWidth={2} color={data.account.isActive ? "var(--ok)" : "var(--faint)"} />
          {data.account.role} · {data.account.isActive ? "active account" : "inactive account"}
        </div>
      )}
    </Section>
  );
}

function VisitorPanel({ data }: { data: ApiVisitorFull }) {
  const onSite = visitorOnSite(data);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Section icon={User} title="VISITOR HOLDER">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="mono" style={{ width: 46, height: 46, borderRadius: 9, background: "var(--panel3)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flex: "0 0 46px" }}>
            {data.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.pictureUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <User size={18} strokeWidth={1.8} color="var(--faint)" />
            )}
          </div>
          <div>
            <div style={{ font: "600 14px var(--font-sans-stack)", color: "var(--fg)" }}>{data.name}</div>
            <div style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{data.designation || "—"} · {data.placeOfWork || "—"}</div>
            <span className="pill mono" style={{ marginTop: 5, display: "inline-block", ...(onSite ? { color: "var(--ok)", border: "1px solid var(--ok)" } : { color: "var(--faint)", border: "1px solid var(--border2)" }) }}>
              {onSite ? "on site" : "not on site"}
            </span>
          </div>
        </div>
      </Section>

      <Section icon={CalendarClock} title={`APPOINTMENTS (${data.appointments.length})`}>
        {data.appointments.length === 0 ? (
          <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>No appointments on record.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.appointments.slice(0, 10).map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 11.5px var(--font-sans-stack)", color: "var(--fg)" }}>{a.host.name}</div>
                  <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>
                    {fmtDateTime(a.scheduledAt)} → {fmtDateTime(a.endsAt)}
                  </div>
                </div>
                <span className="pill mono" style={{ textTransform: "uppercase", color: statusTone(a.status), border: `1px solid ${statusTone(a.status)}` }}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function AssetPanel({ data }: { data: Asset }) {
  return (
    <Section icon={Car} title="ASSET HOLDER">
      <div style={{ font: "600 14px var(--font-sans-stack)", color: "var(--fg)" }}>{data.name}</div>
      <div style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)", marginTop: 2 }}>
        {data.type} {data.vehicle ? `· plate ${data.plate || "—"}` : ""}
      </div>
      <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)", marginTop: 6 }}>
        {data.tracker ? `Tracker: ${data.tracker}` : "No tracker assigned"} · protocol {data.protoActive ? "ACTIVE" : "inactive"}
      </div>
    </Section>
  );
}
