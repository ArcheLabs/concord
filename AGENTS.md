# concord — Agent Operating Rules

This file lists invariants every Cursor agent (and human contributor) must obey when working in the `concord` repository. Violations should block PRs.

## Layering

`concord` is the protocol kernel. Network coordination is a **product concern** owned by `vibly-coordinator`.

```
@concord/* (packages/)        ← protocol kernel + adapters (no HTTP server)
        ▲
apps/mvp-runner               ← SDK CLI demo (no HTTP server)

vibly-coordinator             ← REST/SSE gateway, single source of truth for the HTTP contract
        ▲
vibly-client / vibly-console  ← consumers
```

## Invariants

1. **No HTTP frameworks in `@concord/*`.** Files under `packages/*/package.json` must not list `fastify`, `express`, `koa`, `hapi`, `@fastify/*`, `@nestjs/*` or similar HTTP frameworks in `dependencies`. HTTP is a product-side concern; if a package needs to expose an HTTP route, the route must live in `vibly-coordinator` (or another product repo).
2. **No HTTP service apps in `concord/apps/*`.** Only CLI / scripted demonstrations are allowed (e.g. `apps/mvp-runner`). Do not (re)introduce a Fastify/Express server process here. In particular, do not recreate `apps/coordinator-api` or anything that calls `server.listen` from this repo.
3. **One-way dependency direction.** `concord/*` must not depend on any `vibly-*` package. The dependency arrow is always `vibly-* → concord`. Do not add `vibly-*` to any `package.json` in this repo.
4. **No product naming inside concord.** Do not use `coordinator-api`, `coordinator-*`, `vibly-*`, or any other product-namespace string as a package name, app name, directory name, or top-level export. Concord exposes protocol concepts (e.g. `negotiation`, `workflow`, `governance`); product-shaped names belong to product repos.
5. **HTTP/SSE contract authority.** Treat `vibly-coordinator` as the single source of truth for the REST/SSE contract. Do not rebuild "official Concord HTTP endpoints" in this repo, do not maintain a parallel route table, and do not ship example clients that imply such a contract lives here. SDK demonstrations are CLI-only.

## When in doubt

- Need to script the SDK over a network protocol? Implement it in `vibly-coordinator` and call `@concord/sdk` from there.
- Need a quick local repro of an SDK feature? Add a script under `apps/mvp-runner` (CLI), or a vitest in the relevant package.
- Need to share types with `vibly-*` consumers? Export from a `@concord/*` package in TypeScript form. Do not couple to product-side route shapes.

## Cross-repo: HTTP contract authority

The Vibly Coordinator HTTP/SSE contract is owned exclusively by `vibly-coordinator` and surfaced via the `@vibly/coordinator-http-contract` package (in the workspace). All `vibly-*` consumers (`vibly-client`, `vibly-console`) consume that package and may not maintain a competing path table.

If concord ever needs a *concord-side* network shape (it should not, by invariant 5 above), use TypeScript exports inside a `@concord/*` package — never re-publish the coordinator HTTP contract or fork its types.
