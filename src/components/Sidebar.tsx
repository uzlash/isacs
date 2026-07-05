"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV, viewIdForPath } from "./nav";
import { openIncidentCount, useStore } from "@/lib/store";
import { doLogout, useSessionUser } from "@/lib/auth";
import { roleMeta } from "@/lib/format";
import type { Role } from "@/lib/types";

export default function Sidebar() {
  const pathname = usePathname();
  const activeView = viewIdForPath(pathname);
  const openCount = useStore((s) => openIncidentCount(s.incidents));
  const user = useSessionUser();
  const email = user?.email ?? "";
  const initials = email ? email.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() : "OP";
  const displayName = email ? email.split("@")[0] : "Operator";
  const roleLabel = user ? roleMeta[user.role as Role]?.label ?? user.role : "";

  return (
    <aside
      style={{
        width: 236,
        flex: "0 0 236px",
        background: "var(--panel)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* brand */}
      <div
        style={{
          padding: "18px 18px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 11,
        }}
      >
        <Image
          src="/Nigerian_Air_Force_emblem.svg.png"
          alt="Nigerian Air Force"
          width={37}
          height={38}
          priority
          style={{ flex: "0 0 auto", objectFit: "contain" }}
        />
        <div>
          <div style={{ font: "700 15px var(--font-sans-stack)", letterSpacing: "1.5px", color: "var(--fg)" }}>
            ISACS
          </div>
          <div
            className="mono"
            style={{ font: "500 8.5px var(--font-mono-stack)", letterSpacing: "1px", color: "var(--faint)", marginTop: 1 }}
          >
            NIGERIAN AIR FORCE
          </div>
        </div>
      </div>

      {/* nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
        {NAV.map((sec) => (
          <div key={sec.label} style={{ marginBottom: 16 }}>
            <div
              className="mono"
              style={{
                font: "600 9px var(--font-mono-stack)",
                letterSpacing: "1.4px",
                color: "var(--faint)",
                padding: "0 8px 7px",
              }}
            >
              {sec.label}
            </div>
            {sec.items.map((item) => {
              const active = item.id === activeView;
              const Icon = item.icon;
              const badge = item.id === "incidents" && openCount > 0 ? openCount : null;
              return (
                <Link key={item.id} href={item.href} className={"nav-item" + (active ? " active" : "")}>
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 7,
                      bottom: 7,
                      width: 2.5,
                      borderRadius: "0 3px 3px 0",
                      background: "var(--accent)",
                      opacity: active ? 1 : 0,
                    }}
                  />
                  <Icon size={16} strokeWidth={1.7} style={{ flex: "0 0 16px" }} />
                  <span style={{ flex: 1, textAlign: "left", font: "500 12.5px var(--font-sans-stack)" }}>
                    {item.label}
                  </span>
                  {badge != null && (
                    <span
                      className="mono"
                      style={{
                        font: "600 10px var(--font-mono-stack)",
                        background: "var(--danger)",
                        color: "#fff",
                        padding: "1px 6px",
                        borderRadius: 9,
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* user chip */}
      <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: 8,
            borderRadius: 8,
            background: "var(--panel2)",
          }}
        >
          <div
            className="mono"
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: "var(--accent)",
              color: "#04120f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "700 12px var(--font-mono-stack)",
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              title={email}
              style={{
                font: "600 11.5px var(--font-sans-stack)",
                color: "var(--fg)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
            <div
              className="mono"
              style={{ font: "500 9px var(--font-mono-stack)", letterSpacing: ".5px", color: "var(--accent)", textTransform: "uppercase" }}
            >
              {roleLabel || "SIGNED IN"}
            </div>
          </div>
          <button
            onClick={() => doLogout()}
            title="Sign out"
            style={{
              width: 28,
              height: 28,
              flex: "0 0 28px",
              borderRadius: 7,
              border: "1px solid var(--border2)",
              background: "transparent",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <LogOut size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </aside>
  );
}
