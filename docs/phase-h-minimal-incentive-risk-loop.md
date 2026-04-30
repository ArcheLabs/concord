# Phase H: Minimal Incentive / Risk Loop

Phase H adds the smallest reward, reputation, slash, and Guardian-risk loop on top of the Phase F/G collaboration demo.
The default settlement path is the coordinator mock ledger. Vibly chain settlement is intentionally left as a later handoff.

## Scope

- `POST /phase-h/smoke` creates a repeatable dev-only run.
- `GET /phase-h/runs` lists Phase H run projections.
- `GET /projects/:projectId/phase-h/overview` summarizes rewards, ledger, reputation evidence, slash requests, and Guardian risk state.
- `GET /reputation/evidence` exposes typed reputation evidence instead of relying on recent event windows.
- `GET /slash-requests` exposes the minimal slash request read model.

## Smoke Flow

1. Ensure or run the Phase F collaboration smoke.
2. Create a reward intent for accepted work.
3. Reserve funding through the mock ledger.
4. Mark the reward claimable because review aggregation accepted the work.
5. Record positive reputation evidence for accepted work.
6. Record slash evidence for a minimal risk sample.
7. Create and complete a Guardian-visible slash/risk request.
8. Publish Phase H timeline events through the existing project SSE stream.

## Local Validation

```bash
ENABLE_DEV_ROUTES=true pnpm dev
curl -X POST -H "Authorization: Bearer dev-token" http://localhost:8787/phase-h/smoke
curl -H "Authorization: Bearer dev-token" http://localhost:8787/phase-h/runs
curl -H "Authorization: Bearer dev-token" http://localhost:8787/projects/project_phase-f-collaboration/phase-h/overview
curl -H "Authorization: Bearer dev-token" http://localhost:8787/reputation/evidence?projectId=project_phase-f-collaboration
curl -H "Authorization: Bearer dev-token" http://localhost:8787/slash-requests?projectId=project_phase-f-collaboration
```

CLI validation:

```bash
vibly phase-h smoke
vibly phase-h runs
vibly phase-h status --project-id project_phase-f-collaboration
```

## Acceptance

- A completed Phase H smoke produces a `claimable` reward intent with mock funding receipt.
- Claimable reward status is backed by accepted work/review evidence.
- Reputation evidence includes both positive accepted-work evidence and slash/risk evidence.
- Slash request includes evidence and Guardian visibility.
- Console shows reward, reputation, slash, Guardian, ledger, and timeline updates without manual refresh when SSE is available.
- Client can run the smoke and fetch status from coordinator.

## Limitations

- Mock ledger is the only Phase H settlement path.
- Slash requests are read-model evidence and Guardian-visible risk records, not real economic slashing.
- Reputation evidence is recorded and displayed; final protocol scoring and staking economics are out of scope.
- Production wallet/session/key management remains out of scope before testnet.
