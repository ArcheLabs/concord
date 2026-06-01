# Concord npm Publish Checklist

This checklist covers the current public Concord package surface, published under the Vibly brand:

- `@vibly-ai/concord-foundation`
- `@vibly-ai/concord-core`
- `@vibly-ai/concord-chain-indexing`
- `@vibly-ai/concord-governance`
- `@vibly-ai/concord-adapter-substrate-actions`
- `@vibly-ai/concord-adapter-substrate-indexer`

## Preflight

1. Confirm each published package name is correct in `packages/*/package.json`.
2. Confirm internal dependency declarations use `@vibly-ai/concord-*` for the published package set.
3. Confirm README snippets, import examples, and release notes use `@vibly-ai/concord-*`.
4. Confirm no published package depends on `vibly-*`, `@vibly/*`, or `@vibly-ai/*` names outside the `@vibly-ai/concord-*` prefix.

## Validation

1. Run `pnpm build`.
2. Run `pnpm test`.
3. Run `pnpm --filter @concord/invariants test`.
4. Search for stale package names:

```bash
rg -n '@concord/(foundation|core|chain-indexing|governance|adapter-substrate-actions|adapter-substrate-indexer)'
```

5. Dry-run package tarballs for each published package:

```bash
pnpm pack --filter @vibly-ai/concord-foundation --dry-run
pnpm pack --filter @vibly-ai/concord-core --dry-run
pnpm pack --filter @vibly-ai/concord-chain-indexing --dry-run
pnpm pack --filter @vibly-ai/concord-governance --dry-run
pnpm pack --filter @vibly-ai/concord-adapter-substrate-actions --dry-run
pnpm pack --filter @vibly-ai/concord-adapter-substrate-indexer --dry-run
```

## Release order

Publish in dependency order:

1. `@vibly-ai/concord-foundation`
2. `@vibly-ai/concord-core`
3. `@vibly-ai/concord-chain-indexing`
4. `@vibly-ai/concord-governance`
5. `@vibly-ai/concord-adapter-substrate-actions`
6. `@vibly-ai/concord-adapter-substrate-indexer`

## Post-publish

1. Verify npm metadata and install commands reference `@vibly-ai/concord-*`.
2. Update downstream consumers such as `@vibly-ai/client` and `vibly-coordinator` to the published versions.
3. Re-run local smoke tests from consuming repos after the new versions resolve from npm.
