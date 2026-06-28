// Small shared presentational helpers used across views.

import type { CSSProperties } from "react";
import { sevColor } from "@/lib/format";
import type { Severity } from "@/lib/types";

/** Outlined pill (status / type badges). */
export function OutPill({
  tone,
  children,
  uppercase,
  style,
}: {
  tone: string;
  children: React.ReactNode;
  uppercase?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className="pill mono"
      style={{
        color: tone,
        border: `1px solid ${tone}`,
        textTransform: uppercase ? "uppercase" : undefined,
        letterSpacing: uppercase ? ".4px" : undefined,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Severity pill (critical/high/medium/low). */
export function SevPill({ sev }: { sev: Severity }) {
  const c = sevColor(sev);
  return (
    <span className="sev-pill mono" style={{ color: c, border: `1px solid ${c}` }}>
      {sev}
    </span>
  );
}

/** Faint/neutral outlined pill (deactivated, not-on-site, etc.). */
export function FaintPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="pill mono" style={{ color: "var(--faint)", border: "1px solid var(--border2)" }}>
      {children}
    </span>
  );
}

/** Standard panel header with a mono title (+ optional subtitle/right slot). */
export function PanelHeader({
  title,
  sub,
  right,
  dot,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  dot?: string;
}) {
  return (
    <div className="panel-hd">
      {dot && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dot,
            animation: "isacs-pulse 1.8s infinite",
          }}
        />
      )}
      <span className="panel-title">{title}</span>
      {sub && <span className="panel-sub">{sub}</span>}
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}
