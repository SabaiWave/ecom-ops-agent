/**
 * server/index.ts — Vitalize MCP Server
 *
 * Exposes 5 tools to the agent over stdio:
 *   1. get_order              — look up order by ID or email
 *   2. get_product_info       — fetch product details + FAQs
 *   3. check_return_eligibility — rules-based return decision
 *   4. draft_response         — generate customer reply via Claude
 *   5. escalate_to_human      — log structured handoff for human review
 *
 * Run standalone: npm run server
 * Used by agent: spawned automatically via StdioClientTransport
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import {
  getOrderById,
  getOrdersByEmail,
  getProductById,
  searchProductsByName,
  getReturnPolicy,
  type Order,
} from "../data/db";
import { STORE_CONFIG } from "../config/store";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, "../logs");

// ---------------------------------------------------------------------------
// Anthropic client (used by draft_response tool)
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "vitalize-ecom-ops", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ---------------------------------------------------------------------------
// Tool: list_tools
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_order",
      description:
        "Look up a customer order by order ID or email address. Returns order status, items, tracking info, and delivery date.",
      inputSchema: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID to look up (e.g. '1042')",
          },
          email: {
            type: "string",
            description:
              "Customer email address — returns all orders for this email",
          },
        },
      },
    },
    {
      name: "get_product_info",
      description:
        "Fetch product details, ingredients, dosage, allergens, and FAQs by product ID or name search.",
      inputSchema: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "Exact product ID (e.g. 'VTL-001')",
          },
          name_query: {
            type: "string",
            description:
              "Partial product name to search (e.g. 'omega' or 'magnesium')",
          },
        },
      },
    },
    {
      name: "check_return_eligibility",
      description:
        "Evaluate whether an order is eligible for return or refund based on the return policy, delivery date, and item condition.",
      inputSchema: {
        type: "object",
        properties: {
          order_id: {
            type: "string",
            description: "The order ID to evaluate",
          },
          condition: {
            type: "string",
            enum: [
              "unopened",
              "opened_unused",
              "opened_used",
              "damaged_in_transit",
              "wrong_item_sent",
            ],
            description: "The condition of the item being returned",
          },
        },
        required: ["order_id", "condition"],
      },
    },
    {
      name: "draft_response",
      description:
        "Generate a customer-facing support reply in Vitalize's brand voice. Pass all relevant context — the response is written by Claude using the store's tone guidelines.",
      inputSchema: {
        type: "object",
        properties: {
          customer_name: {
            type: "string",
            description: "Customer's first name for personalization",
          },
          issue_summary: {
            type: "string",
            description:
              "Plain-language summary of the customer's issue(s) to address",
          },
          resolution: {
            type: "string",
            description:
              "What was decided or will happen (e.g. 'full refund issued for order #1038, order #1042 is in transit and expected by...')",
          },
          order_ids: {
            type: "array",
            items: { type: "string" },
            description: "Order IDs referenced in the response",
          },
          tone: {
            type: "string",
            enum: ["empathetic", "informational", "apologetic"],
            description: "Tone to use for this response",
          },
        },
        required: ["customer_name", "issue_summary", "resolution"],
      },
    },
    {
      name: "escalate_to_human",
      description:
        "Flag this conversation for human review. Use when: refund exceeds auto-approve threshold, customer mentions a medical condition or drug interaction, situation is ambiguous, or a tool failure occurred.",
      inputSchema: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Why this is being escalated",
          },
          urgency: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Urgency level for the human reviewer",
          },
          context: {
            type: "object",
            properties: {
              customer_email: { type: "string" },
              order_ids: {
                type: "array",
                items: { type: "string" },
              },
              summary: {
                type: "string",
                description: "Full situation summary for the human reviewer",
              },
            },
            required: ["customer_email", "order_ids", "summary"],
          },
        },
        required: ["reason", "urgency", "context"],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Tool: call_tool dispatcher
// ---------------------------------------------------------------------------

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_order":
        return await handleGetOrder(args as GetOrderArgs);
      case "get_product_info":
        return await handleGetProductInfo(args as GetProductInfoArgs);
      case "check_return_eligibility":
        return await handleCheckReturnEligibility(
          args as CheckReturnEligibilityArgs
        );
      case "draft_response":
        return await handleDraftResponse(args as DraftResponseArgs);
      case "escalate_to_human":
        return await handleEscalateToHuman(args as EscalateToHumanArgs);
      default:
        return errorContent(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorContent(`Tool "${name}" failed: ${message}`);
  }
});

// ---------------------------------------------------------------------------
// Handler: get_order
// ---------------------------------------------------------------------------

interface GetOrderArgs {
  order_id?: string;
  email?: string;
}

async function handleGetOrder(args: GetOrderArgs) {
  if (!args.order_id && !args.email) {
    return errorContent("Provide either order_id or email.");
  }

  if (args.order_id) {
    const order = await getOrderById(args.order_id);
    if (!order) {
      return textContent(
        JSON.stringify({ found: false, order_id: args.order_id })
      );
    }
    return textContent(JSON.stringify({ found: true, order }));
  }

  // email lookup
  const orders = await getOrdersByEmail(args.email!);
  return textContent(
    JSON.stringify({ found: orders.length > 0, count: orders.length, orders })
  );
}

// ---------------------------------------------------------------------------
// Handler: get_product_info
// ---------------------------------------------------------------------------

interface GetProductInfoArgs {
  product_id?: string;
  name_query?: string;
}

async function handleGetProductInfo(args: GetProductInfoArgs) {
  if (!args.product_id && !args.name_query) {
    return errorContent("Provide either product_id or name_query.");
  }

  if (args.product_id) {
    const product = await getProductById(args.product_id);
    if (!product) {
      return textContent(
        JSON.stringify({ found: false, product_id: args.product_id })
      );
    }
    return textContent(JSON.stringify({ found: true, product }));
  }

  const products = await searchProductsByName(args.name_query!);
  return textContent(
    JSON.stringify({ found: products.length > 0, count: products.length, products })
  );
}

// ---------------------------------------------------------------------------
// Handler: check_return_eligibility
// ---------------------------------------------------------------------------

interface CheckReturnEligibilityArgs {
  order_id: string;
  condition:
    | "unopened"
    | "opened_unused"
    | "opened_used"
    | "damaged_in_transit"
    | "wrong_item_sent";
}

async function handleCheckReturnEligibility(
  args: CheckReturnEligibilityArgs
) {
  const order = await getOrderById(args.order_id);
  if (!order) {
    return textContent(
      JSON.stringify({
        eligible: false,
        reason: "Order not found",
        order_id: args.order_id,
      })
    );
  }

  const policy = await getReturnPolicy();

  // Check delivery — can't process a return on an undelivered order
  if (!order.delivered_at) {
    return textContent(
      JSON.stringify({
        eligible: false,
        reason: "Order has not been delivered yet",
        order_id: args.order_id,
        order_status: order.status,
      })
    );
  }

  // Calculate days since delivery
  const deliveredAt = new Date(order.delivered_at);
  const now = new Date();
  const daysSinceDelivery = Math.floor(
    (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Damaged items bypass the return window — always eligible
  const bypassesWindow =
    args.condition === "damaged_in_transit" ||
    args.condition === "wrong_item_sent";

  if (!bypassesWindow && daysSinceDelivery > policy.return_window_days) {
    return textContent(
      JSON.stringify({
        eligible: false,
        reason: `Outside ${policy.return_window_days}-day return window`,
        days_since_delivery: daysSinceDelivery,
        return_window_days: policy.return_window_days,
        order_id: args.order_id,
      })
    );
  }

  // Find the matching condition rule
  const rule = policy.eligible_conditions.find(
    (c) => c.condition === args.condition
  );

  if (!rule || !rule.eligible) {
    return textContent(
      JSON.stringify({
        eligible: false,
        reason: "Condition not eligible for return",
        condition: args.condition,
      })
    );
  }

  // Calculate refund amount
  const refundPct =
    rule.refund_type === "partial" ? (rule.partial_refund_pct ?? 50) / 100 : 1;
  const refundAmount = Math.round(order.total * refundPct * 100) / 100;
  const autoApproved =
    refundAmount <= policy.auto_approve_rules.max_refund_for_auto_approve;

  return textContent(
    JSON.stringify({
      eligible: true,
      order_id: args.order_id,
      condition: args.condition,
      refund_type: rule.refund_type,
      refund_amount: refundAmount,
      currency: STORE_CONFIG.currency,
      auto_approved: autoApproved,
      days_since_delivery: daysSinceDelivery,
      policy_note: rule.notes,
      requires_item_return: !(
        args.condition === "damaged_in_transit" ||
        args.condition === "wrong_item_sent"
      ),
    })
  );
}

// ---------------------------------------------------------------------------
// Handler: draft_response
// ---------------------------------------------------------------------------

interface DraftResponseArgs {
  customer_name: string;
  issue_summary: string;
  resolution: string;
  order_ids?: string[];
  tone?: "empathetic" | "informational" | "apologetic";
}

async function handleDraftResponse(args: DraftResponseArgs) {
  const tone = args.tone ?? "empathetic";
  const orderRef =
    args.order_ids && args.order_ids.length > 0
      ? `Order(s) referenced: ${args.order_ids.join(", ")}.`
      : "";

  const prompt = `Write a customer support email reply for ${STORE_CONFIG.name}.

Customer name: ${args.customer_name}
Issue: ${args.issue_summary}
Resolution: ${args.resolution}
${orderRef}
Tone: ${tone}

Guidelines:
- Open with the customer's first name
- Be warm, clear, and concise — no corporate-speak
- Never give medical advice or comment on health outcomes
- If a refund was issued, confirm the amount and timeline (3–5 business days)
- If an order is in transit, reassure and provide next steps
- Close with an offer to help further and sign off as "${STORE_CONFIG.name} Support"
- Keep it under 150 words`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 400,
    system: `You are a support agent for ${STORE_CONFIG.name} — ${STORE_CONFIG.tagline}. Write helpful, human replies that reflect a clean, wellness-forward brand. Never give medical advice.`,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0]?.type === "text" ? message.content[0].text : "";

  return textContent(JSON.stringify({ draft: text }));
}

// ---------------------------------------------------------------------------
// Handler: escalate_to_human
// ---------------------------------------------------------------------------

interface EscalateToHumanArgs {
  reason: string;
  urgency: "low" | "medium" | "high";
  context: {
    customer_email: string;
    order_ids: string[];
    summary: string;
  };
}

async function handleEscalateToHuman(args: EscalateToHumanArgs) {
  const ticketId = `ESC-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const escalationLog = {
    ticket_id: ticketId,
    timestamp,
    reason: args.reason,
    urgency: args.urgency,
    context: args.context,
  };

  // Write to logs/ so the human review queue has a paper trail
  const logPath = join(LOGS_DIR, `${ticketId}.json`);
  await writeFile(logPath, JSON.stringify(escalationLog, null, 2), "utf-8");

  return textContent(
    JSON.stringify({
      escalated: true,
      ticket_id: ticketId,
      message: `Escalation logged. A ${STORE_CONFIG.name} team member will follow up with ${args.context.customer_email} within 1 business day.`,
      urgency: args.urgency,
    })
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textContent(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorContent(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP servers communicate over stdio — do not write to stdout after connect
}

main().catch((err) => {
  console.error("MCP server crashed:", err);
  process.exit(1);
});
