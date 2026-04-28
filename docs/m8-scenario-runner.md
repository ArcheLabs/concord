# M8 Scenario Runner

The scenario runner is the developer entry point for Concord demos and regression tests. A YAML file declares actors, goal, initial knowledge, policies, loop steps, and expected invariants.

Run the Polkadot adoption scenario:

```bash
pnpm concord scenario run examples/scenarios/polkadot-adoption.yaml \
  --trace-out traces/polkadot-adoption.trace.json \
  --verify \
  --replay
```

Expected output:

```txt
Scenario: polkadot-adoption-research-loop
Trace: traces/polkadot-adoption.trace.json
Verify: PASS
Replay: PASS
Result: PASS
```

Supported loop steps include context creation, observation, action proposal, policy evaluation, delegate vote, work creation, runtime execution, submission, review, knowledge candidate creation, and knowledge commit.

Common failures:

- Scenario YAML misses `id`, `name`, `actors`, `goal`, `policies`, or `loop`.
- A step references an unknown actor.
- `commit_knowledge` runs before a knowledge candidate or decision exists.
- Expected invariants fail during verification.
