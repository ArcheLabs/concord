/**
 * Configuration for SubstrateGovernanceActionsAdapter.
 */

export interface SubstrateActionsConfig {
  /**
   * WebSocket endpoint of the Substrate node.
   * @default "ws://127.0.0.1:9944"
   */
  rpcUrl?: string;

  /**
   * A pre-built PolkadotSigner used to sign and submit extrinsics.
   * When omitted, the adapter operates in "prepare-only" mode.
   *
   * Create a signer using polkadot-api/signer:
   *   import { getPolkadotSigner } from "polkadot-api/signer";
   *   // derive keypair via your preferred sr25519 library, then:
   *   const signer = getPolkadotSigner(publicKey, "Sr25519", signFn);
   */
  signer?: import("polkadot-api").PolkadotSigner;

  /**
   * Optional transaction submitter used by local scripts, tests, or generated
   * PAPI bindings. When provided, the adapter delegates signed submission to
   * this function after validating and normalizing the governance payload.
   */
  submitter?: SubstrateTxSubmitter;

  /**
   * A human-readable chain identifier stored in ChainRef.chainId.
   * @default "substrate:vibly-solo"
   */
  chainId?: string;
}

export interface SubstrateTxSubmitInput {
  chain: import("@vibly-ai/concord-core").ChainRef;
  actor: string;
  pallet: string;
  call: string;
  args: unknown;
  payload: unknown;
}

export type SubstrateTxSubmitter = (
  input: SubstrateTxSubmitInput,
) => Promise<import("@vibly-ai/concord-core").TxReceipt>;
