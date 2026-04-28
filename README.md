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
