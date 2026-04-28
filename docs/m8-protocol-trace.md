# M8 Protocol Trace

Protocol Trace is Concord's JSON artifact for one collaboration run. It records ordered events, materialized snapshots, final state hashes, scenario metadata, and optional verification results.

It exists so a run can be audited and replayed without trusting a live coordinator.

Run a scenario and write a trace:

```bash
pnpm concord scenario run examples/scenarios/simple-loop.yaml \
  --trace-out traces/simple-loop.trace.json \
  --verify \
  --replay
```

Expected output:

```txt
Scenario: simple-loop
Events: 21
Trace: traces/simple-loop.trace.json
Verify: PASS
Replay: PASS
Result: PASS
```

Common failures:

- `event.hash.invalid`: an event was mutated after creation or the trace file was edited.
- `trace.replay.event_root_mismatch`: replayed events no longer match the final trace state.
- `event.causation.missing`: an event points to a causation event that does not exist earlier in the trace.
