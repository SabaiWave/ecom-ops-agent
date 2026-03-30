/**
 * Store Configuration — Vitalize
 *
 * Central place for all store identity and business rule constants.
 * To white-label for a new client: edit this file only.
 * Agent logic, tools, and prompts read from here — nothing is hardcoded elsewhere.
 */

export const STORE_CONFIG = {
  // Brand identity
  name: "Vitalize",
  tagline: "Clean supplements. Real results.",
  supportEmail: "support@vitalize.com",
  currency: "USD",

  // Return & refund rules
  returnWindowDays: 30,           // How many days after delivery a return is allowed
  autoApproveRefundUnder: 50,     // USD — refunds at or below this are auto-approved

  // Escalation triggers (agent checks these before responding)
  escalationKeywords: [
    "drug interaction",
    "medication",
    "doctor",
    "prescription",
    "medical condition",
    "pregnant",
    "allergy",
    "side effect",
  ],
} as const;

export type StoreConfig = typeof STORE_CONFIG;
