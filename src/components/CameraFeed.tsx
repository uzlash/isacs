"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, VideoOff } from "lucide-react";

interface Props {
  cameraId: string;
  active: boolean;
  /** unused externally now — snapshots proxy through /api/cameras/:id/snapshot */
  snapshotUrl?: string | null;
  /** show the maximize button (calls onMaximize) */
  onMaximize?: () => void;
  /** poll interval for the snapshot fallback, ms */
  pollMs?: number;
  rounded?: boolean;
}

type Mode = "mjpeg" | "snapshot" | "none";

// Live camera view. Tries the server MJPEG stream first (ffmpeg RTSP→mjpeg,
// rendered natively by the browser in an <img>). If that fails (ffmpeg not
// installed, stream error, or after a short timeout with no frame), it falls
// back to polling the snapshot proxy (/api/cameras/:id/snapshot — same-origin,
// resolves + rewrites MinIO host server-side), cache-busted. Shows a clear
// state when the camera is inactive or neither source has a frame.
export default function CameraFeed({ cameraId, active, onMaximize, pollMs = 1500, rounded = true }: Props) {
  const [mode, setMode] = useState<Mode>(active ? "mjpeg" : "none");
  const [src, setSrc] = useState<string>("");
  const [stamp, setStamp] = useState(0); // for the snapshot poll cache-buster
  const gotFrame = useRef(false);

  const mjpegUrl = `/api/cameras/${cameraId}/mjpeg`;
  const snapUrl = `/api/cameras/${cameraId}/snapshot`;

  // reset when the camera or its active state changes
  useEffect(() => {
    if (!active) {
      setMode("none");
      return;
    }
    gotFrame.current = false;
    setMode("mjpeg");
    setSrc(mjpegUrl);
    // If MJPEG produces no frame within ~4s (e.g. ffmpeg missing → 501, or the
    // stream stalls), fall back to the snapshot. onError alone isn't reliable
    // for a hung stream, so we time it out.
    const t = setTimeout(() => {
      if (!gotFrame.current) setMode("snapshot");
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, active]);

  // when we enter snapshot mode, load the first frame immediately, then poll
  useEffect(() => {
    if (mode !== "snapshot") return;
    setStamp((s) => s + 1); // immediate first frame
    const id = setInterval(() => setStamp((s) => s + 1), pollMs);
    return () => clearInterval(id);
  }, [mode, pollMs]);

  useEffect(() => {
    if (mode === "snapshot") setSrc(`${snapUrl}?_=${stamp}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stamp]);

  const onImgLoad = () => {
    gotFrame.current = true;
  };
  const onImgError = () => {
    // MJPEG failed → try snapshot; snapshot failed (no capture / unreachable) → give up.
    if (mode === "mjpeg") setMode("snapshot");
    else if (mode === "snapshot") setMode("none");
  };

  const box: React.CSSProperties = {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 10",
    background: "#05070b",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: rounded ? 0 : 0,
  };

  return (
    <div style={box}>
      {mode !== "none" && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="camera feed"
          onLoad={onImgLoad}
          onError={onImgError}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--faint)" }}>
          <VideoOff size={22} strokeWidth={1.6} />
          <span className="mono" style={{ font: "500 10px var(--font-mono-stack)" }}>
            {active ? "NO FEED" : "OFFLINE"}
          </span>
        </div>
      )}

      {/* live/mode badge */}
      {mode !== "none" && (
        <div style={{ position: "absolute", top: 7, left: 8, display: "flex", alignItems: "center", gap: 5, zIndex: 2, pointerEvents: "none" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: mode === "mjpeg" ? "var(--ok)" : "var(--warn)", boxShadow: `0 0 6px ${mode === "mjpeg" ? "var(--ok)" : "var(--warn)"}` }} />
          <span className="mono" style={{ font: "600 8px var(--font-mono-stack)", letterSpacing: ".5px", color: mode === "mjpeg" ? "var(--ok)" : "var(--warn)", textShadow: "0 1px 3px #000" }}>
            {mode === "mjpeg" ? "LIVE" : "SNAPSHOT"}
          </span>
        </div>
      )}

      {onMaximize && (
        <button
          onClick={onMaximize}
          title="Maximize"
          aria-label="Maximize feed"
          style={{ position: "absolute", top: 7, right: 8, zIndex: 2, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, cursor: "pointer", background: "rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.15)", color: "#fff", backdropFilter: "blur(3px)" }}
        >
          <Maximize2 size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
