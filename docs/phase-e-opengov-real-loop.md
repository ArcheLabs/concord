# Phase E OpenGov Real Loop Runbook

Phase E validates the primary governance path:

1. Concord/coordinator creates a governance intent.
2. `vibly-coordinator` submits the intent through `@concord/adapter-substrate-actions`.
3. `vibly-chain` solo-node emits OpenGov events.
4. `vibly-indexer` reads referenda, votes, and checkpoints.
5. Coordinator projector exposes typed and merged governance views.
6. Client/Console explain the result only through coordinator APIs.

## Local Services

Start a Vibly solo-node, then start `vibly-indexer` against it. Start coordinator with:

```bash
GOVERNANCE_BACKENDS=substrate-local \
SUBSTRATE_INDEXER_URL=http://localhost:3010/graphql \
SUBSTRATE_CHAIN_ID=substrate:vibly-solo \
SUBSTRATE_RPC_URL=ws://127.0.0.1:9944 \
SUBSTRATE_GOVERNANCE_TX_MODE=fixture \
pnpm dev
```

`fixture` mode records transaction-shaped receipts for repeatable local smoke. Real submission requires a generated PAPI submitter or unsafe PAPI signer wiring; production wallet/session management is intentionally out of scope.

## Smoke

From `vibly-coordinator`:

```bash
COORDINATOR_URL=http://127.0.0.1:8787 \
API_TOKEN=dev-token \
./scripts/phase-e-smoke.sh
```

After the indexer sees the on-chain referendum, rerun with:

```bash
SUBJECT_EXTERNAL_ID=<referendumIndex> ./scripts/phase-e-smoke.sh
```

Then submit a vote through the coordinator:

```bash
curl -fsS -X POST "http://127.0.0.1:8787/governance/subjects/<subjectId>/vote-opengov" \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  --data '{"voter":"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY","stance":"aye","weight":"2000000000","conviction":1}'
```

Verify:

```bash
curl -fsS -H "Authorization: Bearer dev-token" \
  "http://127.0.0.1:8787/governance/merged?backend=substrate-opengov"
```

Expected merged view fields include `actionReceipts`, `submitReceipt`, `voteReceipts`, `readback.pending`, `readback.linked`, `readback.linkedSubjectId`, and `readback.voteReadbackStatus`.

## Client and Console

Client verification:

```bash
vibly governance submit-opengov <intentId> --actor <account>
vibly governance reconcile <intentId> --external-id <referendumIndex>
vibly governance vote-opengov <subjectId> --voter <account> --stance aye --weight 2000000000
vibly governance merged --backend substrate-opengov
```

Console remains read-only for chain state. It uses coordinator merged views to show backend freshness, submit receipt/readback state, linked subject, and vote readback status.

## Known Limitations

- Phase E does not implement production key management, wallet sessions, or Console signing.
- Real referenda submission still depends on generated PAPI submitter wiring or the unsafe PAPI path being configured with a signer.
- `vibly-indexer` vote mapping depends on Substrate event payload shape; it now handles lower-case and PascalCase enum variants for vote kinds.
- Delegation readback remains lower fidelity than proposal/vote readback because current events do not carry all delegation call arguments.
- EVM Governor remains a fixture/demo backend, not a Phase E product path.

## Phase F Handoff

Phase F can start once this checklist is repeatable on a developer machine:

- A governance intent is submitted through coordinator OpenGov routes.
- Indexer emits a matching `GovernanceSubject` and checkpoint.
- Reconciliation links the intent to the indexed subject.
- A vote receipt is recorded and later matched by indexed vote activity.
- Client and Console explain the loop without direct chain/indexer reads from Console.
