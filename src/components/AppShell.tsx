"use client";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useStore } from "@/lib/store";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useStore((s) => s.ready);

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
        <Topbar />
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
