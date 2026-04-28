# vibly-ascf

ASCF / Vibly prototype implemented as a TypeScript-first pnpm monorepo.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm demo
pnpm api
```

The first production-shaped target is a local SQLite-backed coordinator, an SDK facade, a deterministic CLI runner, and a Fastify API. Real OpenGov, EVM, P2P, and Vibly Chain integrations are adapter boundaries for later phases.

## Packages

- `@ascf/foundation`: branded IDs, timestamps, canonical JSON, stable SHA-256 hashing, and audit event envelopes.
- `@ascf/core`: ASCF domain types, schemas, service ports, runtime/gateway interfaces.
- `@ascf/state`: memory and SQLite event/projection stores.
- `@ascf/knowledge`: versioned knowledge candidates, commits, and versions.
- `@ascf/policy`: action policy registry and policy decision routing.
- `@ascf/negotiation`: delegate fast vote and simple structured negotiation.
- `@ascf/workflow`: work orders, runtime dispatch, submissions, reviews, and aggregation.
- `@ascf/adapters`: mock runtime, script runtime, mock funding/governance, simple coordinator, store re-exports.
- `@ascf/sdk`: `createASCF()` and `createSQLiteASCF()` facade.

## MVP Loop

`pnpm demo` runs:

```txt
goal -> observer -> context -> action -> policy -> negotiation -> work -> runtime -> review -> knowledge commit -> state update
```

Use SQLite persistence:

```bash
pnpm --filter @ascf/mvp-runner dev -- --db ./data/ascf.db
```

Use a local script runtime:

```bash
pnpm --filter @ascf/mvp-runner dev -- --runtime-script ./examples/runtime.js
```

The script receives JSON on stdin and returns JSON shaped like:

```json
{
  "submissionDraft": {
    "summary": "completed work",
    "artifacts": [{ "uri": "script://artifact" }]
  },
  "executionReceipt": { "status": "success" }
}
```

## HTTP API

Start the coordinator:

```bash
ASCF_DB=./data/ascf.db pnpm api
```

Useful endpoints:

- `GET /health`
- `POST /loop/run-once`
- `POST /actors`
- `POST /goals`
- `POST /context-bundles`
- `POST /actions`
- `POST /actions/:id/evaluate`
- `POST /work-orders/:id/claim`
- `POST /work-orders/:id/submit`
- `POST /reviews`
- `GET /events`
- `GET /state/latest`
- `GET /knowledge/latest`

Example:

```bash
curl -X POST http://localhost:3000/loop/run-once
curl http://localhost:3000/state/latest
```

## Current Boundaries

This prototype intentionally does not implement real OpenGov, EVM contracts, P2P networking, Vibly Chain, Web Console, complex reputation, slash adjudication, or sybil resistance. Those systems are represented by ports and mock adapters so they can be replaced without changing SDK core dependencies.

The event log is the audit source. State views and operational tables are projections. Knowledge becomes formal only through `KnowledgeCandidate -> KnowledgeCommit -> KnowledgeVersion`.
