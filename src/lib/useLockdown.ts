"use client";

import { useCallback, useEffect, useState } from "react";
import { getActiveLockdown, listLockdowns, type Lockdown } from "@/lib/api/lockdown";

// Shared lockdown state — the active lockdown, history, and a refresh trigger.
// Used by the status banner and the per-node lockdown action so they stay in
// sync (initiate/lift from one place immediately updates the other).
export function useLockdown() {
  const [active, setActive] = useState<Lockdown | null>(null);
  const [history, setHistory] = useState<Lockdown[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [a, all] = await Promise.all([getActiveLockdown(), listLockdowns()]);
      setActive(a);
      setHistory(all);
    } catch {
      /* leave state as-is on failure */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 20000); // poll per the reference UX guide
    return () => clearInterval(id);
  }, [refresh]);

  return { active, history, refresh };
}
