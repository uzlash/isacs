import { type NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, API_UPSTREAM_URL } from "@/lib/config";
import { upstream } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

// KML lives in MinIO, whose fileUrl is written from the ISACS host's point of
// view — e.g. http://localhost:9000/... or http://minio:9000/... — neither of
// which is reachable from our Next server (a different host/network). MinIO
// runs alongside the ISACS API, so we rewrite the host to the ISACS upstream
// host, keeping MinIO's own port. An explicit override wins if set.
function reachableKmlUrl(fileUrl: string): string {
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
      u.hostname = up.hostname; // keep u.port (MinIO's exposed port, e.g. 9000)
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

  const layer = await upstream(`/map/layers/${id}`, { headers: { authorization: `Bearer ${at}` } });
  if (!layer.json?.ok) {
    return NextResponse.json(layer.json ?? { ok: false, message: "Layer not found" }, { status: layer.res.status || 404 });
  }
  const fileUrl = (layer.json.data as Record<string, unknown>)?.fileUrl as string | undefined;
  if (!fileUrl) {
    return NextResponse.json({ ok: false, message: "Layer has no file URL" }, { status: 404 });
  }

  const target = reachableKmlUrl(fileUrl);
  try {
    const res = await fetch(target, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, message: `KML fetch → ${res.status} from ${target}`, error: { fileUrl, target, status: res.status } },
        { status: 502 }
      );
    }
    const text = await res.text();
    return new Response(text, {
      status: 200,
      headers: { "content-type": "application/vnd.google-earth.kml+xml; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "network error";
    return NextResponse.json(
      { ok: false, message: `KML unreachable: ${target} (${reason})`, error: { fileUrl, target, reason } },
      { status: 502 }
    );
  }
}
