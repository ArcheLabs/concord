# Phase F Test Agent Collaboration Loop Runbook

Phase F validates a repeatable scripted agent collaboration loop:

1. Observer submits an observation and proposes a high-risk action.
2. Delegate and Guardian participate in structured negotiation.
3. Coordinator creates a work order.
4. Worker claims, executes, and submits a deterministic artifact.
5. Reviewer submits review and aggregation accepts the work.
6. Guardian request/completion, protocol trace, verify, replay, and key invariants are observable.

## Local Smoke

Start coordinator with dev routes enabled:

```bash
cd /home/libingjiang/vibly-coordinator
ENABLE_DEV_ROUTES=true API_AUTH_MODE=static-token API_TOKENS=dev-token pnpm dev
```

Run the smoke:

```bash
curl -fsS -X POST "http://127.0.0.1:8787/phase-f/smoke" \
  -H "Authorization: Bearer dev-token"
```

Expected result:

- `run.action.riskLevel` is `high`.
- `run.negotiation.status` is `converged`.
- `run.workOrder.status` is `accepted`.
- `run.reviewAggregation.result` is `accepted`.
- `run.guardianRequest.status` is `approved`.
- `run.verification.ok` and `run.replay.ok` are `true`.

## Client Verification

```bash
vibly phase-f smoke
vibly phase-f runs
vibly trace verify trace_phase_f_smoke
vibly trace replay trace_phase_f_smoke
```

## Console Verification

Open the Phase F project in Console and navigate to:

- `/projects/<projectId>/phase-f` for smoke runs, trace status, and guardian request rows.
- `/projects/<projectId>/agents` for the five seeded roles.
- `/projects/<projectId>/work` for accepted work orders.
- `/projects/<projectId>/reviews` for review records.
- `/projects/<projectId>/guardian` for high-risk request visibility.
- `/projects/<projectId>/traces` for the recorded trace.

Console only calls coordinator APIs. It does not run agents or infer protocol state locally.

## Automated Coverage

```bash
cd /home/libingjiang/concord
pnpm --filter @concord/scenario test

cd /home/libingjiang/vibly-coordinator
pnpm test -- src/modules/phase-f/routes.test.ts
pnpm lint
```

The coordinator test verifies the full smoke loop, trace snapshots, trace verify/replay, and core invariants including policy, work, and knowledge checks.

## Known Limitations

- The runtime is scripted and deterministic; there is no production agent sandbox, worker pool, or scheduler.
- Guardian handling is an observable request/completion path, not a full approval product.
- The smoke uses coordinator dev routes and should not be enabled for production deployments.
- Phase F does not require real OpenGov writes; Phase E remains the real governance loop.
- Console intentionally stays lightweight and does not implement the explanatory timeline planned for Phase G.

## Phase G Handoff

Phase G can start when:

- The five test-agent roles can be seeded repeatedly.
- A complete action reaches accepted work and review aggregation.
- High-risk action handling is observable through Guardian request records.
- Trace verify/replay passes for the smoke loop.
- Client and Console can inspect the run without direct SDK or chain access.
