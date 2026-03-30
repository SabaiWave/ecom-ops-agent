# Phase 2 Session — README + UI + Deploy

Backend is complete. All 5 scenarios pass. CLAUDE.md is updated with current status.
Read CLAUDE.md first before doing anything.

## What's Done
- Agent loop, MCP server, all 5 tools
- Mock data (Vitalize vitamin/supplement store)
- Structured logging, error handling, escalation logic
- All 5 scenarios tested and passing

## What We're Building Now
Three things, in this order:

### 1. README.md
Portfolio-facing document. Must include:
- What the project is and why it exists (1 short paragraph)
- Architecture diagram (ASCII is fine)
- The 5 MCP tools and what they do
- How to run it locally (setup + example commands)
- Example input/output for the core scenario
- Tech stack badges

### 2. Next.js Chat UI (in /ui)
Simple chat interface on top of the existing backend. Goals:
- Customer types a message, agent responds
- Tool calls shown in real time as they fire (e.g. "🔍 get_order called...", "✅ check_return_eligibility called...")
- Clean, minimal design — this will be screen recorded
- Single API route at /api/chat that streams agent events to the UI

Backend approach:
- Extract `runAgent` from the CLI wrapper as an importable function with an `onToolCall` streaming callback
- The core agent loop is untouched — this is a module boundary change only, not a rewrite
- API route imports `runAgent` directly — no subprocess spawning, no stdout parsing

### 3. Vercel Deploy
- Configure for Next.js monorepo structure
- .env vars set in Vercel dashboard
- Single shareable URL as the output

## How I Want to Work
- One deliverable at a time — README first, then UI, then deploy
- Flag any structural decisions before writing code
- Keep it clean and well-commented — this is a portfolio piece
- Update the checklist in CLAUDE.md as each item is completed

Start with the README.md.
