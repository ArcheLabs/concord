/**
 * Public entry-point for @vibly-ai/concord-adapter-substrate-actions.
 *
 * Usage:
 *
 *   import { SubstrateGovernanceActionsAdapter } from "@vibly-ai/concord-adapter-substrate-actions";
 *
 *   const adapter = new SubstrateGovernanceActionsAdapter({
 *     rpcUrl: "ws://127.0.0.1:9944",
 *     signerUri: "//Alice",          // dev account
 *     chainId: "substrate:vibly-solo",
 *   });
 *   concordConfig.governanceActions = adapter;
 */

export { SubstrateGovernanceActionsAdapter } from "./governance.js";
export type { SubstrateActionsConfig } from "./types.js";
