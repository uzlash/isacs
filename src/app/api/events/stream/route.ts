// ====================================================================
// SSE streaming proxy for the live event bus.
//
// GET /api/events/stream — opens a Server-Sent Events stream to the
// upstream RabbitMQ→SSE bridge (GET /events/stream). The generic /api
// catch-all proxy BUFFERS responses (await res.arrayBuffer()), which
// would deadlock on an endless stream — so SSE needs this dedicated
// handler that pipes the upstream body straight through, unbuffered.
//
// Auth: the browser can't set an Authorization header on EventSource and
// our access token lives in an httpOnly cookie (unreadable by JS), so we
// read the cookie here and forward it as a Bearer header — same BFF
// pattern as every other /api call.
// ====================================================================

import { NextRequest } from "next/server";
import { ACCESS_COOKIE, API_UPSTREAM_URL } from "@/lib/config";

// keep this handler dynamic + node-runtime so the stream isn't cached or
// pre-rendered and long-lived fetch works.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function GET(request: NextRequest) {
  const at = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) {
    return new Response("event: error\ndata: {\"message\":\"no session\"}\n\n", {
      status: 401,
      headers: { "content-type": "text/event-stream" },
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_UPSTREAM_URL}/events/stream`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${at}`,
        accept: "text/event-stream",
        "ngrok-skip-browser-warning": "true",
      },
      cache: "no-store",
      // pass the client's abort through so closing the browser tab/stream
      // tears down the upstream connection too.
      signal: request.signal,
    });
  } catch {
    return new Response('event: error\ndata: {"message":"stream unreachable"}\n\n', {
      status: 502,
      headers: { "content-type": "text/event-stream" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(`event: error\ndata: {"message":"upstream ${upstream.status}"}\n\n`, {
      status: upstream.status || 502,
      headers: { "content-type": "text/event-stream" },
    });
  }

  // Pipe the upstream SSE body straight to the client, unbuffered.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // disable proxy buffering (nginx) so events flush immediately
      "x-accel-buffering": "no",
    },
  });
}
