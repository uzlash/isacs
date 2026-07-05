// ====================================================================
// Live MJPEG feed for one camera.
//
// GET /api/cameras/:id/mjpeg — spawns ffmpeg to pull the camera's RTSP
// stream and transcode it to an HTTP multipart/x-mixed-replace MJPEG
// stream, which browsers render natively in an <img> tag. This is the
// pragmatic "live-ish" feed until a proper WebRTC/HLS gateway exists.
//
// Auth: reads the access token from the httpOnly cookie, fetches the
// camera record from upstream to get its rtspPath (never trusts a
// client-supplied URL), then streams. ffmpeg must be on the server PATH
// (or ISACS_FFMPEG_PATH); if it's missing we return a clear 501.
//
// NOTE: spawning ffmpeg per viewer is fine for a demo/on-prem console but
// is really a backend/ops concern — in production the surveillance service
// should expose the transcoded stream and this route becomes a thin proxy.
// ====================================================================

import { spawn } from "node:child_process";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE, API_UPSTREAM_URL } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

const FFMPEG = process.env.ISACS_FFMPEG_PATH || "ffmpeg";
// ffmpeg's mpjpeg muxer writes a fixed part boundary of "ffmpeg" (i.e. the
// separator line is "--ffmpeg"). The response Content-Type boundary must match.
const BOUNDARY = "ffmpeg";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const at = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) return new Response("no session", { status: 401 });

  // Resolve the camera's RTSP URL from the upstream (server-side only).
  let rtsp = "";
  try {
    const res = await fetch(`${API_UPSTREAM_URL}/cameras/${id}`, {
      headers: { authorization: `Bearer ${at}`, "ngrok-skip-browser-warning": "true" },
      cache: "no-store",
    });
    if (!res.ok) return new Response(`camera lookup failed (${res.status})`, { status: res.status });
    const json = (await res.json()) as { data?: { rtspPath?: string } };
    rtsp = json?.data?.rtspPath || "";
  } catch {
    return new Response("camera lookup failed (upstream unreachable)", { status: 502 });
  }
  if (!rtsp) return new Response("camera has no RTSP path configured", { status: 400 });

  // Spawn ffmpeg: RTSP in → MJPEG multipart out on stdout.
  let ff;
  try {
    ff = spawn(FFMPEG, [
      "-rtsp_transport", "tcp",          // reliable over TCP (many cams need this)
      "-i", rtsp,
      "-an",                              // drop audio
      "-r", "12",                         // ~12 fps is plenty for monitoring
      "-q:v", "6",                        // JPEG quality (2=best … 31=worst)
      "-f", "mpjpeg",
      "pipe:1",
    ], { stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return new Response("ffmpeg not available on the server", { status: 501 });
  }

  let ffmpegFailed = false;
  ff.on("error", () => { ffmpegFailed = true; }); // e.g. ENOENT (ffmpeg missing)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ff.stdout.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          /* controller closed — ignore */
        }
      });
      ff.stdout.on("end", () => {
        try { controller.close(); } catch { /* already closed */ }
      });
      ff.on("close", () => {
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      // browser closed the <img> / navigated away → stop ffmpeg
      ff.kill("SIGKILL");
    },
  });

  // If ffmpeg failed to launch synchronously (ENOENT), surface a 501.
  if (ffmpegFailed) {
    return new Response("ffmpeg not available on the server (install it or set ISACS_FFMPEG_PATH)", { status: 501 });
  }

  // Also tear down ffmpeg if the request is aborted.
  request.signal.addEventListener("abort", () => ff.kill("SIGKILL"));

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
      "cache-control": "no-cache, no-store, must-revalidate",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
