import type { NextRequest } from "next/server";
import { proxy } from "@/lib/server/proxy";

// Catch-all BFF proxy: forwards every /api/* request (that isn't handled by a
// more specific route below, e.g. /api/auth/*) to the upstream ISACS API,
// injecting the access token from the httpOnly cookie.
export const dynamic = "force-dynamic";

async function handler(request: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
