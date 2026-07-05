// ====================================================================
// Snapshot proxy for a camera's latest still frame.
//
// GET /api/cameras/:id/snapshot — the camera's lastSnapshotUrl points at
// MinIO from the ISACS host's POV (e.g. http://localhost:9000/… or an
// internal docker host) which the browser can't reach. So we resolve it
// server-side, rewrite the host to a reachable one (same logic as the KML
// proxy), fetch the JPEG, and stream it back same-origin. This is the
// snapshot fallback source for the live CameraFeed.
// ====================================================================

import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, API_UPSTREAM_URL } from "@/lib/config";
import { upstream } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

function reachableUrl(fileUrl: string): string {
  try {
    const u = new URL(fileUrl);
    const override = process.env.ISACS_MINIO_BASE_URL;
    if (override) {
      const base = new URL(override);
      u.protocol = base.protocol;
      u.hostname = base.hostname;
      u.port = base.port;
      return u.toString();
    }
    const up = new URL(API_UPSTREAM_URL);
    if (u.hostname !== up.hostname) {
      u.protocol = up.protocol;
      u.hostname = up.hostname; // keep the object-store port (e.g. 9000)
    }
    return u.toString();
  } catch {
    return fileUrl;
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const at = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) return NextResponse.json({ ok: false, message: "Not authenticated" }, { status: 401 });

  // resolve the camera to get its lastSnapshotUrl
  const cam = await upstream(`/cameras/${id}`, { headers: { authorization: `Bearer ${at}` } });
  if (!cam.json?.ok) {
    return NextResponse.json(cam.json ?? { ok: false, message: "Camera not found" }, { status: cam.res.status || 404 });
  }
  const data = (cam.json.data as Record<string, unknown>) || {};
  const snapUrl = (data.lastSnapshotUrl as string | undefined) || "";
  if (!snapUrl) {
    return NextResponse.json({ ok: false, message: "No snapshot captured yet for this camera" }, { status: 404 });
  }

  const target = reachableUrl(snapUrl);
  try {
    const res = await fetch(target, { cache: "no-store", headers: { authorization: `Bearer ${at}` } });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: `Snapshot fetch → ${res.status}`, error: { snapUrl, target, status: res.status } },
        { status: 502 }
      );
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") || "image/jpeg",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "network error";
    return NextResponse.json({ ok: false, message: `Snapshot unreachable (${reason})`, error: { snapUrl, target } }, { status: 502 });
  }
}
