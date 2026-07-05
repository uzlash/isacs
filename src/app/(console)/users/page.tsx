"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLE_MATRIX, roleMeta } from "@/lib/format";
import type { Role, User } from "@/lib/types";
import {
  activateUser,
  createUser,
  deactivateUser,
  getOnboardingToken,
  type OnboardingToken,
  provisionOnboarding,
  resetUserPassword,
  updateUser,
} from "@/lib/api/users";

const USER_COLS = "1.5fr 1fr 1.1fr 78px 92px 236px";
const ROLES: Role[] = ["super_admin", "security_manager", "security_personnel", "staff_admin", "auditor"];

type ModalKind =
  | { kind: "create" }
  | { kind: "edit"; user: User }
  | { kind: "reset"; user: User }
  | { kind: "postings"; user: User }
  | { kind: "onboard"; user: { id: string; email: string } };

interface FormState {
  email: string;
  password: string;
  role: Role;
  staffId: string;
  newPassword: string;
  nodeIds: string[];
}
const emptyForm: FormState = { email: "", password: "", role: "security_personnel", staffId: "", newPassword: "", nodeIds: [] };

export default function UsersPage() {
  const users = useStore((s) => s.users);
  const staff = useStore((s) => s.staff);
  const nodes = useStore((s) => s.nodes);
  const refreshUsers = useStore((s) => s.refreshUsers);
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const [modal, setModal] = useState<ModalKind | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [onb, setOnb] = useState<{
    loading: boolean;
    token: OnboardingToken | null;
    error: string;
    needsPassword: boolean;
  }>({ loading: false, token: null, error: "", needsPassword: false });
  const [onbUser, setOnbUser] = useState<{ id: string; email: string } | null>(null);
  const [onbPassword, setOnbPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const close = () => {
    setModal(null);
    setError("");
    setBusy(false);
  };

  const openCreate = () => {
    setForm({ ...emptyForm });
    setError("");
    setModal({ kind: "create" });
  };
  const openEdit = (user: User) => {
    setForm({ ...emptyForm, email: user.email, role: user.role, staffId: user.staffId ?? "" });
    setError("");
    setModal({ kind: "edit", user });
  };
  const openPostings = (user: User) => {
    setForm({ ...emptyForm, nodeIds: user.assignedNodeIds ?? [] });
    setError("");
    setModal({ kind: "postings", user });
  };
  const openReset = (user: User) => {
    setForm({ ...emptyForm });
    setError("");
    setModal({ kind: "reset", user });
  };
  // Existing user: try to fetch an already-pending onboarding token; if there
  // is none, offer to provision it by entering the user's password.
  const openOnboard = (user: { id: string; email: string }) => {
    setModal({ kind: "onboard", user });
    setOnbUser(user);
    setOnbPassword("");
    setCopied(false);
    setOnb({ loading: true, token: null, error: "", needsPassword: false });
    getOnboardingToken(user.id)
      .then((token) => setOnb({ loading: false, token, error: "", needsPassword: false }))
      .catch((e) => {
        const msg: string = e?.message || "Failed to generate token";
        setOnb({ loading: false, token: null, error: msg, needsPassword: /pending/i.test(msg) });
      });
  };

  // Provision a fresh pending secret using the user's password, then show the QR.
  const provisionWithPassword = async () => {
    if (!onbUser || onbPassword.length < 1) {
      setOnb((o) => ({ ...o, error: "Enter the user's password to start enrollment." }));
      return;
    }
    setOnb((o) => ({ ...o, loading: true, error: "" }));
    try {
      const token = await provisionOnboarding(onbUser.email, onbPassword, onbUser.id);
      setOnb({ loading: false, token, error: "", needsPassword: false });
    } catch (e) {
      setOnb({ loading: false, token: null, error: errMsg(e), needsPassword: true });
    }
  };

  const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

  const submitCreate = async () => {
    if (!form.email.trim() || form.password.length < 8) {
      setError("Email and a password of at least 8 characters are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const email = form.email.trim();
      const password = form.password;
      const created = await createUser({
        email,
        password,
        role: form.role,
        ...(form.staffId ? { staffId: form.staffId } : {}),
      });
      await refreshUsers();
      // per the onboarding flow: provision TOTP with the password we just set
      // and show the QR (server-side chain: login → mfa/setup → onboarding-token).
      const target = { id: created.id, email: created.email };
      setOnbUser(target);
      setOnbPassword(password);
      setModal({ kind: "onboard", user: target });
      setCopied(false);
      setOnb({ loading: true, token: null, error: "", needsPassword: false });
      try {
        const token = await provisionOnboarding(email, password, created.id);
        setOnb({ loading: false, token, error: "", needsPassword: false });
      } catch (e) {
        setOnb({ loading: false, token: null, error: errMsg(e), needsPassword: true });
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (modal?.kind !== "edit") return;
    setBusy(true);
    setError("");
    try {
      await updateUser(modal.user.id, {
        email: form.email.trim(),
        role: form.role,
        staffId: form.staffId ? form.staffId : null,
      });
      await refreshUsers();
      close();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const submitPostings = async () => {
    if (modal?.kind !== "postings") return;
    setBusy(true);
    setError("");
    try {
      // same PUT /users/:id endpoint, but a focused payload: only the node set.
      // array = full replace, null = clear all (security_personnel only).
      await updateUser(modal.user.id, {
        assignedNodeIds: form.nodeIds.length ? form.nodeIds : null,
      });
      await refreshUsers();
      close();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (modal?.kind !== "reset") return;
    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await resetUserPassword(modal.user.id, form.newPassword);
      close();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      if (user.active) await deactivateUser(user.id);
      else await activateUser(user.id);
      await refreshUsers();
    } catch {
      /* surfaced via a future toast; ignore for now */
    }
  };

  const setF = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }) as FormState);

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
      {/* USER ACCOUNTS */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span className="panel-title">USER ACCOUNTS</span>
          <span className="panel-sub" style={{ marginLeft: 8 }}>· {users.length}</span>
          <div style={{ flex: 1 }} />
          <button onClick={openCreate} className="btn-accent" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px", padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={13} strokeWidth={2.4} />
            NEW USER
          </button>
        </div>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: USER_COLS, gap: 10, padding: "10px 16px" }}>
          <span>Email</span><span>Linked Staff</span><span>Role</span><span>Last Active</span><span>Status</span><span>Actions</span>
        </div>
        {users.map((u) => {
          const m = roleMeta[u.role];
          return (
            <div key={u.id} style={{ display: "grid", gridTemplateColumns: USER_COLS, gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <span className="mono" style={{ font: "500 11.5px var(--font-mono-stack)", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</span>
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.staff}</span>
                {u.role === "security_personnel" && (
                  <span
                    className="mono"
                    title={u.assignedNodeIds?.map(nodeName).join(", ") || "no nodes assigned"}
                    style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".3px", color: u.assignedNodeIds?.length ? "var(--accent)" : "var(--faint)" }}
                  >
                    {u.assignedNodeIds?.length ? `▚ ${u.assignedNodeIds.length} NODE${u.assignedNodeIds.length > 1 ? "S" : ""}` : "▚ NO NODES"}
                  </span>
                )}
              </span>
              <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".3px", color: m.tone }}>{m.label}</span>
              <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>{u.last}</span>
              <span>
                <span className="pill mono" style={u.active ? { color: "var(--ok)", border: "1px solid var(--ok)" } : { color: "var(--faint)", border: "1px solid var(--border2)" }}>
                  {u.active ? "ACTIVE" : "DEACTIVATED"}
                </span>
              </span>
              <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <RowBtn onClick={() => openOnboard({ id: u.id, email: u.email })} tone="var(--accent)">TOTP QR</RowBtn>
                {u.role === "security_personnel" && (
                  <RowBtn onClick={() => openPostings(u)} tone="var(--accent)">Postings</RowBtn>
                )}
                <RowBtn onClick={() => openEdit(u)}>Edit</RowBtn>
                <RowBtn onClick={() => openReset(u)}>Reset PW</RowBtn>
                <RowBtn onClick={() => toggleActive(u)} tone={u.active ? "var(--danger)" : "var(--ok)"}>
                  {u.active ? "Deactivate" : "Activate"}
                </RowBtn>
              </span>
            </div>
          );
        })}
        {users.length === 0 && (
          <div style={{ padding: 26, textAlign: "center", color: "var(--faint)", font: "500 12px var(--font-sans-stack)" }}>
            No user accounts yet — create the first one.
          </div>
        )}
      </div>

      {/* ROLE PERMISSION MATRIX */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">ROLE PERMISSION MATRIX </span>
          <span className="panel-sub" style={{ fontWeight: 500 }}>· configurable by Super Admin</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr repeat(5,1fr)", minWidth: 680 }}>
            <div className="mono" style={{ padding: "11px 16px", font: "600 9px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)", borderBottom: "1px solid var(--border)" }}>PERMISSION</div>
            {ROLE_MATRIX.roles.map((r) => (
              <div key={r} className="mono" style={{ padding: "11px 8px", font: "600 9px var(--font-mono-stack)", letterSpacing: ".3px", color: "var(--muted)", textAlign: "center", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>{r}</div>
            ))}
            {ROLE_MATRIX.rows.map((row) => (
              <RowCells key={row.name} name={row.name} vals={row.vals} />
            ))}
          </div>
        </div>
      </div>

      {/* ===================== MODALS ===================== */}
      {modal && (
        <div onClick={() => !busy && close()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: modal.kind === "onboard" || modal.kind === "postings" ? 480 : 440, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 13, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
              <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>
                {modal.kind === "create" && "Create user account"}
                {modal.kind === "edit" && "Edit user"}
                {modal.kind === "reset" && "Reset password"}
                {modal.kind === "postings" && "Node postings"}
                {modal.kind === "onboard" && "Authenticator onboarding"}
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={close} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ padding: 18 }}>
              {/* CREATE / EDIT share fields */}
              {(modal.kind === "create" || modal.kind === "edit") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  <Field label="EMAIL">
                    <input className="input" type="email" value={form.email} onChange={(e) => setF("email", e.target.value)} placeholder="operator@isacs.mil" autoFocus />
                  </Field>
                  {modal.kind === "create" && (
                    <Field label="TEMPORARY PASSWORD (MIN 8)">
                      <input className="input mono" type="text" value={form.password} onChange={(e) => setF("password", e.target.value)} placeholder="set an initial password" />
                    </Field>
                  )}
                  <Field label="ROLE">
                    <select className="select" value={form.role} onChange={(e) => setF("role", e.target.value)}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{roleMeta[r].label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="LINKED STAFF (OPTIONAL)">
                    <select className="select" value={form.staffId} onChange={(e) => setF("staffId", e.target.value)}>
                      <option value="">— none —</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} · {s.staffId}</option>
                      ))}
                    </select>
                  </Field>

                  {modal.kind === "create" && form.role === "security_personnel" && (
                    <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", lineHeight: 1.5, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px" }}>
                      After creating this officer, use <span style={{ color: "var(--accent)" }}>Postings</span> to assign the checkpoints they cover.
                    </div>
                  )}

                  {error && <ErrLine>{error}</ErrLine>}
                  <button onClick={modal.kind === "create" ? submitCreate : submitEdit} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", marginTop: 2, opacity: busy ? 0.7 : 1 }}>
                    {busy ? "SAVING…" : modal.kind === "create" ? "CREATE & GENERATE QR" : "SAVE CHANGES"}
                  </button>
                </div>
              )}

              {/* NODE POSTINGS — same PUT /users/:id, focused on the node set */}
              {modal.kind === "postings" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.55 }}>
                    Checkpoints <span style={{ color: "var(--fg)" }}>{modal.user.staff !== "—" ? modal.user.staff : modal.user.email}</span> is posted to. Access inherits down the node tree.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="field-label">SELECTED · {form.nodeIds.length}</span>
                    <div style={{ flex: 1 }} />
                    {form.nodeIds.length > 0 && (
                      <button type="button" onClick={() => setForm((f) => ({ ...f, nodeIds: [] }))} className="mono" style={{ font: "600 9px var(--font-mono-stack)", color: "var(--danger)", background: "transparent", border: "1px solid var(--border2)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>
                        CLEAR ALL
                      </button>
                    )}
                  </div>
                  {nodes.length === 0 ? (
                    <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)" }}>No access nodes exist yet — create nodes in Access Control first.</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 260, overflowY: "auto", padding: 2 }}>
                      {nodes.map((n) => {
                        const on = form.nodeIds.includes(n.id);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                nodeIds: on ? f.nodeIds.filter((x) => x !== n.id) : [...f.nodeIds, n.id],
                              }))
                            }
                            className="mono"
                            style={{
                              font: "600 9.5px var(--font-mono-stack)",
                              padding: "6px 10px",
                              borderRadius: 7,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              border: `1px solid ${on ? "var(--accent)" : "var(--border2)"}`,
                              background: on ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "transparent",
                              color: on ? "var(--accent)" : "var(--muted)",
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? "var(--accent)" : "var(--border2)" }} />
                            {n.name} <span style={{ opacity: 0.6 }}>L{n.level}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {error && <ErrLine>{error}</ErrLine>}
                  <button onClick={submitPostings} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
                    {busy ? "SAVING…" : "SAVE POSTINGS"}
                  </button>
                </div>
              )}

              {/* RESET PASSWORD */}
              {modal.kind === "reset" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>
                    Resetting the password for <span style={{ color: "var(--fg)" }}>{modal.user.email}</span> invalidates all their active sessions.
                  </div>
                  <Field label="NEW PASSWORD (MIN 8)">
                    <input className="input mono" type="text" value={form.newPassword} onChange={(e) => setF("newPassword", e.target.value)} placeholder="new password" autoFocus />
                  </Field>
                  {error && <ErrLine>{error}</ErrLine>}
                  <button onClick={submitReset} disabled={busy} className="btn-accent" style={{ width: "100%", height: 42, font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: busy ? 0.7 : 1 }}>
                    {busy ? "RESETTING…" : "RESET PASSWORD"}
                  </button>
                </div>
              )}

              {/* ONBOARDING TOKEN QR */}
              {modal.kind === "onboard" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                  <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5, textAlign: "center", alignSelf: "stretch" }}>
                    Scan with the <span style={{ color: "var(--fg)" }}>ISACS Authenticator</span> app to enroll TOTP for{" "}
                    <span style={{ color: "var(--accent)" }}>{modal.user.email}</span>.
                  </div>

                  {onb.loading && (
                    <div className="mono" style={{ padding: "40px 0", color: "var(--faint)", font: "500 11px var(--font-mono-stack)" }}>Generating token…</div>
                  )}

                  {!onb.loading && onb.token && (
                    <>
                      <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
                        <QRCodeSVG value={JSON.stringify(onb.token)} size={220} level="M" />
                      </div>
                      <div style={{ alignSelf: "stretch" }}>
                        <div className="mono" style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)", marginBottom: 5 }}>ENCRYPTED ONBOARDING TOKEN</div>
                        <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", wordBreak: "break-all", maxHeight: 90, overflowY: "auto" }}>
                          {JSON.stringify(onb.token)}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(JSON.stringify(onb.token));
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          }}
                          className="btn"
                          style={{ marginTop: 9, width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, font: "600 10px var(--font-mono-stack)", letterSpacing: ".5px" }}
                        >
                          <Copy size={13} strokeWidth={1.8} />
                          {copied ? "COPIED" : "COPY TOKEN"}
                        </button>
                      </div>
                      <div className="mono" style={{ font: "500 9px var(--font-mono-stack)", color: "var(--faint)", textAlign: "center", lineHeight: 1.5 }}>
                        AES-256-GCM encrypted — only the ISACS Authenticator can decrypt it. Single-use.
                      </div>
                    </>
                  )}

                  {/* No pending secret → provision one with the user's password */}
                  {!onb.loading && !onb.token && onb.needsPassword && (
                    <div style={{ alignSelf: "stretch" }}>
                      <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.55, marginBottom: 12 }}>
                        This user has no authenticator enrolled yet. Enter their password to start enrollment and generate the onboarding QR.
                      </div>
                      <Field label="USER'S PASSWORD">
                        <input
                          className="input mono"
                          type="password"
                          value={onbPassword}
                          onChange={(e) => setOnbPassword(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && provisionWithPassword()}
                          placeholder="the password set for this account"
                          autoFocus
                        />
                      </Field>
                      {onb.error && !/pending/i.test(onb.error) && <div style={{ marginTop: 10 }}><ErrLine>{onb.error}</ErrLine></div>}
                      <button onClick={provisionWithPassword} className="btn-accent" style={{ marginTop: 12, width: "100%", height: 40, font: "600 11px var(--font-mono-stack)", letterSpacing: ".5px" }}>
                        START ENROLLMENT & GENERATE QR
                      </button>
                    </div>
                  )}

                  {/* Hard error (not the missing-pending case) */}
                  {!onb.loading && !onb.token && !onb.needsPassword && onb.error && (
                    <div style={{ alignSelf: "stretch" }}>
                      <ErrLine>{onb.error}</ErrLine>
                      <button onClick={() => openOnboard(modal.user)} className="btn" style={{ marginTop: 12, width: "100%", height: 38, font: "600 10.5px var(--font-mono-stack)", letterSpacing: ".5px" }}>
                        RETRY
                      </button>
                    </div>
                  )}

                  <button onClick={close} className="btn" style={{ width: "100%", height: 38, font: "600 10.5px var(--font-mono-stack)", letterSpacing: ".5px" }}>DONE</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: string }) {
  return (
    <button
      onClick={onClick}
      className="mono"
      style={{
        font: "600 9px var(--font-mono-stack)",
        letterSpacing: ".3px",
        padding: "4px 7px",
        borderRadius: 5,
        cursor: "pointer",
        background: "transparent",
        border: `1px solid ${tone ? tone : "var(--border2)"}`,
        color: tone ? tone : "var(--muted)",
        whiteSpace: "nowrap",
      }}
    >
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

function ErrLine({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>
      ⚠ {children}
    </div>
  );
}

function RowCells({ name, vals }: { name: string; vals: readonly number[] }) {
  return (
    <>
      <div style={{ padding: "10px 16px", font: "500 11.5px var(--font-sans-stack)", color: "var(--fg)", borderBottom: "1px solid var(--border)" }}>{name}</div>
      {vals.map((v, i) => (
        <div key={i} style={{ padding: "10px 8px", textAlign: "center", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
          {v ? <span style={{ color: "var(--ok)", fontSize: 13 }}>●</span> : <span style={{ color: "var(--border2)", fontSize: 13 }}>○</span>}
        </div>
      ))}
    </>
  );
}
