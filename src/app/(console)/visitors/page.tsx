"use client";

import { useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSessionUser } from "@/lib/auth";
import { initials, rel } from "@/lib/format";
import ImageUpload from "@/components/ImageUpload";
import {
  createVisitor,
  deleteVisitor,
  updateVisitor,
  type CreateVisitorInput,
} from "@/lib/api/visitors";
import type { Visitor } from "@/lib/types";

const COLS = "2fr 1.6fr 1.4fr 130px 160px";
const WRITE_ROLES = ["super_admin", "security_personnel", "staff_admin"];

type Modal = { kind: "create" } | { kind: "edit"; visitor: Visitor };

export default function VisitorsPage() {
  useStore((s) => s.tick);
  const visitors = useStore((s) => s.visitors);
  const search = useStore((s) => s.visitorSearch);
  const setSearch = useStore((s) => s.setVisitorSearch);
  const checkIn = useStore((s) => s.checkIn);
  const user = useSessionUser();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);

  const [modal, setModal] = useState<Modal | null>(null);

  const q = search.toLowerCase();
  const rows = visitors.filter(
    (v) => !q || v.name.toLowerCase().includes(q) || v.org.toLowerCase().includes(q)
  );

  const remove = async (v: Visitor) => {
    if (!confirm(`Remove visitor "${v.name}"? Their profile is deleted.`)) return;
    try {
      await deleteVisitor(v.id);
      await useStore.getState().refreshVisitors();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove visitor");
    }
  };

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
        <div style={{ flex: 1 }} />
        {canWrite && (
          <button onClick={() => setModal({ kind: "create" })} className="btn-accent" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} strokeWidth={2.4} /> NEW VISITOR
          </button>
        )}
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 16px" }}>
          <span>Visitor</span><span>Organisation</span><span>Contact</span><span>Status</span><span style={{ textAlign: "right" }}>Actions</span>
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
              <span style={{ display: "flex", gap: 5, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
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
                {canWrite && (
                  <>
                    <IconBtn onClick={() => setModal({ kind: "edit", visitor: v })} title="Edit"><Pencil size={12} strokeWidth={1.9} /></IconBtn>
                    <IconBtn onClick={() => remove(v)} title="Remove" tone="var(--danger)"><Trash2 size={12} strokeWidth={1.9} /></IconBtn>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {modal?.kind === "create" && (
        <VisitorForm
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await useStore.getState().refreshVisitors();
          }}
        />
      )}

      {modal?.kind === "edit" && (
        <VisitorForm
          visitor={modal.visitor}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await useStore.getState().refreshVisitors();
          }}
        />
      )}
    </div>
  );
}

// ---- create / edit form (shared) ----
function VisitorForm({ visitor, onClose, onSaved }: { visitor?: Visitor; onClose: () => void; onSaved: () => void }) {
  const editing = !!visitor;
  const [name, setName] = useState(visitor?.name ?? "");
  const [email, setEmail] = useState(visitor?.email ?? "");
  const [phone, setPhone] = useState(visitor?.phone ?? "");
  const [designation, setDesignation] = useState(visitor?.desig ?? "");
  const [placeOfWork, setPlaceOfWork] = useState(visitor?.org ?? "");
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    setError("");
    const body: CreateVisitorInput = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      designation: designation.trim() || undefined,
      placeOfWork: placeOfWork.trim() || undefined,
      ...(pictureUrl ? { pictureUrl } : {}),
    };
    try {
      if (editing) await updateVisitor(visitor!.id, body);
      else await createVisitor(body);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save visitor");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={editing ? `Edit · ${visitor!.name}` : "New visitor"} onClose={() => !busy && onClose()}>
      <Field label="NAME">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" autoFocus />
      </Field>
      <Field label="EMAIL">
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. jane@example.com" />
      </Field>
      <Field label="PHONE">
        <input className="input mono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +234 800 000 0000" />
      </Field>
      <Field label="DESIGNATION">
        <input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Contractor" />
      </Field>
      <Field label="ORGANISATION / PLACE OF WORK">
        <input className="input" value={placeOfWork} onChange={(e) => setPlaceOfWork(e.target.value)} placeholder="e.g. Acme Corp" />
      </Field>
      <ImageUpload purpose="visitor-picture" value={null} onChange={setPictureUrl} label="PROFILE PHOTO (OPTIONAL)" />
      {error && <Err>{error}</Err>}
      <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "SAVING…" : editing ? "SAVE CHANGES" : "CREATE VISITOR"}
      </button>
    </Shell>
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
