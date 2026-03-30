/**
 * ui/lib/agent.ts — Re-export of the backend agent runner
 *
 * This file exists solely to give the UI a clean import path to the backend.
 * All logic lives in agent/run.ts — nothing is duplicated here.
 */

export { runAgent } from "../../agent/run";
export type { RunLog, RunAgentOptions } from "../../agent/run";
