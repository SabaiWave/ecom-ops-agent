# Client Handoff — Clean Up + Deliver

Backend is complete. UI is live. Project is deployed.
This prompt prepares the project for professional client delivery.

Read CLAUDE.md first before doing anything.

## Goal
Transform the dev-state project into something a non-technical client can:
- Understand without a walkthrough
- Run locally if they have a developer
- Hand to their own team to maintain
- See clearly what they paid for

## What We're Doing

### 1. Code Audit
Review all files for:
- Hardcoded values that should be in config or .env
- Console.log statements left over from debugging (remove or replace with logger)
- Any TODOs or placeholder comments — resolve or document them
- Inconsistent naming conventions — clean up
Report findings before making changes.

### 2. Final CLAUDE.md Update
- Mark all checklist items complete
- Add a "Handoff Notes" section with:
  - How to swap to a real database (Supabase migration path)
  - How to connect a real email/helpdesk system
  - Known limitations
  - Suggested v2 features

### 3. Client-Facing README
Current README is developer-facing. Add a section at the top called:
## For [Client Name]
Include:
- What this system does in plain English (no jargon)
- What the agent can handle autonomously
- What it escalates to your team and why
- How to update products, orders, and return policy
- Who to contact for changes (Sabai Wave / SBW contact info placeholder)

### 4. Handoff Document (HANDOFF.md)
Create a new file `HANDOFF.md` with:
- Project summary (1 paragraph)
- Live URL (Vercel deployment link)
- How to run locally (copy from README, simplified)
- Environment variables needed and where to get them
- How to rebrand for a different store (point to config/store.ts)
- Maintenance notes (what needs updating as real orders come in)
- SBW contact + next engagement options (v2 features, support retainer)

### 5. .gitignore Audit
Confirm these are never committed:
- .env
- logs/*.json (keep .gitkeep)
- node_modules
- .next (UI build artifacts)

### 6. Final Smoke Test
Run all 5 scenarios one last time on the deployed Vercel URL.
Confirm everything passes in production, not just local.
Document results in HANDOFF.md.

## How I Want to Work
- Audit first, changes second — report before touching anything
- HANDOFF.md is the primary deliverable of this session
- Write for a non-technical reader — no jargon in client-facing docs
- Flag anything that looks unfinished or unprofessional

## Deliverable
- Clean codebase ready for GitHub (public or client-private repo)
- HANDOFF.md ready to send to client
- All 5 scenarios passing on live Vercel URL
- Project ready to present as a portfolio piece
