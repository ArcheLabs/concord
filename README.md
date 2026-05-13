# concord

Concord is the protocol kernel for the Vibly coordination network — a TypeScript-first pnpm monorepo that implements all off-chain coordination logic and connects to on-chain systems (Substrate, EVM) through clean **adapter boundaries**.

> **No HTTP server shipped here.** The REST/SSE network gateway is owned by [`vibly-coordinator`](../vibly-coordinator). The dependency direction is always `vibly-* → concord`.

## Quick start

```bash
pnpm install
pnpm build
pnpm test
pnpm demo    # run the MVP demo loop (SDK CLI, no HTTP server)
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         @concord/sdk                         │
│            createConcord() / createSQLiteConcord()           │
└───────────────────────┬──────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   @concord/core   @concord/state  @concord/governance
   @concord/foundation  @concord/negotiation  …
        │               │               │
        ▼               ▼               ▼
  adapter-substrate-actions  adapter-substrate-indexer
  (on-chain governance txns)  (SubQuery GraphQL queries)
```

## Packages

### Protocol core

| Package | Responsibility |
|---|---|
| `@concord/foundation` | Branded IDs, timestamps, canonical JSON, SHA-256, audit event envelope |
| `@concord/core` | Domain types, schemas, service ports, runtime/gateway interfaces |
| `@concord/state` | In-memory and SQLite event / projection store |
| `@concord/knowledge` | Knowledge candidates, commits, version management |
| `@concord/policy` | Action policy registry and routing |
| `@concord/negotiation` | Delegated fast-vote and structured negotiation |
| `@concord/workflow` | Work items, runtime dispatch, submission, review, aggregation |
| `@concord/adapters` | Mock runtime, script runtime, mock governance/funding gateways |
| `@concord/sdk` | `createConcord()` and `createSQLiteConcord()` facades |

### Extension packages

| Package | Responsibility |
|---|---|
| `@concord/governance` | Governance port interfaces (ActionsPort, IndexFeedPort, IndexQueryPort) |
| `@concord/chain-indexing` | Generic chain-indexing types (ChainCheckpoint, NormalizedChainEvent, IndexCursor) |
| `@concord/external-input` | External input service |
| `@concord/selection` | Selection service, lease management, failover |
| `@concord/reputation` | Reputation evidence service |
| `@concord/incentive` | Incentive service, funding / staking / pricing gateways |
| `@concord/settlement` | Settlement service |
| `@concord/trace` | Protocol tracing, verification, replay |
| `@concord/scenario` | Scenario runner |
| `@concord/invariants` | Invariant checking |
| `@concord/agent-directory` | Agent directory |
| `@concord/trust-registry` | Trust registry |
| `@concord/coordination-view` | Coordination view |
| `@concord/project` | Projects, objectives, boundaries, principals, members |

### Chain adapters

| Package | Responsibility |
|---|---|
| `@concord/adapter-substrate-actions` | `SubstrateGovernanceActionsAdapter` — submits governance transactions to vibly-chain via polkadot-api (PAPI) |
| `@concord/adapter-substrate-indexer` | `SubQueryGovernanceIndexAdapter` — queries vibly-indexer SubQuery GraphQL, implements GovernanceIndexFeedPort + GovernanceIndexQueryPort |
| `@concord/adapters-mock-ledger` | Mock stake-ledger adapter for testing without a live chain |

## SDK extension points

```ts
import { createConcord } from "@concord/sdk";

const concord = createConcord({
  // optional chain adapters
  governanceIndexQuery: subQueryAdapter.query,    // GovernanceIndexQueryPort
  serviceChainActions: mySubstrateActionsAdapter, // ServiceChainActionsPort
});
```

## MVP demo loop

`pnpm demo` drives the full protocol loop:

```
goal → observer → context → action → policy → negotiation → work → runtime → review → knowledge commit → state update
```

With SQLite persistence:

```bash
pnpm --filter @concord/mvp-runner dev -- --db ./data/concord.db
```

With a local script runtime:

```bash
pnpm --filter @concord/mvp-runner dev -- --runtime-script ./examples/runtime.js
```

The script receives a JSON task on stdin and must return:

```json
{
  "submissionDraft": {
    "summary": "completed work",
    "artifacts": [{ "uri": "script://artifact" }]
  },
  "executionReceipt": { "status": "success" }
}
```

## Tracing and scenario tools

```bash
pnpm concord scenario run examples/scenarios/simple-loop.yaml \
  --trace-out traces/simple-loop.trace.json --verify --replay
pnpm concord trace verify traces/simple-loop.trace.json
pnpm concord trace replay traces/simple-loop.trace.json
```

## Design boundaries

The event log is the audit source of truth; state views and action tables are projections; knowledge may only be formalised via `KnowledgeCandidate → KnowledgeCommit → KnowledgeVersion`.

The following concerns are expressed through port interfaces and mock adapters, and are **not** implemented in this monorepo:

- EVM contracts, P2P networking, sybil defence, slash adjudication
- REST/SSE gateway for network coordination (see `vibly-coordinator`)
- Web Console (see `vibly-console`)
- On-chain agent runtimes
- Real OpenGov transactions (provided by `adapter-substrate-actions` after `papi add vibly-solo` codegen)

### Layering invariants

- `@concord/*` packages must not depend on Fastify, Express, or any HTTP framework.
- `concord/apps/*` must not expose HTTP server processes; only CLI / script demos are permitted.
- `concord/*` must not depend on any `vibly-*` package; the dependency arrow is always `vibly-* → concord`.
- Product-namespace identifiers (`coordinator-api`, `vibly-*`, `coordinator-*`) are forbidden inside this repository.
