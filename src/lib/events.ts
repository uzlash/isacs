// ====================================================================
// Live event-bus client (SSE).
//
// Connects to the BFF stream at /api/events/stream and parses Server-Sent
// Events. We use fetch + ReadableStream (not native EventSource) because
// our access token lives in an httpOnly cookie — the proxy injects the
// Bearer, and cookies ride along automatically with same-origin fetch, so
// there's nothing for the client to attach. Auto-reconnects with backoff.
// ====================================================================

export interface IsacsEvent {
  type: string;
  payload: unknown;
  ts?: number;
}

type Handler = (e: IsacsEvent) => void;

export interface EventStream {
  close: () => void;
}

const STREAM_URL = "/api/events/stream";

/**
 * Open the live event stream. `onEvent` fires for every parsed event
 * (including the initial `connected`). Returns a handle whose `close()`
 * aborts the connection and stops reconnection.
 */
export function connectEvents(onEvent: Handler, onStatus?: (s: "open" | "closed" | "retrying") => void): EventStream {
  let controller: AbortController | null = null;
  let stopped = false;
  let retry = 0;

  const run = async () => {
    controller = new AbortController();
    try {
      const res = await fetch(STREAM_URL, {
        headers: { accept: "text/event-stream" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

      onStatus?.("open");
      retry = 0; // reset backoff on a clean open

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const evt = parseFrame(frame);
          if (evt) onEvent(evt);
        }
      }
    } catch {
      /* fall through to reconnect */
    }

    if (stopped) return;
    onStatus?.("retrying");
    // exponential backoff, capped at 15s
    retry = Math.min(retry + 1, 6);
    const delay = Math.min(15000, 500 * 2 ** retry);
    setTimeout(() => {
      if (!stopped) void run();
    }, delay);
  };

  void run();

  return {
    close: () => {
      stopped = true;
      onStatus?.("closed");
      controller?.abort();
    },
  };
}

// Parse a single SSE frame: `event:` name lines + one or more `data:` lines.
// The upstream sends `data:` as a JSON object { type, payload, ts }.
function parseFrame(frame: string): IsacsEvent | null {
  let eventName = "";
  const dataLines: string[] = [];
  for (const raw of frame.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith(":")) continue; // comment / heartbeat
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  if (!dataLines.length) return null;
  const data = dataLines.join("\n");
  try {
    const parsed = JSON.parse(data) as Partial<IsacsEvent>;
    // prefer the payload's own `type`; fall back to the SSE event: name
    return {
      type: parsed.type || eventName || "message",
      payload: parsed.payload ?? parsed,
      ts: parsed.ts,
    };
  } catch {
    // non-JSON data — still surface it under the event name
    return { type: eventName || "message", payload: data };
  }
}
