"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getVisitor, type ApiVisitorFull } from "@/lib/api/visitors";
import { createCard } from "@/lib/api/cards";
import { assignCard } from "@/lib/api/access";
import type { Visitor } from "@/lib/types";

// Picks the appointment whose requested nodes should drive this check-in:
// the soonest scheduled/active one (cancelled/postponed/completed don't count).
function relevantAppointment(full: ApiVisitorFull) {
  return full.appointments
    .filter((a) => a.status === "scheduled" || a.status === "active")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0] ?? null;
}

export default function CheckInModal({ visitor, onClose, onDone }: { visitor: Visitor; onClose: () => void; onDone: () => void | Promise<void> }) {
  const nodes = useStore((s) => s.nodes);
  const checkIn = useStore((s) => s.checkIn);
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [full, setFull] = useState<ApiVisitorFull | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cardNumber, setCardNumber] = useState(() => `VIS-${Date.now().toString().slice(-6)}`);
  const [rfidTag, setRfidTag] = useState("");

  useEffect(() => {
    let cancelled = false;
    getVisitor(visitor.id)
      .then((v) => { if (!cancelled) setFull(v); })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load visitor"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visitor.id]);

  const activeAssignment = full?.cardAssignments.find((a) => a.revokedAt == null) ?? null;
  const appt = full ? relevantAppointment(full) : null;
  const requestedNodeIds = appt?.requestedAccessNodeIds ?? [];
  const needsCard = !activeAssignment && requestedNodeIds.length > 0;

  const submit = async () => {
    if (needsCard && !cardNumber.trim()) return setError("A card number is required.");
    setBusy(true);
    setError("");
    try {
      if (needsCard) {
        const card = await createCard({
          cardNumber: cardNumber.trim(),
          ...(rfidTag.trim() ? { rfidTag: rfidTag.trim() } : {}),
          type: "visitor",
        });
        await assignCard({ cardId: card.id, holderType: "visitor", holderId: visitor.id, accessNodeIds: requestedNodeIds });
      }
      checkIn(visitor.id);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check in");
    } finally {
      setBusy(false);
    }
  };

  const checkInWithoutCard = async () => {
    setBusy(true);
    setError("");
    try {
      checkIn(visitor.id);
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={() => !busy && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>Check In · {visitor.name}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 13 }}>
          {loading ? (
            <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>Loading visitor…</div>
          ) : loadError ? (
            <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {loadError}</div>
          ) : activeAssignment ? (
            <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.7, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 13px" }}>
              Already holds an active card: {activeAssignment.card.cardNumber}<br />
              NODES: {activeAssignment.accessNodeIds.map(nodeName).join(", ") || "—"}
            </div>
          ) : requestedNodeIds.length > 0 ? (
            <>
              <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>
                This visit requests access to: <span style={{ color: "var(--fg)" }}>{requestedNodeIds.map(nodeName).join(", ")}</span>. Issue the card now to grant it.
              </div>
              <Field label="CARD NUMBER (UNIQUE)">
                <input className="input mono" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} autoFocus />
              </Field>
              <Field label="RFID TAG (OPTIONAL)">
                <input className="input mono" value={rfidTag} onChange={(e) => setRfidTag(e.target.value)} placeholder="e.g. 9E:44:0C:05" />
              </Field>
            </>
          ) : (
            <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>
              No access nodes were requested for this visit — checking in without a card.
            </div>
          )}

          {error && (
            <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {error}</div>
          )}

          <button onClick={submit} disabled={busy || loading} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy || loading ? 0.7 : 1 }}>
            {busy ? "WORKING…" : needsCard ? "ISSUE CARD & CHECK IN" : "CHECK IN"}
          </button>
          {loadError && (
            <button onClick={checkInWithoutCard} disabled={busy} className="mono" style={{ height: 34, font: "600 10px var(--font-mono-stack)", letterSpacing: ".4px", borderRadius: 7, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--muted)" }}>
              CHECK IN WITHOUT CARD
            </button>
          )}
        </div>
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
