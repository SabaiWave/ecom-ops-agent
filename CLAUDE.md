# ecom-ops-agent

## What This Is
A portfolio-grade AI agent that handles post-purchase e-commerce customer ops autonomously.
Built to demonstrate Claude + MCP capabilities to potential clients.
Powered by a fictional vitamin/supplement DTC brand called **Vitalize**.
White-label ready — swap `config/store.ts` to rebrand for any client without touching agent logic.

---

## Store Config
All store identity and business rules live in `config/store.ts`:

```ts
export const STORE_CONFIG = {
  name: "Vitalize",
  tagline: "Clean supplements. Real results.",
  currency: "USD",
  supportEmail: "support@vitalize.com",
  returnWindowDays: 30,
  autoApproveRefundUnder: 50, // USD — above this, escalate to human
}
```

---

## Escalation Rules
Agent must escalate (never answer directly) when:
- Customer asks about drug interactions or mentions a medical condition
- Refund value exceeds `autoApproveRefundUnder` in store config
- Order not found after lookup
- Situation is ambiguous or emotionally charged

Escalations must include a structured handoff object:
```ts
{
  reason: string,
  urgency: "low" | "medium" | "high",
  context: {
    customer_email: string,
    order_ids: string[],
    summary: string
  }
}
```

---

## Core Scenario
A customer sends a message like:
> "Hi, I ordered 3 days ago (order #1042) and haven't received a shipping update. I also want to return the item from my previous order (#1038) — it arrived damaged."

The agent must: look up both orders, check return eligibility, make a decision, draft a response, and escalate if needed — without human intervention.

---

## Stack
- Runtime: Node.js
- MCP SDK: @modelcontextprotocol/sdk
- Anthropic SDK: @anthropic-ai/sdk
- Model: claude-sonnet-4-20250514
- Transport: stdio
- Data layer: local JSON files (mocked) — Supabase-ready by design via data/db.ts

---

## Project Structure
```
ecom-ops-agent/
├── CLAUDE.md
├── README.md                    # Portfolio-facing doc
├── .env.example                 # API keys + config (never commit .env)
├── config/
│   └── store.ts                 # Store identity + business rules
├── agent/
│   └── index.ts                 # Agent loop + system prompt
├── server/
│   └── index.ts                 # MCP server + all tool definitions
├── data/
│   ├── db.ts                    # Data abstraction layer — swap JSON for Supabase here only
│   ├── orders.json
│   ├── products.json
│   └── return_policy.json
├── logs/
│   └── .gitkeep
└── scenarios/
    ├── happy_path.json
    ├── damaged_item.json
    ├── medical_question.json
    ├── order_not_found.json
    └── high_value_refund.json
```

---

## The 5 MCP Tools
| Tool | Purpose |
|---|---|
| `get_order` | Look up order by ID or email |
| `get_product_info` | Fetch product details, ingredients, FAQs |
| `check_return_eligibility` | Rules-based return decision logic |
| `draft_response` | Generate customer-facing reply |
| `escalate_to_human` | Flag for human review with structured handoff object |

---

## Data Layer
- `data/db.ts` — single abstraction for all data reads. No other file reads JSON directly.
- `data/orders.json` — mock orders with status, dates, line items, customer email
- `data/products.json` — vitamin/supplement catalog with ingredients, dosage, FAQs
- `data/return_policy.json` — return rules (opened/unopened, damaged, expiry window)

---

## Logging
Every agent run writes a structured log to `logs/`:
```ts
{
  run_id: string,
  timestamp: string,
  input: string,
  tools_called: string[],
  decision: "responded" | "escalated",
  duration_ms: number,
  tokens_used: number,
  output: string
}
```

---

## Error Handling Strategy
Agent must handle gracefully (no crashes):
- Order not found → inform customer + offer alternatives
- Product ID missing → fall back to general product info
- Tool failure → log error, escalate to human with context
- Ambiguous input → ask one clarifying question, do not guess

---

## Conversation State
Input accepts an optional `conversation_id` to support multi-turn flows in v2.
Architecture should not assume single-message context only.

---

## Environment Config
```
ANTHROPIC_API_KEY=
STORE_NAME=Vitalize
LOG_LEVEL=info
```

---

## Scenarios
| File | Tests |
|---|---|
| `happy_path.json` | Order lookup + shipping status, clean response |
| `damaged_item.json` | Return eligibility + auto-approve under threshold |
| `medical_question.json` | Drug interaction question — must escalate |
| `order_not_found.json` | Invalid order ID — graceful error handling |
| `high_value_refund.json` | Refund over threshold — escalate with handoff object |

---

## Build Sequence
1. Initialize project (package.json, tsconfig, folder structure)
2. Create .env.example and config/store.ts
3. Create mock data files with realistic Vitalize products
4. Build data/db.ts abstraction layer
5. Build MCP server with all 5 tools + error handling
6. Build agent loop with system prompt + logging
7. Create all 5 scenario files
8. Test each scenario end to end
9. Write README.md
10. Polish + document for portfolio

---

## Current Status
- [x] Project initialized
- [x] Store config created
- [x] .env.example created
- [x] Mock data created
- [x] db.ts abstraction built
- [x] MCP server built
- [x] Agent loop built
- [x] Logging implemented
- [x] All 5 scenarios tested
- [x] README.md written
- [x] UI layer built (Next.js chat interface)
- [ ] Deployed to Vercel
- [ ] Demo video recorded
- [ ] Portfolio ready

## Phase 2 — UI + Deploy
Adding a Next.js chat interface on top of the existing backend.
Backend logic is untouched. UI is a presentation layer only.

### New Structure
```
ecom-ops-agent/
├── agent/
│   ├── index.ts                  # CLI entry point (unchanged)
│   └── run.ts                    # runAgent() exported as importable function + types
├── ui/                           # Next.js app (standalone)
│   ├── app/
│   │   ├── page.tsx              # Chat interface
│   │   └── api/chat/route.ts     # Streaming API — imports runAgent from agent/run.ts
│   ├── components/
│   │   └── ChatWindow.tsx        # Message bubbles + live tool call feed
│   └── package.json              # Separate Next.js deps
```

### Key architecture decision
`runAgent` is extracted into `agent/run.ts` and accepts an `onToolCall` callback for streaming.
The API route imports it directly — no subprocess spawning, no stdout parsing, full type safety.
`agent/index.ts` (CLI) remains unchanged and imports from `agent/run.ts`.

### UI Goals
- Simple chat window — customer message in, agent response out
- Tool calls shown in real time as they fire (what makes the demo impressive)
- Clean enough to screen record for a 2-minute demo video
- Deploy to Vercel — shareable live URL for client outreach

---

## Portfolio Context
Client-deliverable template built under Sabai Wave (SBW).
Goal: demonstrate measurable ops value — track handle time per scenario in logs.
Target buyers: small e-commerce brands, health/wellness businesses.
Key talking point: white-label ready, Supabase-ready, production architecture from day one.
