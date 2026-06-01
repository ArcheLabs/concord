# Phase D-min Kit Boundary Decision Note

## Decision

Phase D-min keeps the shared surface thin and governance-scoped. The stable contracts remain in `@vibly-ai/concord-governance` and the projection port remains in `@concord/coordination-view`; no new `@concord/surface-contracts`, `client-kit`, `coordinator-kit`, or `console-kit` package is introduced in this phase.

## Stable Enough To Share

- `GovernanceBackendDescriptor` and `GovernanceBackendCapabilities`.
- `GovernanceSubjectView`, `GovernanceVoteActivityView`, `GovernanceDelegationView`, `GovernanceCheckpointView`, `GovernanceIntentChainLink`, and `GovernanceMergedView`.
- `ProjectionMetadata`, `ProjectionFinality`, `ProjectionSource`, and `GovernanceProjectionPatch`.
- Backend status and vote stance normalization at the adapter boundary.

These contracts are used to connect Substrate OpenGov and the EVM Governor fixture without requiring coordinator, console, or client runtime imports.

## Still Backend-Specific

- Signer and transaction submission: PAPI/Substrate and EVM wallet clients remain separate.
- Proposal preparation payloads, vote payloads, execution queueing, and execution calls.
- Index sources: SubQuery for Substrate, fixture feed for EVM in Phase D-min.
- UI actions: Console may display capability-aware read-only state, but does not own a wallet abstraction.

## Surface Contracts

Phase D-min does not extract generic HTTP contracts such as `ApiResponse<T>`, `ApiListResponse<T>`, `ApiError`, `PageInput`, or `Page<T>`. A code search did not show a shared, repeated contract surface across the Phase D packages that justifies a new package yet. Coordinator, Console, and Client can continue using their local HTTP envelope helpers until duplication appears across at least two consumers.

## Phase E Readiness

Phase E should revisit `@concord/surface-contracts` only after all of the following are true:

1. Coordinator and at least one external app share the same API envelope and pagination contract.
2. Substrate and EVM adapters duplicate status, checkpoint, or projection helpers beyond small local mappings.
3. Console and Client both consume backend descriptors and capabilities in a stable way.
4. The duplicated code is stable enough to publish without pulling in app runtime dependencies.

Until then, the practical kit boundary is the existing `@vibly-ai/concord-governance` contract surface plus narrowly scoped adapter packages.
