/**
 * agent/index.ts — CLI entry point
 *
 * Thin wrapper around runAgent(). Handles argument parsing, prints results,
 * and passes a console logger as the onToolCall callback.
 *
 * For the importable function used by the UI, see agent/run.ts.
 *
 * Usage:
 *   npm run agent
 *   npm run agent -- --message "your message here"
 *   npm run agent -- --scenario scenarios/damaged_item.json
 */

import { readFileSync } from "fs";
import { runAgent } from "./run";
import { STORE_CONFIG } from "../config/store";

interface ScenarioFile {
  description?: string;
  message: string;
  conversation_id?: string;
}

async function main() {
  const args = process.argv.slice(2);

  let message: string;
  let conversationId: string | null = null;

  const scenarioIdx = args.indexOf("--scenario");
  if (scenarioIdx !== -1) {
    const scenarioPath = args[scenarioIdx + 1];
    if (!scenarioPath) {
      console.error("--scenario requires a file path");
      process.exit(1);
    }
    const scenario = JSON.parse(
      readFileSync(scenarioPath, "utf-8")
    ) as ScenarioFile;
    message = scenario.message;
    conversationId = scenario.conversation_id ?? null;
    console.log(`\nScenario: ${scenario.description ?? scenarioPath}`);
  } else {
    const msgIdx = args.indexOf("--message");
    message =
      msgIdx !== -1
        ? (args[msgIdx + 1] ?? "")
        : "Hi, I ordered 3 days ago (order #1042) and haven't received a shipping update. I also want to return the item from my previous order (#1038) — it arrived damaged.";
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`${STORE_CONFIG.name} Ops Agent`);
  console.log(`${"─".repeat(60)}`);
  console.log(`\nCustomer message:\n"${message}"\n`);

  try {
    const log = await runAgent(message, {
      conversationId,
      onToolCall: (toolName) => console.log(`  [tool] ${toolName}`),
    });

    console.log(`\n${"─".repeat(60)}`);
    console.log(`Decision: ${log.decision.toUpperCase()}`);
    console.log(`Tools called: ${log.tools_called.join(" → ")}`);
    console.log(`Tokens: ${log.tokens_used.toLocaleString()} | Time: ${log.duration_ms}ms`);
    console.log(`${"─".repeat(60)}`);
    console.log(`\nDraft response:\n`);
    console.log(log.output);
    console.log(`\nRun log: logs/${log.run_id}.json`);
  } catch (err) {
    console.error("\nAgent error:", err);
    process.exit(1);
  }
}

main();
