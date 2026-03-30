"use client";

/**
 * components/ChatWindow.tsx — Main chat interface
 *
 * Renders the message thread and handles streaming from /api/chat.
 * Tool call events arrive before the final response, so they're shown
 * as a live activity feed while the agent works.
 */

import { useState, useRef, useEffect } from "react";
import type { RunLog } from "../agent/run";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserMessage {
  role: "user";
  text: string;
}

interface AgentMessage {
  role: "agent";
  text: string;
  decision: "responded" | "escalated";
  toolsCalled: string[];
  durationMs: number;
  tokensUsed: number;
}

interface PendingMessage {
  role: "pending";
  toolsFired: string[];
}

type Message = UserMessage | AgentMessage | PendingMessage;

// ---------------------------------------------------------------------------
// Tool label helpers
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  get_order: "Looking up order",
  get_product_info: "Fetching product info",
  check_return_eligibility: "Checking return eligibility",
  draft_response: "Drafting response",
  escalate_to_human: "Escalating to human",
};

const TOOL_ICONS: Record<string, string> = {
  get_order: "🔍",
  get_product_info: "📦",
  check_return_eligibility: "✅",
  draft_response: "✍️",
  escalate_to_human: "🚨",
};

function toolLabel(name: string): string {
  return `${TOOL_ICONS[name] ?? "⚙️"} ${TOOL_LABELS[name] ?? name}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isRunning) return;

    setInput("");
    setIsRunning(true);

    // Add the user message and a pending placeholder
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "pending", toolsFired: [] },
    ]);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (!response.body) {
      setIsRunning(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6);

        try {
          const event = JSON.parse(raw) as
            | { type: "tool"; tool: string }
            | { type: "done"; log: RunLog }
            | { type: "error"; message: string };

          if (event.type === "tool") {
            // Append the tool name to the pending message's live feed
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "pending") {
                updated[updated.length - 1] = {
                  ...last,
                  toolsFired: [...last.toolsFired, event.tool],
                };
              }
              return updated;
            });
          }

          if (event.type === "done") {
            // Replace the pending message with the final agent message
            setMessages((prev) => {
              const updated = prev.slice(0, -1); // remove pending
              return [
                ...updated,
                {
                  role: "agent",
                  text: event.log.output,
                  decision: event.log.decision,
                  toolsCalled: event.log.tools_called,
                  durationMs: event.log.duration_ms,
                  tokensUsed: event.log.tokens_used,
                },
              ];
            });
            setIsRunning(false);
          }

          if (event.type === "error") {
            setMessages((prev) => {
              const updated = prev.slice(0, -1);
              return [
                ...updated,
                {
                  role: "agent",
                  text: `Something went wrong: ${event.message}`,
                  decision: "responded",
                  toolsCalled: [],
                  durationMs: 0,
                  tokensUsed: 0,
                },
              ];
            });
            setIsRunning(false);
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-zinc-400 text-sm mt-12">
            <p className="text-2xl mb-2">💊</p>
            <p className="font-medium text-zinc-300">Vitalize Support Agent</p>
            <p className="mt-1">Ask about an order, return, or product.</p>
            <p className="mt-4 text-xs text-zinc-500">Try: &quot;I need to return order #1038 — it arrived damaged&quot;</p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[75%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.role === "pending") {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[75%] space-y-2">
                  {/* Live tool feed */}
                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 space-y-1.5 text-xs text-zinc-400 font-mono">
                    {msg.toolsFired.length === 0 ? (
                      <span className="animate-pulse">Thinking…</span>
                    ) : (
                      msg.toolsFired.map((tool, j) => (
                        <div key={j} className={j === msg.toolsFired.length - 1 ? "text-zinc-200" : "text-zinc-500"}>
                          {toolLabel(tool)}
                          {j === msg.toolsFired.length - 1 && (
                            <span className="animate-pulse ml-1">…</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (msg.role === "agent") {
            return (
              <div key={i} className="flex justify-start">
                <div className="max-w-[75%] space-y-2">
                  {/* Tool chain summary */}
                  {msg.toolsCalled.length > 0 && (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 space-y-1.5 text-xs text-zinc-500 font-mono">
                      {msg.toolsCalled.map((tool, j) => (
                        <div key={j}>{toolLabel(tool)}</div>
                      ))}
                    </div>
                  )}

                  {/* Response bubble */}
                  <div className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.decision === "escalated"
                      ? "bg-amber-950 border border-amber-800 text-amber-100"
                      : "bg-zinc-800 border border-zinc-700 text-zinc-100"
                  }`}>
                    {msg.decision === "escalated" && (
                      <p className="text-amber-400 text-xs font-medium mb-2">⚠️ Escalated to human review</p>
                    )}
                    {msg.text}
                  </div>

                  {/* Run metadata */}
                  <div className="flex gap-3 text-xs text-zinc-600 px-1">
                    <span>{(msg.durationMs / 1000).toFixed(1)}s</span>
                    <span>{msg.tokensUsed.toLocaleString()} tokens</span>
                  </div>
                </div>
              </div>
            );
          }
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-zinc-800 px-4 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-zinc-500"
            placeholder="Message Vitalize Support…"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
          />
          <button
            onClick={sendMessage}
            disabled={isRunning || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-3 rounded-xl transition-colors"
          >
            {isRunning ? "…" : "Send"}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-2 px-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
