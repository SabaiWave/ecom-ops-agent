# ecom-ops-agent

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4-D97757?style=flat-square&logo=anthropic&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-1.28-black?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)

An AI agent that handles post-purchase e-commerce customer support autonomously — order lookups, return eligibility checks, refund decisions, and human escalations — without a human in the loop. Built with Claude + MCP as a white-label template for small e-commerce brands.

Powered by a fictional vitamin/supplement brand called **Vitalize**. Swap `config/store.ts` to rebrand for any client without touching agent logic.

---

## Architecture

```
Customer message
      │
      ▼
┌─────────────────────────────────┐
│         Agent Loop              │  agent/index.ts
│  Claude claude-sonnet-4-20250514│
│  • Reads system prompt          │
│  • Decides which tools to call  │
│  • Loops until resolved         │
└────────────┬────────────────────┘
             │ stdio (MCP protocol)
             ▼
┌─────────────────────────────────┐
│         MCP Server              │  server/index.ts
│  5 tools exposed over stdio     │
└──┬──┬──┬──┬──┬──────────────────┘
   │  │  │  │  │
   │  │  │  │  └─ escalate_to_human → logs/ESC-*.json
   │  │  │  └──── draft_response   → Claude API (brand voice)
   │  │  └─────── check_return_eligibility
   │  └────────── get_product_info
   └───────────── get_order
                       │
                       ▼
             ┌─────────────────┐
             │   data/db.ts    │  single data abstraction layer
             └──┬──┬──┬────────┘
                │  │  │
                │  │  └── return_policy.json
                │  └───── products.json
                └───────── orders.json
```

Every run writes a structured log to `logs/run-*.json`.

---

## The 5 MCP Tools

| Tool | Purpose |
|---|---|
| `get_order` | Look up order by ID or customer email |
| `get_product_info` | Fetch product details, ingredients, dosage, FAQs |
| `check_return_eligibility` | Rules-based return decision — checks window, condition, and auto-approve threshold |
| `draft_response` | Calls Claude to write a customer-facing reply in Vitalize's brand voice |
| `escalate_to_human` | Logs a structured handoff object for human review |

### Escalation triggers
The agent escalates automatically (never guesses) when:
- Customer mentions a drug interaction, medication, or medical condition
- Refund exceeds the auto-approve threshold (`$50` by default in `config/store.ts`)
- Order cannot be found after lookup
- Situation is ambiguous or emotionally charged

---

## Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (ESM, `module: nodenext`)
- **AI:** Anthropic SDK — `claude-sonnet-4-20250514`
- **Agent protocol:** Model Context Protocol (MCP) over stdio
- **Data:** Local JSON files — Supabase-ready via `data/db.ts`

---

## Project Structure

```
ecom-ops-agent/
├── config/
│   └── store.ts              # Brand identity + business rules (edit to white-label)
├── agent/
│   └── index.ts              # Agent loop, system prompt, CLI entry point, logging
├── server/
│   └── index.ts              # MCP server with all 5 tool definitions
├── data/
│   ├── db.ts                 # Data abstraction layer — swap for Supabase here only
│   ├── orders.json           # Mock orders
│   ├── products.json         # Vitalize supplement catalog
│   └── return_policy.json    # Return eligibility rules
├── scenarios/                # Test inputs for each scenario type
├── logs/                     # Structured run logs (gitignored except .gitkeep)
├── .env.example
└── CLAUDE.md                 # Full project spec + build context
```

---

## Local Setup

**Prerequisites:** Node.js 20+, an Anthropic API key

```bash
# 1. Clone and install
git clone <repo-url>
cd ecom-ops-agent
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 3. Run the default scenario (core scenario from CLAUDE.md)
npm run agent
```

---

## Running Scenarios

```bash
# Core scenario — shipping inquiry + damaged item return
npm run agent

# Run a specific scenario file
npm run agent -- --scenario scenarios/damaged_item.json
npm run agent -- --scenario scenarios/medical_question.json
npm run agent -- --scenario scenarios/high_value_refund.json
npm run agent -- --scenario scenarios/order_not_found.json
npm run agent -- --scenario scenarios/happy_path.json

# Pass a message directly
npm run agent -- --message "I need to return order #1038"
```

---

## Example: Core Scenario

**Input**
```
Hi, I ordered 3 days ago (order #1042) and haven't received a shipping update.
I also want to return the item from my previous order (#1038) — it arrived damaged.
```

**Tool chain**
```
get_order → get_order → check_return_eligibility → draft_response
```

**Output**
```
Hi Maya,

Your order #1042 is currently in transit with UPS (last checked in at Dallas, TX).
Tracking number: 1Z999AA10123456784 — you should see it arrive in the next few days.

For order #1038, I've processed a full $28.00 refund for the damaged Magnesium Glycinate.
No need to send it back. Your refund will appear within 3–5 business days.

Is there anything else I can help you with?

Vitalize Support
```

**Run log** (`logs/run-*.json`)
```json
{
  "run_id": "run-1774478868891",
  "decision": "responded",
  "tools_called": ["get_order", "get_order", "check_return_eligibility", "draft_response"],
  "duration_ms": 21404,
  "tokens_used": 9906
}
```

---

## Scenario Coverage

| Scenario | Tests | Expected decision |
|---|---|---|
| `happy_path` | Delivered order status inquiry | `responded` |
| `damaged_item` | Shipping update + damaged return under threshold | `responded` |
| `medical_question` | Drug interaction question | `escalated` |
| `order_not_found` | Invalid order ID | `escalated` |
| `high_value_refund` | Unopened return over $50 threshold | `escalated` |

---

## White-Labeling

All brand identity and business rules live in one file:

```ts
// config/store.ts
export const STORE_CONFIG = {
  name: "Vitalize",
  tagline: "Clean supplements. Real results.",
  supportEmail: "support@vitalize.com",
  currency: "USD",
  returnWindowDays: 30,
  autoApproveRefundUnder: 50,
  escalationKeywords: ["drug interaction", "medication", ...],
}
```

Swap these values and the agent, tools, and prompts all update automatically.

---

## Supabase Migration

The data layer is isolated to `data/db.ts`. Every function (`getOrderById`, `getOrdersByEmail`, `getProductById`, etc.) can be replaced with a Supabase query without touching the MCP server or agent logic.

---

*Built by [Sabai Wave](https://sabaiwave.com) as a client-deliverable template for e-commerce brands.*
