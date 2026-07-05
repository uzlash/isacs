"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { assignCard, revokeCard, type HolderType } from "@/lib/api/access";
import type { CardType } from "@/lib/types";
import type { AccessCard } from "@/lib/types";
import type { CreateCardInput } from "@/lib/api/cards";

type Props =
  | {
      mode: "create";
      onClose: () => void;
      onDone: () => void | Promise<void>;
      onCreate: (body: CreateCardInput) => Promise<unknown>;
    }
  | {
      mode: "assign";
      card: AccessCard;
      onClose: () => void;
      onDone: () => void | Promise<void>;
    };

const CARD_TYPES: CardType[] = ["staff", "visitor", "vehicle"];
const HOLDER_TYPES: HolderType[] = ["staff", "visitor", "asset"];

export default function CardModal(props: Props) {
  const nodes = useStore((s) => s.nodes);
  const staff = useStore((s) => s.staff);
  const visitors = useStore((s) => s.visitors);
  const assets = useStore((s) => s.assets);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ---- create state ----
  const [cardNumber, setCardNumber] = useState("");
  const [rfidTag, setRfid] = useState("");
  const [qrCode, setQr] = useState("");
  const [type, setType] = useState<CardType>("staff");

  // ---- assign state ----
  const [holderType, setHolderType] = useState<HolderType>("staff");
  const [holderId, setHolderId] = useState("");
  const [nodeIds, setNodeIds] = useState<string[]>([]);

  const holders =
    holderType === "staff"
      ? staff.map((s) => ({ id: s.id, name: `${s.name} · ${s.staffId}` }))
      : holderType === "visitor"
        ? visitors.map((v) => ({ id: v.id, name: v.name }))
        : assets.map((a) => ({ id: a.id, name: a.name }));

  const submitCreate = async () => {
    if (props.mode !== "create") return;
    if (!cardNumber.trim()) return setError("Card number is required.");
    setBusy(true);
    setError("");
    try {
      await props.onCreate({
        cardNumber: cardNumber.trim(),
        ...(rfidTag.trim() ? { rfidTag: rfidTag.trim() } : {}),
        ...(qrCode.trim() ? { qrCode: qrCode.trim() } : {}),
        type,
      });
      await props.onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create card");
    } finally {
      setBusy(false);
    }
  };

  const submitAssign = async () => {
    if (props.mode !== "assign") return;
    if (!holderId) return setError("Pick the holder to assign this card to.");
    if (!nodeIds.length) return setError("Select at least one access node to grant.");
    setBusy(true);
    setError("");
    try {
      await assignCard({ cardId: props.card.id, holderType, holderId, accessNodeIds: nodeIds });
      await props.onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign card");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (props.mode !== "assign") return;
    if (!confirm("Revoke this card's active assignment? It loses all node access.")) return;
    setBusy(true);
    setError("");
    try {
      await revokeCard(props.card.id);
      await props.onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No active assignment to revoke");
    } finally {
      setBusy(false);
    }
  };

  const title = props.mode === "create" ? "New access card" : `Assign card · ${props.card.num}`;

  return (
    <div onClick={() => !busy && props.onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 500, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button onClick={props.onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>
          {props.mode === "create" ? (
            <>
              <Field label="CARD NUMBER (UNIQUE)">
                <input className="input mono" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="e.g. STAFF-0042" autoFocus />
              </Field>
              <Field label="RFID TAG (OPTIONAL)">
                <input className="input mono" value={rfidTag} onChange={(e) => setRfid(e.target.value)} placeholder="e.g. 9E:44:0C:05" />
              </Field>
              <Field label="QR CODE (OPTIONAL)">
                <input className="input mono" value={qrCode} onChange={(e) => setQr(e.target.value)} placeholder="e.g. QR-VIS-7741" />
              </Field>
              <Field label="TYPE">
                <div style={{ display: "flex", gap: 7 }}>
                  {CARD_TYPES.map((t) => (
                    <Chip key={t} on={type === t} onClick={() => setType(t)}>{t}</Chip>
                  ))}
                </div>
              </Field>
              {error && <Err>{error}</Err>}
              <button onClick={submitCreate} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
                {busy ? "CREATING…" : "CREATE CARD"}
              </button>
            </>
          ) : (
            <>
              <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>
                Assign this card to a holder and grant the access nodes they may pass through. A card may hold one active assignment.
              </div>
              <Field label="HOLDER TYPE">
                <div style={{ display: "flex", gap: 7 }}>
                  {HOLDER_TYPES.map((t) => (
                    <Chip key={t} on={holderType === t} onClick={() => { setHolderType(t); setHolderId(""); }}>{t}</Chip>
                  ))}
                </div>
              </Field>
              <Field label="HOLDER">
                <select className="select" value={holderId} onChange={(e) => setHolderId(e.target.value)}>
                  <option value="">— select {holderType} —</option>
                  {holders.map((h) => (<option key={h.id} value={h.id}>{h.name}</option>))}
                </select>
                {holders.length === 0 && (
                  <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", marginTop: 5 }}>
                    No {holderType} records loaded.
                  </div>
                )}
              </Field>
              <Field label={`ACCESS NODES (${nodeIds.length})`}>
                {nodes.length === 0 ? (
                  <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)" }}>No access nodes exist yet.</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 168, overflowY: "auto", padding: 2 }}>
                    {nodes.map((n) => {
                      const on = nodeIds.includes(n.id);
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => setNodeIds((p) => (on ? p.filter((x) => x !== n.id) : [...p, n.id]))}
                          className="mono"
                          style={{ font: "600 9.5px var(--font-mono-stack)", padding: "6px 10px", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, border: `1px solid ${on ? "var(--accent)" : "var(--border2)"}`, background: on ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", color: on ? "var(--accent)" : "var(--muted)" }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? "var(--accent)" : "var(--border2)" }} />
                          {n.name} <span style={{ opacity: 0.6 }}>L{n.level}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Field>
              {error && <Err>{error}</Err>}
              <div style={{ display: "flex", gap: 9 }}>
                <button onClick={revoke} disabled={busy} className="mono" style={{ height: 42, padding: "0 16px", font: "600 10.5px var(--font-mono-stack)", letterSpacing: ".4px", borderRadius: 9, cursor: "pointer", background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)", opacity: busy ? 0.7 : 1 }}>
                  REVOKE
                </button>
                <button onClick={submitAssign} disabled={busy} className="btn-accent" style={{ flex: 1, height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
                  {busy ? "SAVING…" : "ASSIGN CARD"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mono" style={{ font: "600 9.5px var(--font-mono-stack)", padding: "7px 13px", borderRadius: 7, cursor: "pointer", textTransform: "uppercase", letterSpacing: ".3px", border: `1px solid ${on ? "var(--accent)" : "var(--border2)"}`, background: on ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent", color: on ? "var(--accent)" : "var(--muted)" }}>
      {children}
    </button>
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
