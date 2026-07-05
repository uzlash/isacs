"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { isLive } from "@/lib/config";

/**
 * Console-scoped data bootstrap. Mounts with the (console) layout, so it fires
 * once when the operator enters the console (including after a login redirect).
 * Live mode fetches from the API; mock mode seeds the in-memory demo data.
 */
export default function ConsoleData() {
  const loadLive = useStore((s) => s.loadLive);
  const hydrate = useStore((s) => s.hydrate);
  const connectEventStream = useStore((s) => s.connectEventStream);
  const disconnectEventStream = useStore((s) => s.disconnectEventStream);

  useEffect(() => {
    if (!useStore.getState().ready) {
      if (isLive) void loadLive();
      else hydrate(Date.now());
    }

    // Live mode: open the real-time SSE bus so the feed + badges reflect
    // facility events as they happen (no-op in mock mode).
    if (isLive) connectEventStream();

    // Failsafe: never let the dashboard spin forever. loadLive already caps at
    // ~15s (per-request timeout), but if anything slips through, force the shell
    // to render with a clear error instead of an endless "Initializing…".
    const failsafe = setTimeout(() => {
      if (!useStore.getState().ready) {
        useStore.setState({
          ready: true,
          loadError: "Console load timed out — the ISACS API may be unreachable.",
        });
      }
    }, 18000);
    return () => {
      clearTimeout(failsafe);
      if (isLive) disconnectEventStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
