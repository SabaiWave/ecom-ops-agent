/**
 * api/chat/route.ts — Streaming chat endpoint
 *
 * Accepts a customer message, runs it through the agent, and streams
 * two types of server-sent events back to the browser:
 *
 *   { type: "tool", tool: "get_order" }         — fired each time a tool runs
 *   { type: "done", log: RunLog }                — fired when the agent finishes
 *
 * Using SSE (text/event-stream) so the UI can display tool calls in real time
 * without waiting for the full agent run to complete.
 */

import { NextRequest } from "next/server";
import { runAgent } from "../../../agent/run";

export const runtime = "nodejs";
// Agent runs can take 20–30s — extend the default Vercel timeout
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { message } = (await req.json()) as { message: string };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
    });
  }

  // Set up a TransformStream so we can write SSE events as the agent runs
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (data: object) => {
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  // Run the agent in the background — stream tool events, then send the final log
  (async () => {
    try {
      const log = await runAgent(message, {
        onToolCall: (toolName) => send({ type: "tool", tool: toolName }),
      });
      send({ type: "done", log });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send({ type: "error", message });
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
