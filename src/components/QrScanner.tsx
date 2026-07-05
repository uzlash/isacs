"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Loader2, ScanLine } from "lucide-react";

interface Props {
  /** fires once with the decoded QR text; the scanner then stops */
  onDecode: (text: string) => void;
  /** disable scanning (e.g. while a login request is in flight) */
  paused?: boolean;
  height?: number;
}

// Live camera QR scanner (ZXing, pure-JS decode). Requests the rear camera,
// streams to a <video>, and decodes continuously until a code is found — then
// it stops and hands the text up. Camera access needs a secure context
// (HTTPS or localhost); we surface a clear message if it's blocked.
export default function QrScanner({ onDecode, paused = false, height = 220 }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const firedRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState("");

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    firedRef.current = false;

    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        if (cancelled || !videoRef.current) return;

        // decodeFromVideoDevice(undefined,…) lets the browser pick a camera;
        // it prefers the environment (rear) camera on mobile.
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result && !firedRef.current) {
            firedRef.current = true;
            controls.stop();
            onDecode(result.getText());
          }
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("scanning");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        const name = (e as { name?: string })?.name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission denied — allow it or type the code instead."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not start the camera (a secure HTTPS connection is required)."
        );
      }
    })();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        /* already stopped */
      }
      controlsRef.current = null;
    };
  }, [paused, onDecode]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--border2)",
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: status === "error" ? "none" : "block" }}
      />

      {/* scanning frame overlay */}
      {status === "scanning" && (
        <>
          <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 3px color-mix(in srgb, var(--accent) 55%, transparent)", borderRadius: 12, pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: "12%", right: "12%", top: "18%", bottom: "18%", border: "1.5px solid var(--accent)", borderRadius: 10, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 10, left: 12, display: "flex", alignItems: "center", gap: 6, pointerEvents: "none" }}>
            <ScanLine size={13} strokeWidth={2} color="var(--accent)" />
            <span className="mono" style={{ font: "600 9px var(--font-mono-stack)", letterSpacing: ".5px", color: "var(--accent)", textShadow: "0 1px 3px #000" }}>SCANNING…</span>
          </div>
        </>
      )}

      {status === "starting" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Loader2 size={20} className="isacs-spin" color="var(--muted)" />
          <span className="mono" style={{ font: "500 10px var(--font-mono-stack)", color: "var(--faint)" }}>starting camera…</span>
        </div>
      )}

      {status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, padding: "0 22px", textAlign: "center" }}>
          <CameraOff size={22} strokeWidth={1.6} color="var(--danger)" />
          <span className="mono" style={{ font: "500 10.5px var(--font-mono-stack)", color: "var(--muted)", lineHeight: 1.5 }}>{error}</span>
        </div>
      )}
    </div>
  );
}
