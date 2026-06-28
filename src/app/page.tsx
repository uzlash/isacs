"use client";

import { useRouter } from "next/navigation";
import {
  Clock,
  CreditCard,
  Truck,
  TriangleAlert,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { openIncidentCount, useStore } from "@/lib/store";
import { rel } from "@/lib/format";
import { PanelHeader, SevPill } from "@/components/ui";
import FacilityMap from "@/components/FacilityMap";

interface Kpi {
  label: string;
  value: string;
  sub: string;
  tone: string;
  icon: LucideIcon;
}

const ZONES = [
  { name: "Building A", cur: 24, cap: 60, tone: "var(--accent)" },
  { name: "Building B", cur: 11, cap: 40, tone: "var(--info)" },
  { name: "Vehicle Bay", cur: 6, cap: 15, tone: "var(--warn)" },
  { name: "Perimeter", cur: 6, cap: 20, tone: "var(--ok)" },
];

const INFRA = [
  { name: "Reverse Proxy", role: "Traefik · routing + SSL", metric: "1.4 ms", tone: "var(--ok)" },
  { name: "PostgreSQL", role: "Primary datastore", metric: "OK", tone: "var(--ok)" },
  { name: "Redis", role: "Sessions + token validation", metric: "OK", tone: "var(--ok)" },
  { name: "RabbitMQ", role: "Internal event bus", metric: "214 msg/s", tone: "var(--ok)" },
  { name: "MinIO", role: "On-prem object store", metric: "OK", tone: "var(--ok)" },
];

export default function DashboardPage() {
  const router = useRouter();
  useStore((s) => s.tick); // re-render on clock tick for relative times
  const incidents = useStore((s) => s.incidents);
  const visitors = useStore((s) => s.visitors);
  const feed = useStore((s) => s.feed);
  const selectIncident = useStore((s) => s.selectIncident);

  const openCount = openIncidentCount(incidents);
  const onSite = visitors.filter((v) => v.checkedIn).length + 39;

  const kpis: Kpi[] = [
    { label: "People On Site", value: String(onSite), sub: "↑ staff + visitors", tone: "var(--accent)", icon: Users },
    {
      label: "Open Incidents",
      value: String(openCount),
      sub: openCount ? "requires triage" : "all clear",
      tone: openCount ? "var(--danger)" : "var(--ok)",
      icon: TriangleAlert,
    },
    { label: "Active Cards", value: "212", sub: "staff · visitor · vehicle", tone: "var(--info)", icon: CreditCard },
    { label: "Cameras Online", value: "7/8", sub: "1 inactive (CAM-07)", tone: "var(--warn)", icon: Video },
    { label: "Assets Tracked", value: "4/5", sub: "4 protocols active", tone: "var(--accent)", icon: Truck },
    { label: "Avg Response", value: "4m", sub: "open → assigned", tone: "var(--ok)", icon: Clock },
  ];

  const dashIncidents = incidents.filter((i) => i.status !== "resolved").slice(0, 3);

  const openIncident = (id: string) => {
    selectIncident(id);
    router.push("/incidents");
  };

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto" }}>
      {/* KPI ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14, marginBottom: 16 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="panel" style={{ padding: "14px 15px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: k.tone, opacity: 0.85 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="label">{k.label}</span>
                <Icon size={15} strokeWidth={1.7} color={k.tone} />
              </div>
              <div className="mono" style={{ font: "600 30px var(--font-mono-stack)", color: "var(--fg)", marginTop: 10, lineHeight: 1 }}>
                {k.value}
              </div>
              <div className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)", marginTop: 6 }}>
                {k.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* TWO-COLUMN BODY */}
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, alignItems: "stretch" }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel">
            <PanelHeader
              title="LIVE EVENT BUS"
              sub="· RabbitMQ · cross-module propagation"
              dot="var(--accent)"
              right={<span className="panel-sub">{feed.length} events</span>}
            />
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {feed.map((e, idx) => (
                <div
                  key={e.id}
                  className={idx === 0 ? "anim-in" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    padding: "8px 16px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", width: 52, flex: "0 0 52px" }}>
                    {rel(e.at)}
                  </span>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: e.tone, flex: "0 0 8px", marginTop: 4 }} />
                  <span
                    className="mono"
                    style={{ font: "600 8.5px var(--font-mono-stack)", letterSpacing: ".5px", color: e.tone, width: 84, flex: "0 0 84px", textTransform: "uppercase" }}
                  >
                    {e.module}
                  </span>
                  <span style={{ flex: 1, font: "500 12px var(--font-sans-stack)", color: "var(--fg)" }}>{e.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SYSTEM HEALTH */}
          <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <PanelHeader
              title="SYSTEM HEALTH"
              sub="· on-premises · no single point of failure"
              right={
                <span className="mono" style={{ display: "flex", alignItems: "center", gap: 6, font: "600 9.5px var(--font-mono-stack)", color: "var(--ok)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)", boxShadow: "0 0 7px var(--ok)", animation: "isacs-pulse 2.2s infinite" }} />
                  12/12 SERVICES ONLINE
                </span>
              }
            />
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
              {INFRA.map((c) => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 16px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.tone, flex: "0 0 8px" }} />
                  <span style={{ font: "600 11.5px var(--font-sans-stack)", color: "var(--fg)", width: 120, flex: "0 0 120px" }}>{c.name}</span>
                  <span className="mono" style={{ flex: 1, font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)" }}>{c.role}</span>
                  <span className="mono" style={{ font: "600 10px var(--font-mono-stack)", color: c.tone }}>{c.metric}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel" style={{ overflow: "hidden" }}>
            <PanelHeader title="FACILITY MAP" right={<span className="panel-sub">ALPHA COMPOUND</span>} />
            <div style={{ padding: 14 }}>
              <FacilityMap />
              <div style={{ display: "flex", gap: 14, marginTop: 11, flexWrap: "wrap" }}>
                <Legend tone="var(--accent)" round label="Access Node" />
                <Legend tone="var(--info)" label="Camera" />
                <Legend tone="var(--warn)" round label="Tracked Asset" />
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: "14px 16px" }}>
            <div className="panel-title" style={{ marginBottom: 13 }}>ZONE OCCUPANCY</div>
            {ZONES.map((z) => (
              <div key={z.name} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", font: "500 11px var(--font-sans-stack)", color: "var(--muted)", marginBottom: 5 }}>
                  <span>{z.name}</span>
                  <span className="mono" style={{ color: "var(--fg)" }}>{z.cur} / {z.cap}</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: "var(--panel3)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((z.cur / z.cap) * 100)}%`, background: z.tone, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* OPEN INCIDENTS STRIP */}
      <div className="panel" style={{ marginTop: 16 }}>
        <PanelHeader
          title="OPEN INCIDENTS · ASRS"
          right={
            <button onClick={() => router.push("/incidents")} style={{ font: "600 10.5px var(--font-mono-stack)", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", letterSpacing: ".5px" }}>
              VIEW ALL →
            </button>
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
          {dashIncidents.map((i) => (
            <div
              key={i.id}
              onClick={() => openIncident(i.id)}
              className="row-hover"
              style={{ padding: "14px 16px", borderRight: "1px solid var(--border)", borderTop: "1px solid var(--border)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <SevPill sev={i.sev} />
                <span className="label">{i.source}</span>
                <div style={{ flex: 1 }} />
                <span className="mono" style={{ font: "500 9.5px var(--font-mono-stack)", color: "var(--faint)" }}>{rel(i.created)}</span>
              </div>
              <div style={{ font: "500 12.5px var(--font-sans-stack)", color: "var(--fg)", lineHeight: 1.4 }}>{i.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Legend({ tone, label, round }: { tone: string; label: string; round?: boolean }) {
  return (
    <span className="mono" style={{ display: "flex", alignItems: "center", gap: 5, font: "500 9.5px var(--font-mono-stack)", color: "var(--muted)" }}>
      <span style={{ width: 8, height: 8, borderRadius: round ? "50%" : 0, background: tone }} />
      {label}
    </span>
  );
}
