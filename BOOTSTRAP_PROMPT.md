# Session Bootstrap — ecom-ops-agent

I'm building a portfolio-grade e-commerce ops agent using Claude + MCP.
Full context is in CLAUDE.md — please read that first before doing anything.

## Store

Fictional vitamin/supplement DTC brand called **Vitalize**.
All store details live in `config/store.ts` — designed to be white-labeled for real clients.

## Where We Are

Where We Are
Project folder exists. CLAUDE.md is in root. Nothing else exists yet.

Before starting the build sequence, run these setup commands first:
bashnpm init -y
npm install @anthropic-ai/sdk @modelcontextprotocol/sdk
npm install -D typescript tsx @types/node
npx tsc --init

Installed packages:

- @anthropic-ai/sdk
- @modelcontextprotocol/sdk
- typescript, tsx, @types/node (dev)

## What We're Doing This Session

Follow the build sequence in CLAUDE.md exactly, one step at a time:

1. Initialize project structure (tsconfig, folder scaffolding)
2. Create .env.example and config/store.ts
3. Create mock data files with realistic Vitalize vitamin/supplement products
4. Build data/db.ts abstraction layer
5. Build MCP server with all 5 tools + error handling
6. Build agent loop with system prompt + logging
7. Create all 5 scenario files
8. Test each scenario end to end
9. Write README.md

## How I Want to Work

- One step at a time — don't jump ahead
- Explain what each piece does and why before writing it
- Flag decision points before writing code
- Well-commented code throughout — this is a portfolio piece
- Update the checklist in CLAUDE.md as we complete each step
- No mock data shortcuts — products, orders, and scenarios should feel like a real vitamin brand

Start with step 1: project structure initialization.
