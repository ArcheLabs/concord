/**
 * @legacy v0.2 keeps this package only as an external governance adapter surface.
 * Core Vibly coordination concepts live in organization, discussion, workflow,
 * mechanism, reputation, and settlement contracts instead of this package.
 */
export type {
  GovernanceBackendKind,
  GovernanceBackendCapabilities,
  GovernanceBackendSourceKind,
  GovernanceBackendSource,
  GovernanceBackendDescriptor,
  GovernanceSubjectRef,
  GovernanceProposalSummary,
  GovernanceVoteStance,
  GovernanceVoteReceipt,
  GovernanceDelegationState,
} from "./types.js";

export {
  defaultSubstrateCapabilities,
  defaultEvmCapabilities,
} from "./types.js";

export type { GovernanceEventType } from "./events.js";

export type {
  GovernanceActionsPort,
  GovernanceQueryPort,
  GovernanceIndexerPort,
  GovernanceIndexFeedPort,
  GovernanceIndexQueryPort,
  ServiceChainActionsPort,
} from "./ports.js";

export type {
  ChainProjectionCursor,
  ProjectionFinality,
  ProjectionSource,
  ProjectionMetadata,
  GovernanceSubjectView,
  GovernanceVoteActivityView,
  GovernanceDelegationView,
  GovernanceCheckpointView,
  GovernanceIntentLinkSource,
  GovernanceIntentLinkConfidence,
  GovernanceIntentChainLink,
  GovernanceMergedStatus,
  GovernanceMergedView,
  GovernanceProjectionPatch,
  GovernanceProjector,
} from "./views.js";
