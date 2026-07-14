"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, ScanLine, User } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Pagination } from "@/lib/api";
import { getVisitor, type ApiVisitorFull } from "@/lib/api/visitors";
import { listAppointments, type ApiAppointmentDetail } from "@/lib/api/appointments";
import { getAccessLogs, type AccessLogEntry } from "@/lib/api/access";
import { statusTone, initials, lockdownReasonTag } from "@/lib/format";
import { isVisitorOnSite, type Visitor } from "@/lib/types";

type Tab = "profile" | "history" | "scans";
const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: "profile", label: "PROFILE", icon: User },
  { key: "history", label: "VISIT HISTORY", icon: CalendarClock },
  { key: "scans", label: "ACCESS SCANS", icon: ScanLine },
];
const PAGE_SIZE = 10;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function VisitorDetailModal({ visitor, onClose }: { visitor: Visitor; onClose: () => void }) {
  const nodes = useStore((s) => s.nodes);
  const [tab, setTab] = useState<Tab>("profile");

  // ---- profile ----
  const [full, setFull] = useState<ApiVisitorFull | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getVisitor(visitor.id)
      .then((v) => { if (!cancelled) setFull(v); })
      .catch((e) => { if (!cancelled) setProfileError(e instanceof Error ? e.message : "Failed to load visitor profile"); })
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [visitor.id]);

  // ---- visit history ----
  const [history, setHistory] = useState<{ items: ApiAppointmentDetail[]; pagination?: Pagination }>({ items: [] });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (tab !== "history") return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError("");
    listAppointments({ visitorId: visitor.id, page: historyPage, limit: PAGE_SIZE })
      .then((r) => { if (!cancelled) setHistory(r); })
      .catch((e) => { if (!cancelled) setHistoryError(e instanceof Error ? e.message : "Failed to load visit history"); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [tab, historyPage, visitor.id]);

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
    getAccessLogs({ holderType: "visitor", holderId: visitor.id, page: scansPage, limit: PAGE_SIZE })
      .then((r) => { if (!cancelled) setScans(r); })
      .catch((e) => { if (!cancelled) setScansError(e instanceof Error ? e.message : "Failed to load access history"); })
      .finally(() => { if (!cancelled) setScansLoading(false); });
    return () => { cancelled = true; };
  }, [tab, scansPage, visitor.id]);

  const activeAssignment = full?.cardAssignments.find((a) => a.revokedAt == null) ?? null;
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const onSite = isVisitorOnSite(visitor);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: "100%", background: "var(--panel)", border: "1px solid var(--border2)", borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,.55)", overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
          <span style={{ font: "600 13px var(--font-sans-stack)", color: "var(--fg)" }}>{visitor.name}</span>
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
                  {visitor.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={visitor.pictureUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    initials(visitor.name)
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 15px var(--font-sans-stack)", color: "var(--fg)" }}>{visitor.name}</div>
                  <div style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)", marginTop: 2 }}>{visitor.desig || "—"} · {visitor.org || "—"}</div>
                  <span className="pill mono" style={{ marginTop: 8, display: "inline-block", ...(onSite ? { color: "var(--ok)", border: "1px solid var(--ok)" } : { color: "var(--faint)", border: "1px solid var(--border2)" }) }}>
                    {onSite ? "on site" : "not on site"}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
                <InfoField label="EMAIL" value={visitor.email || "—"} />
                <InfoField label="PHONE" value={visitor.phone || "—"} />
              </div>

              {profileLoading ? (
                <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>Loading access details…</div>
              ) : profileError ? (
                <ErrBox>{profileError}</ErrBox>
              ) : (
                <div>
                  <div className="field-label" style={{ marginBottom: 7 }}>ACTIVE CARD & ACCESS</div>
                  {activeAssignment ? (
                    <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.7, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 13px" }}>
                      CARD: {activeAssignment.card.cardNumber} ({activeAssignment.card.type})<br />
                      NODES: {activeAssignment.accessNodeIds.map(nodeName).join(", ") || "—"}<br />
                      ASSIGNED: {fmtDateTime(activeAssignment.assignedAt)}
                    </div>
                  ) : (
                    <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--faint)" }}>No active card assignment.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <PaginatedTable
              loading={historyLoading}
              error={historyError}
              empty="No appointments on record."
              isEmpty={history.items.length === 0}
              pagination={history.pagination}
              page={historyPage}
              onPage={setHistoryPage}
            >
              {history.items.map((a) => (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 90px", gap: 10, padding: "9px 2px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                  <div>
                    <div style={{ font: "600 12px var(--font-sans-stack)", color: "var(--fg)" }}>{a.host?.name ?? "—"}</div>
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
