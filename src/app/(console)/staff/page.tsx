"use client";

import { useState } from "react";
import { Eye, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSessionUser } from "@/lib/auth";
import { initials } from "@/lib/format";
import ImageUpload from "@/components/ImageUpload";
import StaffDetailModal from "@/components/StaffDetailModal";
import {
  bulkStaff,
  createStaff,
  deleteStaff,
  updateStaff,
  type CreateStaffInput,
} from "@/lib/api/staff";
import type { Staff } from "@/lib/types";

const COLS = "2fr 1fr 1.4fr 1.4fr 1.4fr 110px";
const WRITE_ROLES = ["super_admin", "security_manager", "staff_admin"];

type Modal =
  | { kind: "create" }
  | { kind: "edit"; staff: Staff }
  | { kind: "detail"; staff: Staff }
  | { kind: "bulk" };

export default function StaffPage() {
  const staff = useStore((s) => s.staff);
  const user = useSessionUser();
  const canWrite = !!user && WRITE_ROLES.includes(user.role);

  const [modal, setModal] = useState<Modal | null>(null);

  const refresh = () => useStore.getState().refreshStaff();

  const remove = async (s: Staff) => {
    if (!confirm(`Remove staff "${s.name}" (${s.staffId})? This cannot be undone.`)) return;
    try {
      await deleteStaff(s.id);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove staff");
    }
  };

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Users size={16} strokeWidth={1.9} color="var(--accent)" />
          <span className="panel-title">STAFF REGISTRY</span>
          <span className="panel-sub">· {staff.length} on record</span>
          <div style={{ flex: 1 }} />
          {canWrite && (
            <>
              <button onClick={() => setModal({ kind: "bulk" })} className="btn" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <Upload size={13} strokeWidth={2.2} /> BULK IMPORT
              </button>
              <button onClick={() => setModal({ kind: "create" })} className="btn-accent" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={13} strokeWidth={2.4} /> NEW STAFF
              </button>
            </>
          )}
        </div>

        <div className="thead" style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 16px" }}>
          <span>Name</span><span>Staff ID</span><span>Department</span><span>Designation</span><span>Account</span><span style={{ textAlign: "right" }}>Actions</span>
        </div>

        {staff.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>No staff on record yet.</div>
        ) : (
          staff.map((s) => (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="mono" style={{ width: 30, height: 30, borderRadius: 7, background: "var(--panel3)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 10px var(--font-mono-stack)", color: "var(--accent)", overflow: "hidden" }}>
                  {s.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.pictureUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    initials(s.name)
                  )}
                </div>
                <span style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>{s.name}</span>
              </div>
              <span className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)" }}>{s.staffId}</span>
              <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{s.dept}</span>
              <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{s.desig}</span>
              <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{s.email}</span>
              <span style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <IconBtn onClick={() => setModal({ kind: "detail", staff: s })} title="View details"><Eye size={12} strokeWidth={1.9} /></IconBtn>
                {canWrite && (
                  <>
                    <IconBtn onClick={() => setModal({ kind: "edit", staff: s })} title="Edit"><Pencil size={12} strokeWidth={1.9} /></IconBtn>
                    <IconBtn onClick={() => remove(s)} title="Remove" tone="var(--danger)"><Trash2 size={12} strokeWidth={1.9} /></IconBtn>
                  </>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {(modal?.kind === "create" || modal?.kind === "edit") && (
        <StaffForm
          staff={modal.kind === "edit" ? modal.staff : undefined}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await refresh();
          }}
        />
      )}

      {modal?.kind === "bulk" && (
        <BulkImport
          onClose={() => setModal(null)}
          onDone={() => refresh()}
        />
      )}

      {modal?.kind === "detail" && (
        <StaffDetailModal staff={modal.staff} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ---- create / edit (shared form) ----
function StaffForm({ staff, onClose, onSaved }: { staff?: Staff; onClose: () => void; onSaved: () => void }) {
  const editing = !!staff;
  const [staffId, setStaffId] = useState(staff?.staffId ?? "");
  const [name, setName] = useState(staff?.name ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [designation, setDesignation] = useState(staff?.desig ?? "");
  const [department, setDepartment] = useState(staff?.dept ?? "");
  const [pictureUrl, setPictureUrl] = useState<string | null>(staff?.pictureUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!editing && !staffId.trim()) return setError("Staff ID is required.");
    if (!name.trim() || !email.trim()) return setError("Name and email are required.");
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await updateStaff(staff!.id, {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          designation: designation.trim(),
          department: department.trim(),
          ...(pictureUrl ? { pictureUrl } : {}),
        });
      } else {
        await createStaff({
          staffId: staffId.trim(),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          designation: designation.trim(),
          department: department.trim(),
          ...(pictureUrl ? { pictureUrl } : {}),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save staff");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={editing ? `Edit · ${staff!.staffId}` : "New staff"} onClose={() => !busy && onClose()}>
      {!editing && (
        <Field label="STAFF ID (UNIQUE)">
          <input className="input mono" value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="e.g. STF-0042" autoFocus />
        </Field>
      )}
      <Field label="FULL NAME">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amina Bello" autoFocus={editing} />
      </Field>
      <Field label="EMAIL">
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. amina@facility.gov" />
      </Field>
      <Field label="PHONE">
        <input className="input mono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +234 800 000 0000" />
      </Field>
      <Field label="DESIGNATION">
        <input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Duty Officer" />
      </Field>
      <Field label="DEPARTMENT">
        <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Operations" />
      </Field>
      <ImageUpload purpose="staff-picture" value={staff?.pictureUrl ?? null} onChange={setPictureUrl} label="PROFILE PHOTO (OPTIONAL)" />
      {error && <Err>{error}</Err>}
      <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "SAVING…" : editing ? "SAVE CHANGES" : "CREATE STAFF"}
      </button>
    </Shell>
  );
}

// ---- bulk import (JSON array paste) ----
function BulkImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ total: number; created: number; updated: number } | null>(null);

  const submit = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return setError("Invalid JSON — paste a JSON array of staff objects.");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return setError("Expected a non-empty JSON array of staff objects.");
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await bulkStaff(parsed as CreateStaffInput[]);
      setResult(res);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import staff");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Bulk import staff" onClose={() => !busy && onClose()}>
      <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)", lineHeight: 1.55 }}>
        Paste a JSON array. Each object accepts:{" "}
        <span style={{ color: "var(--muted)" }}>{"{ staffId, name, email, phone?, designation?, department? }"}</span>
      </div>
      <textarea
        className="input mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'[\n  { "staffId": "STF-0042", "name": "Amina Bello", "email": "amina@facility.gov" }\n]'}
        spellCheck={false}
        style={{ minHeight: 180, resize: "vertical", font: "500 10.5px var(--font-mono-stack)", lineHeight: 1.5 }}
      />
      {result && (
        <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--ok)", background: "color-mix(in srgb, var(--ok) 10%, var(--panel))", border: "1px solid var(--ok)", borderRadius: 8, padding: "10px 12px", lineHeight: 1.5 }}>
          ✓ {result.total} processed · {result.created} created · {result.updated} updated
        </div>
      )}
      {error && <Err>{error}</Err>}
      <button onClick={submit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
        {busy ? "IMPORTING…" : result ? "IMPORT AGAIN" : "IMPORT"}
      </button>
    </Shell>
  );
}

// ---- shared bits (mirrors acms page) ----
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
