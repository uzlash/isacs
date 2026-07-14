"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, ScanLine, ShieldCheck, User } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Pagination } from "@/lib/api";
import { getStaff, type ApiStaffWithAccount } from "@/lib/api/staff";
import { listAppointments, type ApiAppointmentDetail } from "@/lib/api/appointments";
import { getAccessLogs, type AccessLogEntry } from "@/lib/api/access";
import { statusTone, initials, lockdownReasonTag } from "@/lib/format";
import type { Staff } from "@/lib/types";

type Tab = "profile" | "hosted" | "scans";
const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "profile", label: "PROFILE", icon: User },
  { key: "hosted", label: "APPOINTMENTS HOSTED", icon: CalendarClock },
  { key: "scans", label: "ACCESS SCANS", icon: ScanLine },
];
const PAGE_SIZE = 10;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function StaffDetailModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const nodes = useStore((s) => s.nodes);
  const cards = useStore((s) => s.cards);
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const [tab, setTab] = useState<Tab>("profile");

  // ---- profile ----
  const [full, setFull] = useState<ApiStaffWithAccount | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStaff(staff.id)
      .then((s) => { if (!cancelled) setFull(s); })
      .catch((e) => { if (!cancelled) setProfileError(e instanceof Error ? e.message : "Failed to load staff profile"); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [staff.id]);

  // ---- appointments hosted ----
  const [hosted, setHosted] = useState<{ items: ApiAppointmentDetail[]; pagination?: Pagination }>({ items: [] });
  const [hostedPage, setHostedPage] = useState(1);
  const [hostedLoading, setHostedLoading] = useState(true);
  const [hostedError, setHostedError] = useState("");

  useEffect(() => {
    if (tab !== "hosted") return;
    let cancelled = false;
    setHostedLoading(true);
    setHostedError("");
    listAppointments({ hostStaffId: staff.id, page: hostedPage, limit: PAGE_SIZE })
      .then((r) => { if (!cancelled) setHosted(r); })
      .catch((e) => { if (!cancelled) setHostedError(e instanceof Error ? e.message : "Failed to load hosted appointments"); })
      .finally(() => { if (!cancelled) setHostedLoading(false); });
    return () => { cancelled = true; };
  }, [tab, hostedPage, staff.id]);

  // ---- access scans ----
  const [scans, setScans] = useState<{ items: AccessLogEntry[]; pagination?: Pagination }>({ items: [] });
  const [scansPage, setScansPage] = useState(1);
  const [scansLoading, setScansLoading] = useState(true);
  const [scansError, setScansError] = useState("");

  useEffect(() => {
    if (tab !== "scans") return;
    let cancelled = false;
    setScansLoading(true);
    setScansError("");
    getAccessLogs({ holderType: "staff", holderId: staff.id, page: scansPage, limit: PAGE_SIZE })
      .then((r) => { if (!cancelled) setScans(r); })
      .catch((e) => { if (!cancelled) setScansError(e instanceof Error ? e.message : "Failed to load access history"); })
      .finally(() => { if (!cancelled) setScansLoading(false); });
    return () => { cancelled = true; };
  }, [tab, scansPage, staff.id]);

  const activeCard = cards.find((c) => c.holderType === "staff" && c.holderId === staff.id) ?? null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>{staff.name}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--faint)", fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 7, margin: "14px 18px 0", padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10 }}>
          {TABS.map(({ key, label, icon: Icon }) => {
            const on = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 34,
                  borderRadius: 7, cursor: "pointer", font: "600 10.5px var(--font-mono-stack)", border: "none",
                  background: on ? "var(--panel2)" : "transparent", color: on ? "var(--fg)" : "var(--muted)",
                  boxShadow: on ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                }}
              >
                <Icon size={13} strokeWidth={1.9} /> {label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 18, overflowY: "auto" }}>
          {tab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div className="mono" style={{ width: 72, height: 72, borderRadius: 12, background: "var(--panel3)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 18px var(--font-mono-stack)", color: "var(--muted)", overflow: "hidden", flex: "0 0 72px" }}>
                  {staff.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={staff.pictureUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    initials(staff.name)
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 15px var(--font-sans-stack)", color: "var(--fg)" }}>{staff.name}</div>
                  <div style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)", marginTop: 2 }}>{staff.desig || "—"} · {staff.dept || "—"} · {staff.staffId}</div>
                  {profileLoading ? null : full?.account && (
                    <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <ShieldCheck size={12} strokeWidth={2} color={full.account.isActive ? "var(--ok)" : "var(--faint)"} />
                      {full.account.role} · {full.account.isActive ? "active account" : "inactive account"}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <InfoField label="EMAIL" value={staff.email || "—"} />
                <InfoField label="PHONE" value={staff.phone || "—"} />
              </div>

              {profileError && <ErrBox>{profileError}</ErrBox>}

              <div>
                <div className="field-label" style={{ marginBottom: 7 }}>ACTIVE CARD & ACCESS</div>
                {activeCard ? (
                  <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.7, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 13px" }}>
                    CARD: {activeCard.num} ({activeCard.type})<br />
                    NODES: {activeCard.nodes.map(nodeName).join(", ") || "—"}
                  </div>
                ) : (
                  <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>No active card assignment.</div>
                )}
              </div>
            </div>
          )}

          {tab === "hosted" && (
            <PaginatedTable
              loading={hostedLoading}
              error={hostedError}
              empty="No hosted appointments on record."
              isEmpty={hosted.items.length === 0}
              pagination={hosted.pagination}
              page={hostedPage}
              onPage={setHostedPage}
            >
              {hosted.items.map((a) => (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 90px", gap: 10, padding: "9px 2px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                  <div>
                    <div style={{ font: "600 12px var(--font-sans-stack)", color: "var(--fg)" }}>{a.visitor?.name ?? "—"}</div>
                    <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{a.purpose || "—"}</div>
                  </div>
                  <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)" }}>
                    {fmtDateTime(a.scheduledAt)} → {fmtDateTime(a.endsAt)}
                  </div>
                  <span className="pill mono" style={{ textTransform: "uppercase", color: statusTone(a.status), border: `1px solid ${statusTone(a.status)}`, justifySelf: "start" }}>
                    {a.status}
                  </span>
                </div>
              ))}
            </PaginatedTable>
          )}

          {tab === "scans" && (
            <PaginatedTable
              loading={scansLoading}
              error={scansError}
              empty="No access scans on record."
              isEmpty={scans.items.length === 0}
              pagination={scans.pagination}
              page={scansPage}
              onPage={setScansPage}
            >
              {scans.items.map((s) => {
                const lt = lockdownReasonTag(s.reason);
                return (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 90px", gap: 10, padding: "9px 2px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                    <span className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)" }}>{fmtDateTime(s.createdAt)}</span>
                    <div>
                      <div style={{ font: "600 12px var(--font-sans-stack)", color: "var(--fg)" }}>{s.node?.name ?? nodeName(s.nodeId)}</div>
                      <div className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>
                        {s.card?.cardNumber ?? "—"}{s.reason && (lt || !s.granted) ? ` · ${s.reason}` : ""}
                      </div>
                    </div>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span className="pill mono" style={s.granted ? { color: "var(--ok)", border: "1px solid var(--ok)" } : { color: "var(--danger)", border: "1px solid var(--danger)" }}>
                        {s.granted ? "granted" : "denied"}
                      </span>
                      {lt === "override" && <span className="pill mono" style={{ color: "var(--warn)", border: "1px solid var(--warn)" }}>override</span>}
                    </span>
                  </div>
                );
              })}
            </PaginatedTable>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ font: "500 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>{value}</div>
    </div>
  );
}

function ErrBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" style={{ font: "500 11px var(--font-sans-stack)", color: "var(--danger)", background: "var(--panel2)", border: "1px solid var(--danger)", borderRadius: 7, padding: "9px 11px" }}>⚠ {children}</div>
  );
}

function PaginatedTable({
  loading, error, empty, isEmpty, pagination, page, onPage, children,
}: {
  loading: boolean;
  error: string;
  empty: string;
  isEmpty: boolean;
  pagination?: Pagination;
  page: number;
  onPage: (p: number) => void;
  children: React.ReactNode;
}) {
  if (loading) return <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>Loading…</div>;
  if (error) return <ErrBox>{error}</ErrBox>;
  return (
    <div>
      {isEmpty ? (
        <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>{empty}</div>
      ) : (
        <div>{children}</div>
      )}
      {pagination && pagination.pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 }}>
          <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="mono" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, cursor: page <= 1 ? "default" : "pointer", border: "1px solid var(--border2)", background: "transparent", color: "var(--muted)", opacity: page <= 1 ? 0.4 : 1 }}>
            <ChevronLeft size={13} strokeWidth={2} />
          </button>
          <span className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>Page {pagination.page} of {pagination.pages}</span>
          <button onClick={() => onPage(page + 1)} disabled={page >= pagination.pages} className="mono" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, cursor: page >= pagination.pages ? "default" : "pointer", border: "1px solid var(--border2)", background: "transparent", color: "var(--muted)", opacity: page >= pagination.pages ? 0.4 : 1 }}>
            <ChevronRight size={13} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
