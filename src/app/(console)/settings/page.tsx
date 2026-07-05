"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { isLive } from "@/lib/config";
import { useSessionUser } from "@/lib/auth";
import { getBbiwConfig, putBbiwConfig } from "@/lib/api/bbiw";

const BBIW_ACCENT = "#a371f7";

function BbiwConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [existingToken, setExistingToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | string>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await getBbiwConfig();
        if (!alive) return;
        setHost(cfg?.host ?? "");
        setWebhookSecret(cfg?.webhookSecret ?? "");
        setExistingToken(cfg?.apiToken ? cfg.apiToken : null);
      } catch {
        // leave fields empty on read failure
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const maskedToken = existingToken
    ? existingToken.slice(0, 12) + (existingToken.length > 12 ? "…" : "")
    : null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin || "http://<isacs-host>"}/api/bbiw/webhook?secret=${
    webhookSecret || "<secret>"
  }`;

  const save = async () => {
    setSaved(null);
    if (!host.trim()) {
      setSaved("Host is required.");
      return;
    }
    if (!webhookSecret.trim()) {
      setSaved("Webhook secret is required.");
      return;
    }
    // The PUT replaces the whole value object; a masked token can't be
    // re-submitted, so the user must re-enter it every time they save.
    if (!apiToken.trim()) {
      setSaved("Re-enter the API token to save (it's write-only after creation).");
      return;
    }
    setSaving(true);
    try {
      await putBbiwConfig({ host: host.trim(), apiToken: apiToken.trim(), webhookSecret: webhookSecret.trim() });
      setExistingToken(apiToken.trim());
      setApiToken("");
      setSaved("ok");
      setTimeout(() => setSaved(null), 2500);
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: BBIW_ACCENT, flexShrink: 0 }} />
        <span className="panel-title" style={{ color: BBIW_ACCENT }}>BBIW CONFIGURATION</span>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
        {loading ? (
          <div className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)" }}>loading…</div>
        ) : (
          <>
            {/* HOST */}
            <div>
              <div className="field-label" style={{ marginBottom: 5 }}>HOST</div>
              <input
                className="input mono"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="http://192.168.0.100:80"
                style={{ font: "500 12px var(--font-mono-stack)" }}
              />
              <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", marginTop: 4 }}>
                BBIW orchestrator base URL, no trailing slash.
              </div>
            </div>

            {/* API TOKEN */}
            <div>
              <div className="field-label" style={{ marginBottom: 5 }}>API TOKEN</div>
              <input
                className="input mono"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={existingToken ? "leave blank to keep current" : "bbiw_…"}
                style={{ font: "500 12px var(--font-mono-stack)" }}
              />
              {maskedToken && (
                <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--muted)", marginTop: 4 }}>
                  current: {maskedToken}
                </div>
              )}
              <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", marginTop: 4 }}>
                Sensitive — shown once at creation in BBIW. Treat like a password.
              </div>
            </div>

            {/* WEBHOOK SECRET */}
            <div>
              <div className="field-label" style={{ marginBottom: 5 }}>WEBHOOK SECRET</div>
              <input
                className="input mono"
                type="text"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="a secret string you choose"
                style={{ font: "500 12px var(--font-mono-stack)" }}
              />
            </div>

            {/* webhook URL guidance */}
            <div>
              <div className="field-label" style={{ marginBottom: 5 }}>WEBHOOK URL FOR BBIW</div>
              <div
                className="mono"
                style={{
                  font: "500 11px var(--font-mono-stack)",
                  color: "var(--muted)",
                  background: "var(--panel2)",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  padding: "9px 11px",
                  wordBreak: "break-all",
                }}
              >
                {webhookUrl}
              </div>
              <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", marginTop: 4 }}>
                Configure this URL in BBIW so it can post detections here.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={save}
                disabled={saving}
                className="btn-accent"
                style={{
                  height: 42,
                  padding: "0 22px",
                  font: "600 11.5px var(--font-mono-stack)",
                  letterSpacing: ".6px",
                  background: BBIW_ACCENT,
                  color: "#0d0417",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "SAVING…" : "SAVE BBIW CONFIG"}
              </button>
              {saved === "ok" && <span className="mono" style={{ font: "600 10.5px var(--font-mono-stack)", color: "var(--ok)" }}>✓ saved</span>}
              {saved && saved !== "ok" && <span className="mono" style={{ font: "600 10.5px var(--font-mono-stack)", color: "var(--danger)" }}>⚠ {saved}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NumRow({
  title,
  desc,
  value,
  unit,
  onChange,
}: {
  title: string;
  desc: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>{title}</div>
        <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", marginTop: 2 }}>{desc}</div>
      </div>
      <input
        className="input mono"
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 84, height: 38, font: "600 13px var(--font-mono-stack)", textAlign: "center" }}
      />
      <span className="mono" style={{ font: "500 11px var(--font-mono-stack)", color: "var(--faint)", width: 32 }}>{unit}</span>
    </div>
  );
}

export default function SettingsPage() {
  const user = useSessionUser();
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const saveSettings = useStore((s) => s.saveSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | string>(null);

  const save = async () => {
    setSaving(true);
    setSaved(null);
    const r = await saveSettings();
    setSaving(false);
    setSaved(r.ok ? "ok" : r.error || "Failed to save");
    if (r.ok) setTimeout(() => setSaved(null), 2500);
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* APPOINTMENT RULES */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">APPOINTMENT RULES</span>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
          <NumRow
            title="Maximum appointment duration"
            desc="Caps the length of any single visit"
            value={settings.maxApptDuration}
            unit="min"
            onChange={(v) => setSetting("maxApptDuration", v)}
          />
          <NumRow
            title="Advance booking window"
            desc="How far ahead appointments may be booked"
            value={settings.advanceBooking}
            unit="days"
            onChange={(v) => setSetting("advanceBooking", v)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "600 12.5px var(--font-sans-stack)", color: "var(--fg)" }}>Permit staff-to-staff appointments</div>
              <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", marginTop: 2 }}>Inter-department meetings with security escort</div>
            </div>
            <button
              onClick={() => setSetting("staffToStaff", !settings.staffToStaff)}
              style={{
                width: 42,
                height: 24,
                borderRadius: 13,
                cursor: "pointer",
                border: "none",
                position: "relative",
                transition: ".2s",
                background: settings.staffToStaff ? "var(--accent)" : "var(--border2)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: ".2s",
                  left: settings.staffToStaff ? 21 : 3,
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ACCESS CONTROL RULES */}
      <div className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
          <span className="panel-title">ACCESS CONTROL RULES</span>
        </div>
        <div style={{ padding: 18 }}>
          <NumRow
            title="Default max failed attempts before escalation"
            desc="Individual checkpoints can override this"
            value={settings.maxFailedTries}
            unit="tries"
            onChange={(v) => setSetting("maxFailedTries", v)}
          />
        </div>
      </div>

      {/* BBIW CONFIGURATION — super_admin only */}
      {user?.role === "super_admin" && <BbiwConfigPanel />}

      {isLive && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={save}
            disabled={saving}
            className="btn-accent"
            style={{ height: 42, padding: "0 22px", font: "600 11.5px var(--font-mono-stack)", letterSpacing: ".6px", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "SAVING…" : "SAVE SETTINGS"}
          </button>
          {saved === "ok" && <span className="mono" style={{ font: "600 10.5px var(--font-mono-stack)", color: "var(--ok)" }}>✓ saved · all sessions see the new policy</span>}
          {saved && saved !== "ok" && <span className="mono" style={{ font: "600 10.5px var(--font-mono-stack)", color: "var(--danger)" }}>⚠ {saved}</span>}
        </div>
      )}

      <div className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)", textAlign: "center" }}>
        All settings changes are audit-logged · who changed what, and when · cache TTL 30s
      </div>
    </div>
  );
}
