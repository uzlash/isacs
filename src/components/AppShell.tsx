"use client";

import ConsoleData from "./ConsoleData";
import DetectionToasts from "./DetectionToasts";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useStore } from "@/lib/store";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useStore((s) => s.ready);
  const loadError = useStore((s) => s.loadError);

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      {/* Data bootstrap — MUST live outside the ready-gate below, or it would
          never mount and `ready` would never flip. */}
      <ConsoleData />
      {/* Live BBIW detection alerts (fixed overlay, above everything) */}
      <DetectionToasts />
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
        <Topbar />
        {loadError && (
          <div
            className="mono"
            role="alert"
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 20px",
              background: "color-mix(in srgb, var(--danger) 12%, var(--panel))",
              borderBottom: "1px solid var(--danger)",
              color: "var(--danger)",
              font: "600 10.5px var(--font-mono-stack)",
              letterSpacing: ".4px",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--danger)", flex: "0 0 7px" }} />
            {loadError} — showing what could be loaded. Retry from the network or check the ISACS API.
          </div>
        )}
        <main className="view-main">
          {ready ? (
            children
          ) : (
            <div
              className="mono"
              style={{
                height: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--faint)",
                font: "500 12px var(--font-mono-stack)",
                letterSpacing: ".5px",
              }}
            >
              INITIALIZING CONSOLE…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
