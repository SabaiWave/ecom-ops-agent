# New Vertical — Rebuild for [CLIENT / INDUSTRY]

This project was originally built for Vitalize, a fictional vitamin/supplement DTC brand.
The architecture is white-label ready. This prompt rebuilds it for a new client or vertical.

Read CLAUDE.md first before doing anything.

## What Changes
Only two things change when switching verticals:
1. `config/store.ts` — store identity and business rules
2. `data/` — products, orders, and return policy for the new vertical

Everything else — agent logic, MCP tools, UI, logging — stays identical.

## New Client Details
Fill these in before running this prompt:

```
Client/Brand Name: _______________
Industry: _______________
Product Types: _______________
Support Email: _______________
Return Window (days): _______________
Auto-approve Refunds Under ($): _______________
Any escalation rules specific to this industry: _______________
```

## What We're Doing
Rebuild the data layer and store config for the new vertical, in this order:

### 1. Update config/store.ts
Swap all Vitalize-specific values for the new client details above.
Keep the STORE_CONFIG structure identical — only values change.

### 2. Rebuild data/orders.json
Generate 8-10 realistic mock orders for this vertical.
Orders must include a mix of:
- Pending, shipped, delivered statuses
- Various product line items from the new catalog
- At least one damaged/problem order
- At least one high-value order (above auto-approve threshold)

### 3. Rebuild data/products.json
Generate 6-8 realistic products for this vertical.
Each product must include:
- Name, SKU, price, description
- FAQs specific to this product type
- Any industry-specific fields (ingredients, materials, sizing, etc.)

### 4. Rebuild data/return_policy.json
Adapt return rules to this industry's norms.
Keep the same schema — only values and edge cases change.

### 5. Update scenarios/
Rewrite all 5 scenario files with industry-appropriate content.
Same scenario types (happy path, damaged item, etc.) — new product/order context.

### 6. Smoke Test
Run all 5 scenarios end to end.
Confirm agent reasoning makes sense for the new vertical.
Flag anything that feels off for human review.

## How I Want to Work
- Fill in client details above before starting
- One file at a time — don't jump ahead
- Keep mock data feeling realistic, not generic
- Do not touch agent logic, MCP tools, or UI
- Update CLAUDE.md checklist when done

## Deliverable
A fully rebranded instance of ecom-ops-agent ready to demo for the new client.
