# M8 Invariants

Protocol invariants make Concord's coordination rules executable. They check that actions pass policy, work is reviewed, formal knowledge goes through commits, and coordinator behavior does not bypass protocol authority.

Verify a trace:

```bash
pnpm concord trace verify traces/simple-loop.trace.json
```

Expected output:

```txt
Trace: trace_simple-loop
Events: 21
Invariants: 26 passed, 0 failed, 7 warnings
Result: PASS
```

Important invariants include:

- `action.policy.required`
- `action.no-work-without-policy`
- `context.submission.requires-receipt`
- `knowledge.commit.requires-decision`
- `work.submission-has-execution-receipt`
- `work.accepted-requires-review`
- `coordinator.no-policy-bypass`

Common failures:

- Work exists without a `PolicyDecision`.
- Submission lacks `ContextReceipt` or `ExecutionReceipt`.
- Knowledge commit references a missing `DecisionRecord`.
- Accepted work has no review target.
