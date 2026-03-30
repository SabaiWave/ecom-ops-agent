/**
 * agent/run.ts — Exportable agent runner
 *
 * Contains runAgent() as a pure importable function so it can be called from:
 *   - The CLI (agent/index.ts)
 *   - The Next.js API route (ui/app/api/chat/route.ts)
 *
 * The onToolCall callback is how callers receive real-time tool events.
 * The CLI uses it to print to stdout; the API route uses it to stream to the browser.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { STORE_CONFIG } from "../config/store";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, "../logs");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RunLog {
  run_id: string;
  timestamp: string;
  conversation_id: string | null;
  input: string;
  tools_called: string[];
  decision: "responded" | "escalated";
  duration_ms: number;
  tokens_used: number;
  output: string;
}

export interface RunAgentOptions {
  conversationId?: string | null;
  // Called each time a tool fires — use this to stream progress to a UI
  onToolCall?: (toolName: string) => void;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
  return `You are the customer support agent for ${STORE_CONFIG.name} — "${STORE_CONFIG.tagline}".

You handle post-purchase support: order status, shipping inquiries, returns, and refunds.
You have access to 5 tools. Use them in sequence to fully resolve each issue before responding.

## Workflow
1. Use get_order to look up every order the customer mentions
2. Use get_product_info if the customer asks about ingredients, dosage, or product details
3. Use check_return_eligibility before promising any refund
4. Use draft_response to write the final customer reply — never write it yourself
5. Use escalate_to_human when required (see rules below)

## Escalation Rules — escalate immediately, do not respond directly, when:
- Customer mentions a drug interaction, medication, medical condition, pregnancy, or allergy concern
- check_return_eligibility returns auto_approved: false — this means the refund exceeds $${STORE_CONFIG.autoApproveRefundUnder} and MUST be reviewed by a human; you cannot approve it yourself
- An order cannot be found after lookup
- The situation is ambiguous, emotionally charged, or involves potential harm
- A tool fails and you cannot resolve the issue

## Tone & Constraints
- Be warm, clear, and concise
- Never give medical or nutritional advice
- Never promise a specific delivery date you haven't confirmed from order data
- Always use the customer's name
- Always confirm refund amounts and timelines explicitly (3–5 business days)

## Tool Usage Notes
- Always call draft_response as your final step before finishing — do not write raw text replies
- Pass all relevant context to draft_response so the reply covers everything
- If you escalate, still call draft_response to give the customer a holding message`;
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

export async function runAgent(
  customerMessage: string,
  options: RunAgentOptions = {}
): Promise<RunLog> {
  const { conversationId = null, onToolCall } = options;

  const runId = `run-${Date.now()}`;
  const startTime = Date.now();
  const toolsCalled: string[] = [];

  // -- Connect to MCP server --------------------------------------------------
  // PROJECT_ROOT is always the repo root (one level up from agent/)
  const PROJECT_ROOT = join(__dirname, "..");
  const TSX_BIN = join(PROJECT_ROOT, "node_modules", ".bin", "tsx");

  const serverPath = join(PROJECT_ROOT, "server", "index.ts");

  const transport = new StdioClientTransport({
    command: TSX_BIN,
    args: [serverPath],
    env: { ...process.env } as Record<string, string>,
    cwd: PROJECT_ROOT,
  });

  const mcpClient = new Client(
    { name: "vitalize-agent", version: "1.0.0" },
    { capabilities: {} }
  );

  await mcpClient.connect(transport);

  // -- Fetch tool definitions from MCP server ---------------------------------
  const { tools: mcpTools } = await mcpClient.listTools();

  // Convert MCP tool definitions to Anthropic tool format
  const tools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
  }));

  // -- Set up Anthropic client ------------------------------------------------
  const anthropic = new Anthropic({
    apiKey: process.env["ANTHROPIC_API_KEY"],
  });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: customerMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalOutput = "";
  let decision: "responded" | "escalated" = "responded";

  // -- Agentic loop -----------------------------------------------------------
  // Claude runs until it stops calling tools (stop_reason === "end_turn")
  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      tools,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Collect any text blocks for the final output
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        finalOutput = block.text;
      }
    }

    // end_turn means Claude has nothing more to do — no pending tool calls
    if (response.stop_reason === "end_turn") {
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolsCalled.push(toolUse.name);

        if (toolUse.name === "escalate_to_human") {
          decision = "escalated";
        }

        // Notify caller that a tool is firing — used for real-time UI updates
        onToolCall?.(toolUse.name);

        const result = await mcpClient.callTool({
          name: toolUse.name,
          arguments: toolUse.input as Record<string, unknown>,
        });

        // MCP returns content as an array; extract the text
        const resultText =
          Array.isArray(result.content) && result.content[0]?.type === "text"
            ? result.content[0].text
            : JSON.stringify(result.content);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: resultText,
        });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  await mcpClient.close();

  // -- Extract the drafted customer response ----------------------------------
  // The draft_response tool returns { draft: "..." } — pull it from tool results
  const draftResult = messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter(
      (b): b is Anthropic.ToolResultBlockParam =>
        "type" in b && b.type === "tool_result"
    )
    .map((b) => {
      try {
        const parsed =
          typeof b.content === "string" ? JSON.parse(b.content) : null;
        return parsed?.draft as string | undefined;
      } catch {
        return undefined;
      }
    })
    .filter(Boolean)
    .at(-1); // take the last draft if multiple were generated

  if (draftResult) {
    finalOutput = draftResult;
  }

  const duration = Date.now() - startTime;

  const log: RunLog = {
    run_id: runId,
    timestamp: new Date().toISOString(),
    conversation_id: conversationId,
    input: customerMessage,
    tools_called: toolsCalled,
    decision,
    duration_ms: duration,
    tokens_used: totalInputTokens + totalOutputTokens,
    output: finalOutput,
  };

  // Write log to disk
  const logPath = join(LOGS_DIR, `${runId}.json`);
  await writeFile(logPath, JSON.stringify(log, null, 2), "utf-8");

  return log;
}
