"use client";

import { useStore } from "@/lib/store";
import { ROLE_MATRIX, roleMeta } from "@/lib/format";

const USER_COLS = "1.6fr 1.4fr 1.4fr 110px 110px";

export default function UsersPage() {
  const users = useStore((s) => s.users);

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
      {/* USER ACCOUNTS */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">USER ACCOUNTS</span>
        </div>
        <div className="thead" style={{ display: "grid", gridTemplateColumns: USER_COLS, gap: 10, padding: "10px 16px" }}>
          <span>Email</span><span>Linked Staff</span><span>Role</span><span>Last Active</span><span>Status</span>
        </div>
        {users.map((u) => {
          const m = roleMeta[u.role];
          return (
            <div key={u.id} style={{ display: "grid", gridTemplateColumns: USER_COLS, gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <span className="mono" style={{ font: "500 11.5px var(--font-mono-stack)", color: "var(--fg)" }}>{u.email}</span>
              <span style={{ font: "500 12px var(--font-sans-stack)", color: "var(--muted)" }}>{u.staff}</span>
              <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", letterSpacing: ".3px", color: m.tone }}>{m.label}</span>
              <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>{u.last}</span>
              <span>
                <span
                  className="pill mono"
                  style={
                    u.active
                      ? { color: "var(--ok)", border: "1px solid var(--ok)" }
                      : { color: "var(--faint)", border: "1px solid var(--border2)" }
                  }
                >
                  {u.active ? "ACTIVE" : "DEACTIVATED"}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* ROLE PERMISSION MATRIX */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">ROLE PERMISSION MATRIX </span>
          <span className="panel-sub" style={{ fontWeight: 500 }}>· configurable by Super Admin</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr repeat(5,1fr)", minWidth: 680 }}>
            <div className="mono" style={{ padding: "11px 16px", font: "600 9px var(--font-mono-stack)", letterSpacing: ".6px", color: "var(--faint)", borderBottom: "1px solid var(--border)" }}>
              PERMISSION
            </div>
            {ROLE_MATRIX.roles.map((r) => (
              <div key={r} className="mono" style={{ padding: "11px 8px", font: "600 9px var(--font-mono-stack)", letterSpacing: ".3px", color: "var(--muted)", textAlign: "center", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                {r}
              </div>
            ))}
            {ROLE_MATRIX.rows.map((row) => (
              <RowCells key={row.name} name={row.name} vals={row.vals} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RowCells({ name, vals }: { name: string; vals: readonly number[] }) {
  return (
    <>
      <div style={{ padding: "10px 16px", font: "500 11.5px var(--font-sans-stack)", color: "var(--fg)", borderBottom: "1px solid var(--border)" }}>{name}</div>
      {vals.map((v, i) => (
        <div key={i} style={{ padding: "10px 8px", textAlign: "center", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
          {v ? (
            <span style={{ color: "var(--ok)", fontSize: 13 }}>●</span>
          ) : (
            <span style={{ color: "var(--border2)", fontSize: 13 }}>○</span>
          )}
        </div>
      ))}
    </>
  );
}
