# Phase G: Human-Observable Console

Phase G turns the Phase F collaboration smoke into a live, human-readable Console experience.
The Console remains a coordinator client: it does not call chain RPC, Concord SDK, or agent runtimes directly.

## Scope

- Coordinator exposes Phase G overview and timeline read models:
  - `GET /projects/:projectId/phase-g/overview`
  - `GET /projects/:projectId/phase-g/timeline`
- Coordinator publishes live project events through the existing SSE stream:
  - `GET /projects/:projectId/stream`
- Console subscribes to project SSE by default on project pages, then updates React Query views and local timeline panels.
- Phase F smoke is the first complete observable path: observe, action, guardian, negotiate, work, review, knowledge.

## Local Smoke

Start coordinator with dev routes enabled:

```bash
ENABLE_DEV_ROUTES=true pnpm dev
```

Run the Phase F smoke:

```bash
curl -X POST -H "Authorization: Bearer dev-token" http://localhost:8787/phase-f/smoke
curl -H "Authorization: Bearer dev-token" http://localhost:8787/projects/project_phase-f-collaboration/phase-g/overview
curl -H "Authorization: Bearer dev-token" http://localhost:8787/projects/project_phase-f-collaboration/phase-g/timeline
```

In Console, open the project dashboard or `/projects/:projectId/timeline`.
New `PhaseGTimelineUpdated`, Guardian, trace, work, and Phase F completion events should update the UI without a manual refresh.

## Acceptance

- A human can see who acted, what changed, why it changed, and which event or trace explains it.
- Dashboard shows live status, Phase F run count, Guardian request count, timeline count, and latest activity.
- Timeline shows the collaboration sequence in human language.
- Agent activity shows Observer, Delegate, Worker, Reviewer, and Guardian roles with their latest action.
- Guardian and governance views explain risk, readback, backend capability, and freshness from coordinator read models.
- Trace detail shows a readable replay timeline in addition to raw JSON.

## Limitations

- SSE is process-local through coordinator `eventBus`; it is not a clustered durable stream.
- If SSE is unavailable, Console keeps manual refresh and can be extended with light polling.
- Phase G does not add production wallet/session/key management.
- Phase G does not make Guardian decisions on behalf of humans.

## Phase H Handoff

Phase H can build on the same observable surface for reward, reputation, slash, and risk events.
Before Phase H starts, Phase G should make those future event types easy to map into timeline entries and human request panels.
